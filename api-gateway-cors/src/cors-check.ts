// src/cors-check.ts
// Sends a preflight request like a browser would and explains what is missing.

export interface PreflightRequest {
  url: string;
  origin: string;
  method: string;
  headers: string[];
  credentials: boolean;
}

export interface Finding {
  level: 'error' | 'hint';
  message: string;
}

const list = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

export function evaluatePreflight(req: PreflightRequest, status: number, headers: Headers): Finding[] {
  const findings: Finding[] = [];
  const error = (message: string) => findings.push({ level: 'error', message });
  const hint = (message: string) => findings.push({ level: 'hint', message });

  if (status < 200 || status > 299) {
    error(`Preflight returns status ${status}. Often an authorizer or a $default route catches the OPTIONS request.`);
  }

  const allowOrigin = headers.get('access-control-allow-origin');
  if (!allowOrigin) {
    error('Access-Control-Allow-Origin is missing. Is the origin allowed and spelled exactly right (scheme, port, no slash)?');
  } else if (allowOrigin.includes(',')) {
    error(`Access-Control-Allow-Origin contains multiple values ("${allowOrigin}"). CORS is probably set twice (gateway and function).`);
  } else if (allowOrigin === '*' && req.credentials) {
    error('With credentials, "*" is not allowed as origin. The exact origin must be returned.');
  } else if (allowOrigin !== '*' && allowOrigin !== req.origin) {
    error(`Allowed origin "${allowOrigin}" does not match the requesting origin "${req.origin}".`);
  }

  if (req.credentials && headers.get('access-control-allow-credentials') !== 'true') {
    error('Access-Control-Allow-Credentials: true is missing, so the browser will not send cookies.');
  }

  const methods = list(headers.get('access-control-allow-methods'));
  const method = req.method.toLowerCase();
  const simpleMethods = ['get', 'head', 'post'];
  const methodWildcard = methods.includes('*') && !req.credentials;
  if (!simpleMethods.includes(method) && !methods.includes(method) && !methodWildcard) {
    error(`Method ${req.method.toUpperCase()} is not in Access-Control-Allow-Methods.`);
  }

  const allowedHeaders = list(headers.get('access-control-allow-headers'));
  const headerWildcard = allowedHeaders.includes('*') && !req.credentials;
  for (const name of req.headers.map((h) => h.toLowerCase())) {
    // Authorization is never covered by the "*" wildcard
    const covered = allowedHeaders.includes(name) || (headerWildcard && name !== 'authorization');
    if (!covered) {
      error(`Header "${name}" is not in Access-Control-Allow-Headers.`);
    }
  }

  if (!headers.get('access-control-max-age')) {
    hint('No Access-Control-Max-Age: browsers repeat the preflight after a few seconds.');
  }
  if (allowOrigin && allowOrigin !== '*' && !list(headers.get('vary')).includes('origin')) {
    hint('Specific origin without "Vary: Origin": a CDN could serve the response to the wrong origin.');
  }

  return findings;
}

export async function checkPreflight(req: PreflightRequest): Promise<Finding[]> {
  const res = await fetch(req.url, {
    method: 'OPTIONS',
    headers: {
      Origin: req.origin,
      'Access-Control-Request-Method': req.method.toUpperCase(),
      ...(req.headers.length ? { 'Access-Control-Request-Headers': req.headers.join(',') } : {}),
    },
  });
  return evaluatePreflight(req, res.status, res.headers);
}

// CLI: npx tsx src/cors-check.ts <url> <origin> <method> [header,header] [--credentials]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [url, origin, method = 'GET', headerArg = ''] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!url || !origin) {
    console.error('Usage: npx tsx src/cors-check.ts <url> <origin> <method> [header,header] [--credentials]');
    process.exit(2);
  }
  const req: PreflightRequest = {
    url,
    origin,
    method,
    headers: headerArg ? headerArg.split(',') : [],
    credentials: process.argv.includes('--credentials'),
  };
  const findings = await checkPreflight(req);
  if (findings.length === 0) console.log('OK: the browser would allow this request.');
  for (const f of findings) console.log(`${f.level === 'error' ? 'ERROR' : 'HINT '} ${f.message}`);
  process.exit(findings.some((f) => f.level === 'error') ? 1 : 0);
}
