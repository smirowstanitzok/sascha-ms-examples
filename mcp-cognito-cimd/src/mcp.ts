// src/mcp.ts
// Deliberately minimal JSON-RPC layer to keep the focus on OAuth.
// Use the official MCP SDK for real servers.
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-11-25", "2026-07-28"];

const BOOKS = [
  { isbn: "978-3-00-000001-1", title: "Serverless for Beginners", author: "A. Example", stock: 4 },
  { isbn: "978-3-00-000002-8", title: "Thinking Event-Driven", author: "B. Sample", stock: 0 },
  { isbn: "978-3-00-000003-5", title: "Everyday TypeScript", author: "C. Test", stock: 12 },
];

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export function handleRpc(req: RpcRequest, user: string): object | undefined {
  if (req.id === undefined) return undefined; // notification, e.g. notifications/initialized

  switch (req.method) {
    case "initialize": {
      const wanted = String(req.params?.protocolVersion ?? "");
      return ok(req.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(wanted) ? wanted : "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "bookstore-mcp", version: "1.0.0" },
      });
    }
    case "tools/list":
      return ok(req.id, {
        tools: [
          {
            name: "search_books",
            description: "Searches the catalog for books by a keyword in the title and reports the stock.",
            inputSchema: {
              type: "object",
              properties: { keyword: { type: "string", description: "Part of the book title" } },
              required: ["keyword"],
            },
          },
        ],
      });
    case "tools/call": {
      const args = (req.params?.arguments ?? {}) as { keyword?: string };
      if (req.params?.name !== "search_books" || !args.keyword) {
        return { jsonrpc: "2.0", id: req.id, error: { code: -32602, message: "Unknown tool or missing keyword" } };
      }
      const hits = BOOKS.filter((b) => b.title.toLowerCase().includes(args.keyword!.toLowerCase()));
      const text = hits.length
        ? hits.map((b) => `${b.title} by ${b.author}: ${b.stock} in stock`).join("\n")
        : "No results";
      console.log(JSON.stringify({ msg: "tool_call", tool: "search_books", user }));
      return ok(req.id, { content: [{ type: "text", text }] });
    }
    default:
      return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Unknown method ${req.method}` } };
  }
}

function ok(id: string | number, result: object) {
  return { jsonrpc: "2.0", id, result };
}
