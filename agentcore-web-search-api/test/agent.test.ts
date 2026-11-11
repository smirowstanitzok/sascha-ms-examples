// test/agent.test.ts
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerWithSources } from "../src/agent";

const runtimeMock = mockClient(BedrockRuntimeClient);

const toolUseTurn = (query: string) => ({
  stopReason: "tool_use" as const,
  output: {
    message: {
      role: "assistant" as const,
      content: [{ toolUse: { toolUseId: `t-${query}`, name: "web_search", input: { query, recentDays: 30 } } }],
    },
  },
});

describe("answerWithSources", () => {
  beforeEach(() => runtimeMock.reset());

  it("searches, numbers the sources and returns the answer", async () => {
    runtimeMock
      .on(ConverseCommand)
      .resolvesOnce(toolUseTurn("Node.js 24 Lambda"))
      .resolvesOnce({
        stopReason: "end_turn",
        output: { message: { role: "assistant", content: [{ text: "Yes, Lambda supports Node.js 24 [1]." }] } },
      });
    const search = vi.fn().mockResolvedValue([
      { title: "Lambda runtimes", url: "https://docs.aws.amazon.com/lambda/", excerpt: "Node.js 24 …" },
    ]);

    const result = await answerWithSources("Does Lambda support Node.js 24?", {
      runtime: new BedrockRuntimeClient({}),
      search,
      modelId: "test-model",
      trustedDomains: ["aws.amazon.com"],
      now: () => new Date("2026-11-11T00:00:00Z"),
    });

    expect(result.answer).toBe("Yes, Lambda supports Node.js 24 [1].");
    expect(result.searches).toBe(1);
    expect(result.sources).toHaveLength(1);
    expect(search).toHaveBeenCalledWith({
      query: "Node.js 24 Lambda",
      maxResults: 5,
      includeDomains: ["aws.amazon.com"],
      publishedAfter: new Date("2026-10-12T00:00:00Z"),
    });
  });

  it("stops searching once the budget is used up", async () => {
    runtimeMock
      .on(ConverseCommand)
      .resolvesOnce(toolUseTurn("a"))
      .resolvesOnce(toolUseTurn("b"))
      .resolvesOnce({
        stopReason: "end_turn",
        output: { message: { role: "assistant", content: [{ text: "Not enough sources." }] } },
      });
    const search = vi.fn().mockResolvedValue([]);

    const result = await answerWithSources("Question", {
      runtime: new BedrockRuntimeClient({}),
      search,
      modelId: "test-model",
      trustedDomains: [],
      maxSearches: 1,
    });

    expect(search).toHaveBeenCalledTimes(1);
    // The SDK mock keeps a reference to the same array, so look for the last user message.
    const messages = runtimeMock.commandCalls(ConverseCommand)[2].args[0].input.messages ?? [];
    const toolResult = messages.filter((m) => m.role === "user").at(-1)?.content?.[0].toolResult;
    expect(toolResult?.status).toBe("error");
    expect(result.answer).toBe("Not enough sources.");
  });
});
