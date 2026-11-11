// src/agent.ts
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";
import type { SearchOptions, Source } from "./web-search";

const DAY_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = [
  "You are a research assistant for a software team.",
  "Use the web_search tool for anything that may have changed recently.",
  "Answer only from the search results and cite every claim as [n],",
  "where n is the position of the URL in the list of sources.",
  "If the results do not answer the question, say so.",
].join(" ");

const webSearchTool: Tool = {
  toolSpec: {
    name: "web_search",
    description: "Searches trusted websites and returns text extracts with URL and date.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          query: { type: "string", description: "Short search query, at most 200 characters" },
          recentDays: {
            type: "integer",
            minimum: 1,
            maximum: 365,
            description: "Only pages from the last N days (optional)",
          },
        },
        required: ["query"],
      },
    },
  },
};

export interface AgentDeps {
  runtime: BedrockRuntimeClient;
  search: (opts: SearchOptions) => Promise<Source[]>;
  modelId: string;
  trustedDomains: string[];
  maxSearches?: number;
  now?: () => Date;
}

export interface AgentAnswer {
  answer: string;
  sources: Source[];
  searches: number;
}

export async function answerWithSources(question: string, deps: AgentDeps): Promise<AgentAnswer> {
  const maxSearches = deps.maxSearches ?? 3;
  const now = deps.now ?? (() => new Date());
  const messages: Message[] = [{ role: "user", content: [{ text: question }] }];
  const sources = new Map<string, Source>();
  let searches = 0;

  // Hard upper bound on model calls so that a looping model cannot run up costs.
  for (let call = 0; call < maxSearches + 2; call++) {
    const response = await deps.runtime.send(
      new ConverseCommand({
        modelId: deps.modelId,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
        toolConfig: { tools: [webSearchTool] },
        inferenceConfig: { maxTokens: 1500 },
      }),
    );
    const message = response.output?.message;
    if (!message) throw new Error("The model returned no message.");
    messages.push(message);

    if (response.stopReason !== "tool_use") {
      const answer = (message.content ?? []).map((block) => block.text ?? "").join("").trim();
      return { answer, sources: [...sources.values()], searches };
    }

    const toolResults: ContentBlock[] = [];
    for (const block of message.content ?? []) {
      if (!block.toolUse) continue;
      const toolUseId = block.toolUse.toolUseId;
      if (searches >= maxSearches) {
        toolResults.push({
          toolResult: {
            toolUseId,
            status: "error",
            content: [{ text: "Search budget used up. Answer with the sources you already have." }],
          },
        });
        continue;
      }
      const args = (block.toolUse.input ?? {}) as { query?: unknown; recentDays?: unknown };
      try {
        searches++;
        const found = await deps.search({
          query: String(args.query ?? ""),
          maxResults: 5,
          includeDomains: deps.trustedDomains,
          publishedAfter:
            typeof args.recentDays === "number"
              ? new Date(now().getTime() - args.recentDays * DAY_MS)
              : undefined,
        });
        for (const source of found) {
          if (source.url && !sources.has(source.url)) sources.set(source.url, source);
        }
        const numbered = found.map((source) => ({
          n: source.url ? [...sources.keys()].indexOf(source.url) + 1 : null,
          title: source.title,
          url: source.url ?? null,
          publishedAt: source.publishedAt ?? null,
          excerpt: source.excerpt,
        }));
        toolResults.push({ toolResult: { toolUseId, content: [{ json: { results: numbered } }] } });
      } catch (error) {
        toolResults.push({
          toolResult: {
            toolUseId,
            status: "error",
            content: [{ text: `Search failed: ${(error as Error).message}` }],
          },
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }
  throw new Error("The model did not produce a final answer.");
}
