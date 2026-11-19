// src/authorization-id.ts
// Pulls the authorization ID out of an AccessDenied error message.
// AWS mentions it in two places: as plain text ("authorization id: …")
// and in the console link ("#/authorization-details/…").
const PATTERNS: RegExp[] = [
  /authorization id:\s*([A-Za-z0-9_-]{8,})/i,
  /#\/authorization-details\/([A-Za-z0-9_-]{8,})/,
];

export function extractAuthorizationId(message: string): string | undefined {
  for (const pattern of PATTERNS) {
    const match = pattern.exec(message);
    if (match) return match[1];
  }
  return undefined;
}

export function isAccessDenied(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return /AccessDenied/i.test(error.name) || status === 403;
}
