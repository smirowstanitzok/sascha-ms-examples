// web/sse-client.ts
export type SseMessage = { event: string; data: string; id?: string };

// Splits a text stream into SSE messages. Line endings: \n or \r\n.
export async function* readSse(stream: ReadableStream<string>): AsyncGenerator<SseMessage> {
  const reader = stream.getReader();
  let buffer = '';
  let event: string | undefined;
  let id: string | undefined;
  let data: string[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        let line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);

        if (line === '') {
          // Blank line: the message is complete.
          if (data.length > 0) yield { event: event ?? 'message', data: data.join('\n'), id };
          event = undefined;
          data = [];
          continue;
        }
        if (line.startsWith(':')) continue; // Comment, e.g. keep-alive

        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? '' : line.slice(colon + 1);
        if (value.startsWith(' ')) value = value.slice(1);

        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
        else if (field === 'id') id = value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export type ChatHandlers = {
  onText: (text: string) => void;
  onTool?: (name: string, status: string) => void;
  onUsage?: (inputTokens: number, outputTokens: number) => void;
  onError?: (message: string, retryable: boolean) => void;
};

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Sends a question via POST and passes the events to the handlers.
// Returns the stopReason, e.g. "end_turn".
export async function askAdvisor(
  url: string,
  question: string,
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<string> {
  const body = JSON.stringify({ question });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      // Required when CloudFront with origin access control sits in front of the function URL.
      'x-amz-content-sha256': await sha256Hex(body),
    },
    body,
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  if (!res.headers.get('content-type')?.startsWith('text/event-stream')) {
    throw new Error('Response is not an event stream');
  }

  let stopReason = 'unknown';
  for await (const msg of readSse(res.body.pipeThrough(new TextDecoderStream()))) {
    const payload = JSON.parse(msg.data);
    switch (msg.event) {
      case 'text':
        handlers.onText(payload.text);
        break;
      case 'tool':
        handlers.onTool?.(payload.name, payload.status);
        break;
      case 'usage':
        handlers.onUsage?.(payload.inputTokens, payload.outputTokens);
        break;
      case 'error':
        handlers.onError?.(payload.message, payload.retryable);
        break;
      case 'done':
        stopReason = payload.stopReason;
        break;
    }
  }
  return stopReason;
}
