// test/handler.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { handler } from "../src/handler";

const fake = vi.hoisted(() => ({
  lookupExact: vi.fn(),
  lookupSemantic: vi.fn(),
  store: vi.fn(),
  askModel: vi.fn(),
  embed: vi.fn(),
}));

vi.mock("../src/valkey", () => ({ getClient: async () => ({}), required: () => "v1" }));
vi.mock("../src/embed", () => ({ embed: fake.embed }));
vi.mock("../src/answer", () => ({ askModel: fake.askModel }));
vi.mock("../src/metrics", () => ({ recordRequest: () => undefined }));
vi.mock("../src/semantic-cache", () => ({
  lookupExact: fake.lookupExact,
  lookupSemantic: fake.lookupSemantic,
  store: fake.store,
}));

function call(body: unknown) {
  const event = { body: JSON.stringify(body) } as APIGatewayProxyEventV2;
  return handler(event) as Promise<APIGatewayProxyStructuredResultV2>;
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.embed.mockResolvedValue([0.1, 0.2]);
  fake.askModel.mockResolvedValue({ text: "Fresh from the model", inputTokens: 50, outputTokens: 20 });
});

describe("handler", () => {
  it("answers from the exact level without an embedding", async () => {
    fake.lookupExact.mockResolvedValue("From the cache");
    const res = await call({ question: "How long can I rent a bike?", topic: "rental" });
    expect(JSON.parse(res.body!).source).toBe("cache-exact");
    expect(fake.embed).not.toHaveBeenCalled();
  });

  it("uses a semantic hit below the threshold", async () => {
    fake.lookupExact.mockResolvedValue(undefined);
    fake.lookupSemantic.mockResolvedValue({ answer: "Up to 7 days", question: "x", distance: 0.04 });
    const res = await call({ question: "What is the maximum rental period?", topic: "rental" });
    expect(JSON.parse(res.body!).source).toBe("cache-semantic");
    expect(fake.askModel).not.toHaveBeenCalled();
  });

  it("asks the model when the distance is too large and stores the answer", async () => {
    fake.lookupExact.mockResolvedValue(undefined);
    fake.lookupSemantic.mockResolvedValue({ answer: "old", question: "x", distance: 0.3 });
    const res = await call({ question: "Do you have child seats?", topic: "rental" });
    expect(JSON.parse(res.body!).source).toBe("model");
    expect(fake.store).toHaveBeenCalledOnce();
  });

  it("bypasses the cache for personal questions", async () => {
    const res = await call({ question: "Where is my booking 4711815?", topic: "rental" });
    expect(JSON.parse(res.body!).source).toBe("no-cache");
    expect(fake.lookupExact).not.toHaveBeenCalled();
    expect(fake.store).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON", async () => {
    const res = await handler({ body: "{broken" } as APIGatewayProxyEventV2);
    expect((res as APIGatewayProxyStructuredResultV2).statusCode).toBe(400);
  });
});
