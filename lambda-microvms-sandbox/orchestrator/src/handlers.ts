// src/handlers.ts
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { authHeaderFor, startSandbox, stopSandbox, waitUntilReady } from './microvm.js';
import { deleteSession, loadSession, saveSession } from './store.js';

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// POST /sessions – one MicroVM per learner session
export async function createSession(): Promise<APIGatewayProxyResultV2> {
  const sessionId = randomUUID();
  const sandbox = await startSandbox(sessionId);
  await saveSession({
    sessionId,
    ...sandbox,
    expiresAt: Math.floor(Date.now() / 1000) + 3 * 60 * 60,
  });
  return json(201, { sessionId });
}

// POST /sessions/{id}/snippets – runs code in the session's sandbox
export async function runSnippet(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const session = await loadSession(event.pathParameters?.id ?? '');
  if (!session) return json(404, { error: 'Session not found' });

  const { code } = JSON.parse(event.body ?? '{}');
  if (typeof code !== 'string' || code.length > 20_000) {
    return json(400, { error: 'Field "code" is missing or too long' });
  }

  await waitUntilReady(session.microvmId);
  const response = await fetch(`https://${session.endpoint}/snippets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-aws-proxy-auth': await authHeaderFor(session.microvmId),
      'X-aws-proxy-port': '8080',
    },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(20_000),
  });
  return json(response.status, await response.json());
}

// DELETE /sessions/{id} – ends the session and stops all costs
export async function endSession(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const session = await loadSession(event.pathParameters?.id ?? '');
  if (!session) return json(404, { error: 'Session not found' });
  await stopSandbox(session.microvmId);
  await deleteSession(session.sessionId);
  return { statusCode: 204 };
}
