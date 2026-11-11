// test/web-search.test.ts
import { BedrockAgentCoreClient, InvokeWebSearchCommand } from "@aws-sdk/client-bedrock-agentcore";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSearchInput, normalizeDomain, searchWeb } from "../src/web-search";

const agentCoreMock = mockClient(BedrockAgentCoreClient);

describe("normalizeDomain", () => {
  it("removes scheme, path and port", () => {
    expect(normalizeDomain("https://Docs.AWS.amazon.com:443/lambda/")).toBe("docs.aws.amazon.com");
  });

  it("rejects values that are not domains", () => {
    expect(() => normalizeDomain("localhost")).toThrow(/Invalid domain/);
  });
});

describe("buildSearchInput", () => {
  it("only sends filters that are set", () => {
    expect(buildSearchInput({ query: "Node.js 24 Lambda" })).toEqual({
      webSearchId: "web-search.v1",
      searchQuery: "Node.js 24 Lambda",
      maxResults: 5,
    });
  });

  it("deduplicates domains and builds the date range", () => {
    const after = new Date("2026-10-01T00:00:00Z");
    const input = buildSearchInput({
      query: "Lambda runtimes",
      includeDomains: ["aws.amazon.com", "https://aws.amazon.com/blogs/"],
      publishedAfter: after,
    });
    expect(input.filters).toEqual({
      domainFilter: { include: ["aws.amazon.com"], exclude: undefined },
      publishedDateFilter: { publishedAfter: after, publishedBefore: undefined },
    });
  });

  it("rejects queries longer than 200 characters", () => {
    expect(() => buildSearchInput({ query: "x".repeat(201) })).toThrow(/1 to 200/);
  });

  it("rejects a reversed date range", () => {
    expect(() =>
      buildSearchInput({
        query: "test",
        publishedAfter: new Date("2026-11-02"),
        publishedBefore: new Date("2026-11-01"),
      }),
    ).toThrow(/later than/);
  });
});

describe("searchWeb", () => {
  beforeEach(() => agentCoreMock.reset());

  it("maps results to sources and handles missing fields", async () => {
    agentCoreMock.on(InvokeWebSearchCommand).resolves({
      results: [
        {
          title: "Lambda runtimes",
          url: "https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html",
          text: "Node.js 24 is supported.",
          publishedAt: new Date("2026-11-01T08:00:00Z"),
        },
        { text: "Extract without title and URL" },
      ],
    });
    const sources = await searchWeb(new BedrockAgentCoreClient({}), { query: "Node.js 24 Lambda" });
    expect(sources).toEqual([
      {
        title: "Lambda runtimes",
        url: "https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html",
        publishedAt: "2026-11-01T08:00:00.000Z",
        excerpt: "Node.js 24 is supported.",
      },
      { title: "Untitled", url: undefined, publishedAt: undefined, excerpt: "Extract without title and URL" },
    ]);
  });
});
