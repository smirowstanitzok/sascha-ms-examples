// src/memory.ts
import {
  CreateEventCommand,
  ListEventsCommand,
  ListMemoryRecordsCommand,
  type ListMemoryRecordsCommandOutput,
  type MemoryMetadataFilterExpression,
} from "@aws-sdk/client-bedrock-agentcore";

// Small interface instead of the concrete client, so tests can pass in a fake.
export interface MemoryClient {
  send(command: unknown): Promise<any>;
}

export type Turn = { role: "USER" | "ASSISTANT"; text: string };
export type RecapEntry = { sessionId: string; text: string; updatedAt: Date };

// System key set by AgentCore Memory, no need to declare it as an indexed key.
export const FULL_SESSION_FILTER: MemoryMetadataFilterExpression = {
  left: { metadataKey: "x-amz-agentcore-memory-recordType" },
  operator: "EQUALS_TO",
  right: { metadataValue: { stringValue: "FULL_SESSION" } },
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

// IDs end up in namespaces. A "/" in a customer ID would break the hierarchy.
export function assertId(value: unknown, label: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

// Must match the NamespaceTemplates entry in serverless.yml.
export function sessionNamespace(customerId: string, sessionId: string): string {
  return `/summaries/${customerId}/${sessionId}/`;
}

export function customerNamespacePath(customerId: string): string {
  return `/summaries/${customerId}/`;
}

export function sessionIdFromNamespace(namespace: string): string | undefined {
  const match = /^\/summaries\/[^/]+\/([^/]+)\/$/.exec(namespace);
  return match?.[1];
}

export async function recordTurn(
  client: MemoryClient,
  memoryId: string,
  customerId: string,
  sessionId: string,
  turn: Turn,
  options: { skipExtraction?: boolean } = {},
): Promise<void> {
  await client.send(
    new CreateEventCommand({
      memoryId,
      actorId: customerId,
      sessionId,
      eventTimestamp: new Date(),
      payload: [{ conversational: { role: turn.role, content: { text: turn.text } } }],
      // SKIP: stored as short-term event, but never summarized.
      ...(options.skipExtraction ? { extractionMode: "SKIP" as const } : {}),
    }),
  );
}

export async function recentTurns(
  client: MemoryClient,
  memoryId: string,
  customerId: string,
  sessionId: string,
  maxResults = 10,
): Promise<Turn[]> {
  const response = await client.send(
    new ListEventsCommand({ memoryId, actorId: customerId, sessionId, includePayloads: true, maxResults }),
  );
  const events: any[] = response.events ?? [];
  return events
    .slice()
    .sort((a, b) => new Date(a.eventTimestamp).getTime() - new Date(b.eventTimestamp).getTime())
    .flatMap((event) => event.payload ?? [])
    .map((item: any) => item.conversational)
    .filter((c: any) => c && (c.role === "USER" || c.role === "ASSISTANT") && c.content?.text)
    .map((c: any) => ({ role: c.role, text: c.content.text }));
}

export async function sessionRecap(
  client: MemoryClient,
  memoryId: string,
  customerId: string,
  sessionId: string,
): Promise<string | undefined> {
  const response: ListMemoryRecordsCommandOutput = await client.send(
    new ListMemoryRecordsCommand({
      memoryId,
      namespace: sessionNamespace(customerId, sessionId),
      metadataFilters: [FULL_SESSION_FILTER],
      maxResults: 1,
    }),
  );
  return response.memoryRecordSummaries?.[0]?.content?.text;
}

export async function customerHistory(
  client: MemoryClient,
  memoryId: string,
  customerId: string,
  limit = 5,
): Promise<RecapEntry[]> {
  const entries: RecapEntry[] = [];
  let nextToken: string | undefined;
  do {
    const response: ListMemoryRecordsCommandOutput = await client.send(
      new ListMemoryRecordsCommand({
        memoryId,
        namespacePath: customerNamespacePath(customerId),
        metadataFilters: [FULL_SESSION_FILTER],
        maxResults: 50,
        nextToken,
      }),
    );
    for (const record of response.memoryRecordSummaries ?? []) {
      const sessionId = (record.namespaces ?? []).map(sessionIdFromNamespace).find(Boolean);
      const text = record.content?.text;
      if (!sessionId || !text) continue;
      entries.push({ sessionId, text, updatedAt: new Date(record.timestamp ?? record.createdAt ?? 0) });
    }
    nextToken = response.nextToken;
  } while (nextToken);

  return entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, limit);
}
