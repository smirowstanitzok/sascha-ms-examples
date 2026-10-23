# Connecting MCP servers securely

**Article:** [Connecting MCP Servers Securely: Lessons from OpenCode](https://sascha-ms.de/en/secure-mcp-servers-opencode-lessons) (English) · [German original](https://sascha-ms.de/2026/358-mcp-server-sicher-anbinden-opencode)

The OpenCode vulnerability turned an OAuth login against a remote MCP server into code execution on Windows. This folder contains the two tools from the article:

- **`src/audit-mcp.ts`** checks an `opencode.json` against your allowlist and reports remote servers without HTTPS, hosts outside the allowlist and servers with OAuth enabled.
- **`src/auth-url.ts`** validates an `authorization_endpoint` strictly, builds the authorization URL with `URLSearchParams` and opens it with `execFile`, without a shell.

## Run it

```bash
npm install
npm test   # six tests with the built-in Node.js test runner

# audit an OpenCode configuration
npm run build
MCP_ALLOWED_HOSTS=mcp.example.com,tickets.example.org npm run audit -- ~/.config/opencode/opencode.json
```

`opencode.example.json` shows a remote server with an API key from an environment variable and `"oauth": false`.

Tested with Node.js 22 and TypeScript 5.9.
