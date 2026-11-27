// src/client.ts
import { typeUri } from './problem.ts';

// This is how a client evaluates the response: via type, never via detail
export async function describeFailure(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.startsWith('application/problem+json')) {
    return `HTTP ${res.status}`; // not a problem object, e.g. from a proxy
  }
  const problem = (await res.json()) as Record<string, unknown>;
  switch (problem.type) {
    case typeUri('BikeUnavailable'):
      return `Sorry, already booked. Free from ${String(problem.freeFrom)}.`;
    case typeUri('InvalidInput'):
      return `Please check: ${(problem.errors as { pointer: string }[]).map((e) => e.pointer).join(', ')}`;
    default:
      return typeof problem.title === 'string' ? problem.title : `HTTP ${res.status}`;
  }
}
