// test/upload-url.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// Signing works locally with dummy credentials, no request goes to AWS
beforeAll(() => {
  process.env.BUCKET_NAME = "radverleih-test";
  process.env.AWS_REGION = "eu-central-1";
  process.env.AWS_ACCESS_KEY_ID = "AKIDTEST";
  process.env.AWS_SECRET_ACCESS_KEY = "secret";
});

const anfrage = (ausleihId: string, body: unknown) =>
  ({ pathParameters: { ausleihId }, body: JSON.stringify(body) }) as unknown as APIGatewayProxyEventV2;

describe("upload-url", () => {
  it("returns URL and form fields for a JPEG", async () => {
    const { handler } = await import("../src/upload-url");
    const res = (await handler(anfrage("A-1001", { contentType: "image/jpeg" }))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body as string);
    expect(body.key).toMatch(/^eingang\/A-1001\/[0-9a-f-]{36}\.jpg$/);
    expect(body.fields["Content-Type"]).toBe("image/jpeg");
    const policy = JSON.parse(Buffer.from(body.fields.Policy, "base64").toString());
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 5242880]);
  });

  it("rejects SVG with 415", async () => {
    const { handler } = await import("../src/upload-url");
    const res = (await handler(anfrage("A-1001", { contentType: "image/svg+xml" }))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(415);
  });

  it("rejects a tampered rental ID", async () => {
    const { handler } = await import("../src/upload-url");
    const res = (await handler(anfrage("../admin", { contentType: "image/png" }))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(400);
  });
});
