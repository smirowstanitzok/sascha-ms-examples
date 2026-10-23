import {
  DynamoDBStreamsClient,
  DescribeStreamCommand,
  GetShardIteratorCommand,
  GetRecordsCommand,
  type Shard,
  type _Record as StreamRecord,
} from "@aws-sdk/client-dynamodb-streams";

export interface ReplayOptions {
  streamArn: string;
  from: Date;              // start reading here (AT_TIMESTAMP)
  until?: Date;            // optional: read up to here (default: now)
  handle: (records: StreamRecord[]) => Promise<void>;
  client?: Pick<DynamoDBStreamsClient, "send">;
  maxEmptyPolls?: number;  // open shards: stop after this many empty responses
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch all shards of the stream (DescribeStream is paginated). */
async function listShards(client: Pick<DynamoDBStreamsClient, "send">, streamArn: string): Promise<Shard[]> {
  const shards: Shard[] = [];
  let exclusiveStartShardId: string | undefined;
  do {
    const res = await client.send(
      new DescribeStreamCommand({ StreamArn: streamArn, ExclusiveStartShardId: exclusiveStartShardId }),
    );
    shards.push(...(res.StreamDescription?.Shards ?? []));
    exclusiveStartShardId = res.StreamDescription?.LastEvaluatedShardId;
  } while (exclusiveStartShardId);
  return shards;
}

/** Sort parent shards before child shards so that the order per item is preserved. */
export function orderShards(shards: Shard[]): Shard[] {
  const byId = new Map(shards.map((s) => [s.ShardId!, s]));
  const done = new Set<string>();
  const result: Shard[] = [];
  const visit = (shard: Shard) => {
    if (done.has(shard.ShardId!)) return;
    const parent = shard.ParentShardId ? byId.get(shard.ParentShardId) : undefined;
    if (parent) visit(parent);
    done.add(shard.ShardId!);
    result.push(shard);
  };
  shards.forEach(visit);
  return result;
}

export async function replayStream(opts: ReplayOptions): Promise<number> {
  const client = opts.client ?? new DynamoDBStreamsClient({});
  const until = opts.until ?? new Date();
  const maxEmptyPolls = opts.maxEmptyPolls ?? 3;
  if (opts.from.getTime() > Date.now()) throw new Error("'from' must not be in the future");

  let total = 0;
  for (const shard of orderShards(await listShards(client, opts.streamArn))) {
    const isClosed = Boolean(shard.SequenceNumberRange?.EndingSequenceNumber);
    let iterator: string | undefined;
    try {
      const res = await client.send(
        new GetShardIteratorCommand({
          StreamArn: opts.streamArn,
          ShardId: shard.ShardId!,
          ShardIteratorType: "AT_TIMESTAMP",
          Timestamp: opts.from,
        }),
      );
      iterator = res.ShardIterator;
    } catch (err) {
      // shard has already dropped out of the 24-hour window completely
      if ((err as Error).name === "TrimmedDataAccessException" || (err as Error).name === "ResourceNotFoundException") continue;
      throw err;
    }

    let emptyPolls = 0;
    while (iterator) {
      const res = await client.send(new GetRecordsCommand({ ShardIterator: iterator, Limit: 1000 }));
      const records = res.Records ?? [];
      const inWindow = records.filter((r) => (r.dynamodb?.ApproximateCreationDateTime?.getTime() ?? 0) <= until.getTime());
      if (inWindow.length > 0) {
        await opts.handle(inWindow);
        total += inWindow.length;
      }
      if (inWindow.length < records.length) break;   // time window exceeded
      iterator = res.NextShardIterator;               // undefined = shard closed and fully read
      if (records.length === 0) {
        if (!isClosed && ++emptyPolls >= maxEmptyPolls) break; // open shard has "caught up"
        await sleep(250);
      } else {
        emptyPolls = 0;
      }
    }
  }
  return total;
}
