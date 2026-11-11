// src/web-search.ts
import {
  BedrockAgentCoreClient,
  InvokeWebSearchCommand,
  type InvokeWebSearchCommandInput,
} from "@aws-sdk/client-bedrock-agentcore";

// The AWS managed search tool. There is currently no other ID.
export const WEB_SEARCH_ID = "web-search.v1";

export interface SearchOptions {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  publishedAfter?: Date;
  publishedBefore?: Date;
}

export interface Source {
  title: string;
  url?: string;
  publishedAt?: string;
  excerpt: string;
}

// The API expects a bare domain: no scheme, no path, no port.
export function normalizeDomain(value: string): string {
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "");
  if (host.length > 253 || !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) {
    throw new Error(`Invalid domain: ${value}`);
  }
  return host;
}

function domainList(values?: string[]): string[] | undefined {
  if (!values || values.length === 0) return undefined;
  const list = [...new Set(values.map(normalizeDomain))];
  if (list.length > 100) throw new Error("At most 100 domains per list.");
  return list;
}

export function buildSearchInput(opts: SearchOptions): InvokeWebSearchCommandInput {
  const query = opts.query.trim();
  if (query.length < 1 || query.length > 200) {
    throw new Error("The search query must be 1 to 200 characters long.");
  }
  const maxResults = opts.maxResults ?? 5;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 25) {
    throw new Error("maxResults must be between 1 and 25.");
  }
  const { publishedAfter, publishedBefore } = opts;
  if (publishedAfter && publishedBefore && publishedAfter > publishedBefore) {
    throw new Error("publishedAfter is later than publishedBefore.");
  }

  const include = domainList(opts.includeDomains);
  const exclude = domainList(opts.excludeDomains);
  const input: InvokeWebSearchCommandInput = {
    webSearchId: WEB_SEARCH_ID,
    searchQuery: query,
    maxResults,
  };
  if (include || exclude || publishedAfter || publishedBefore) {
    input.filters = {
      ...(include || exclude ? { domainFilter: { include, exclude } } : {}),
      ...(publishedAfter || publishedBefore
        ? { publishedDateFilter: { publishedAfter, publishedBefore } }
        : {}),
    };
  }
  return input;
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function searchWeb(
  client: BedrockAgentCoreClient,
  opts: SearchOptions,
): Promise<Source[]> {
  const output = await client.send(new InvokeWebSearchCommand(buildSearchInput(opts)));
  return (output.results ?? []).map((result) => ({
    title: result.title ?? result.url ?? "Untitled",
    url: result.url,
    publishedAt: result.publishedAt?.toISOString(),
    excerpt: shorten(result.text ?? "", 1200),
  }));
}
