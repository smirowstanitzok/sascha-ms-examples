import { readFileSync } from 'node:fs';

interface RemoteServer {
  type: 'remote';
  url: string;
  enabled?: boolean;
  oauth?: false | Record<string, unknown>;
}

type McpConfig = { mcp?: Record<string, RemoteServer | { type: string }> };

const [, , configPath = 'opencode.json'] = process.argv;
const allowedHosts = (process.env.MCP_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);

const config = JSON.parse(readFileSync(configPath, 'utf8')) as McpConfig;
let findings = 0;

for (const [name, server] of Object.entries(config.mcp ?? {})) {
  if (server.type !== 'remote') continue;
  const remote = server as RemoteServer;
  const url = new URL(remote.url);
  const notes: string[] = [];

  if (url.protocol !== 'https:') notes.push('no HTTPS');
  if (!allowedHosts.includes(url.hostname)) notes.push('host not on the allowlist');
  if (remote.oauth !== false) notes.push('OAuth login possible (oauth not set to false)');
  if (remote.enabled === false) notes.push('disabled – is it still needed?');

  findings += notes.length;
  console.log(`${notes.length ? 'REVIEW' : 'OK    '}  ${name}  ${url.origin}${notes.length ? '  → ' + notes.join('; ') : ''}`);
}

process.exitCode = findings > 0 ? 1 : 0;
