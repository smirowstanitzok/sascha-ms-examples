// src/broadcast.ts
export type SendResult = 'sent' | 'gone';

// Abstraction over PostToConnection so that broadcast() can be tested without AWS.
export interface Sender {
  send(connectionId: string, data: string): Promise<SendResult>;
}

export interface BroadcastReport {
  sent: number;
  gone: string[];
  failed: string[];
}

export async function broadcast(
  connectionIds: string[],
  payload: unknown,
  sender: Sender,
  concurrency = 25,
): Promise<BroadcastReport> {
  const data = JSON.stringify(payload);
  const report: BroadcastReport = { sent: 0, gone: [], failed: [] };
  const queue = [...connectionIds];

  // Several "workers" share the queue: parallel, but capped.
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        const result = await sender.send(id, data);
        if (result === 'gone') report.gone.push(id);
        else report.sent++;
      } catch (err) {
        console.error('Send failed', { connectionId: id, err });
        report.failed.push(id);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker),
  );
  return report;
}
