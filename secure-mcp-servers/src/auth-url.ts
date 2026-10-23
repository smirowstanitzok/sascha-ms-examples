import { execFile } from 'node:child_process';

export class UnsafeAuthorizationUrlError extends Error {}

export interface AuthUrlPolicy {
  /** Hosts allowed as authorization servers (from your configuration, not from the server). */
  allowedHosts: string[];
  /** Allow http:// only for localhost during development. */
  allowLoopbackHttp?: boolean;
}

// Only characters that occur in a normal endpoint path.
// No $, no brackets, no quotes, no backtick, no spaces.
const SAFE_ENDPOINT = /^[A-Za-z0-9\-._~:/]+$/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function validateAuthorizationEndpoint(raw: string, policy: AuthUrlPolicy): URL {
  if (!SAFE_ENDPOINT.test(raw)) {
    throw new UnsafeAuthorizationUrlError('Disallowed characters in authorization_endpoint');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeAuthorizationUrlError('authorization_endpoint is not a valid URL');
  }
  const loopback = LOOPBACK.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && policy.allowLoopbackHttp)) {
    throw new UnsafeAuthorizationUrlError(`Scheme ${url.protocol} is not allowed`);
  }
  if (url.username || url.password) {
    throw new UnsafeAuthorizationUrlError('Credentials in the URL are not allowed');
  }
  if (!loopback && !policy.allowedHosts.includes(url.hostname)) {
    throw new UnsafeAuthorizationUrlError(`Host ${url.hostname} is not on the allowlist`);
  }
  return url;
}

export function buildAuthorizationUrl(endpoint: URL, params: Record<string, string>): string {
  const url = new URL(endpoint.href);
  // URLSearchParams encodes all special characters, including $ ( ) and spaces.
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

/** Opens the URL without a shell: the program receives the URL as a single argument. */
export function openInBrowser(url: string, platform: NodeJS.Platform = process.platform): Promise<void> {
  const [command, args] =
    platform === 'darwin' ? ['open', [url]] :
    platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] :
    ['xdg-open', [url]];

  return new Promise((resolve, reject) => {
    execFile(command, args, { shell: false, windowsHide: true }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
