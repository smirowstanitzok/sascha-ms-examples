// src/gaps.ts
// Pure logic: which endpoints does API Portal not see (or see only through traffic)?

export type Severity = 'high' | 'medium' | 'info';

export interface HttpApiInfo {
  apiId: string;
  name: string;
  protocolType: 'HTTP' | 'WEBSOCKET';
  endpoint: string;
  executeApiDisabled: boolean;
  routes: { routeKey: string; authorizationType: string }[];
}

export interface FunctionUrlInfo {
  functionName: string;
  url: string;
  authType: 'NONE' | 'AWS_IAM';
}

export interface RestMethodInfo {
  apiId: string;
  apiName: string;
  path: string;
  httpMethod: string;
}

export interface Gap {
  severity: Severity;
  kind: 'http-api' | 'websocket-api' | 'function-url' | 'rest-catch-all';
  resource: string;
  endpoint: string;
  reason: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, info: 2 };

export function httpApiGaps(apis: HttpApiInfo[]): Gap[] {
  const gaps: Gap[] = [];
  for (const api of apis) {
    if (api.protocolType === 'WEBSOCKET') {
      gaps.push({
        severity: 'medium',
        kind: 'websocket-api',
        resource: api.name,
        endpoint: api.endpoint,
        reason: 'WebSocket API: not discovered by API Portal',
      });
      continue;
    }
    // Routes without an authorizer are reachable by anyone who knows the URL.
    const open = api.routes.filter(
      (r) => r.authorizationType === 'NONE' && !r.routeKey.startsWith('OPTIONS'),
    );
    const publicEndpoint = !api.executeApiDisabled;
    gaps.push({
      severity: open.length > 0 && publicEndpoint ? 'high' : 'medium',
      kind: 'http-api',
      resource: api.name,
      endpoint: api.endpoint,
      reason:
        open.length > 0
          ? `HTTP API: not discovered, ${open.length} route(s) without authorization (${open
              .map((r) => r.routeKey)
              .join(', ')})`
          : 'HTTP API: not discovered by API Portal',
    });
  }
  return gaps;
}

export function functionUrlGaps(urls: FunctionUrlInfo[]): Gap[] {
  return urls.map((u) => ({
    severity: u.authType === 'NONE' ? 'high' : 'info',
    kind: 'function-url',
    resource: u.functionName,
    endpoint: u.url,
    reason:
      u.authType === 'NONE'
        ? 'Function URL without auth: only visible if CloudFront sits in front'
        : 'Function URL with IAM auth: only visible if CloudFront sits in front',
  }));
}

export function restCatchAllGaps(methods: RestMethodInfo[]): Gap[] {
  return methods
    .filter((m) => m.httpMethod === 'ANY' || m.path.includes('+}'))
    .map((m) => ({
      severity: 'info' as const,
      kind: 'rest-catch-all' as const,
      resource: `${m.apiName} (${m.apiId})`,
      endpoint: `${m.httpMethod} ${m.path}`,
      reason: 'ANY or {proxy+}: appears in the inventory only after real traffic',
    }));
}

export function findGaps(input: {
  httpApis: HttpApiInfo[];
  functionUrls: FunctionUrlInfo[];
  restMethods: RestMethodInfo[];
}): Gap[] {
  return [
    ...httpApiGaps(input.httpApis),
    ...functionUrlGaps(input.functionUrls),
    ...restCatchAllGaps(input.restMethods),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function formatReport(gaps: Gap[], region: string): string {
  if (gaps.length === 0) {
    return `No gaps found in ${region}. API Portal sees all endpoints found here.`;
  }
  const count = (s: Severity) => gaps.filter((g) => g.severity === s).length;
  const lines = [
    `Gap report for API Portal in ${region}: ${gaps.length} finding(s)`,
    `high: ${count('high')}, medium: ${count('medium')}, info: ${count('info')}`,
    '',
    ...gaps.map((g) => `[${g.severity.toUpperCase()}] ${g.resource} | ${g.endpoint} | ${g.reason}`),
  ];
  return lines.join('\n');
}
