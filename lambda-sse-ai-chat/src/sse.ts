// src/sse.ts
// The events the server sends to the browser.
export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; status: 'start' | 'done' | 'error' }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; message: string; retryable: boolean }
  | { type: 'done'; stopReason: string };

// Formats an event in SSE format: id, event, data and a blank line.
// JSON.stringify escapes line breaks, so the data line stays on one line.
export function formatSse(event: ChatEvent, id: number): string {
  const { type, ...payload } = event;
  return `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

// Comment line without content: keeps connections open, the client ignores it.
export const KEEP_ALIVE = ': ping\n\n';
