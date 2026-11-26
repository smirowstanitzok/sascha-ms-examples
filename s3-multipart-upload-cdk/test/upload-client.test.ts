// test/upload-client.test.ts
// Runs the browser client against a fake API: one part fails once and is retried.
import { describe, expect, it } from "vitest";
import { uploadLargeFile } from "../web/upload-client.js";

describe("uploadLargeFile", () => {
  it("uploads all parts, retries a failed part and completes", async () => {
    const partSize = 4;
    const file = Object.assign(new Blob(["0123456789"], { type: "audio/x-m4b" }), { name: "demo.m4b" });
    const putAttempts = new Map<number, number>();
    const uploaded = new Map<number, number>();
    let completed = false;

    const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.endsWith("/uploads")) return ok({ id: "u1", key: "uploads/u1/demo.m4b", partSize, partCount: 3 });
      if (url.endsWith("/parts")) {
        const { partNumbers } = JSON.parse(String(init?.body));
        return ok({ parts: [{ partNumber: partNumbers[0], contentLength: 0, url: `https://s3.test/part/${partNumbers[0]}` }] });
      }
      if (url.startsWith("https://s3.test/part/")) {
        const n = Number(url.split("/").pop());
        const attempt = (putAttempts.get(n) ?? 0) + 1;
        putAttempts.set(n, attempt);
        if (n === 2 && attempt === 1) return new Response(null, { status: 500 });
        uploaded.set(n, (init?.body as Blob).size);
        return new Response(null, { status: 200 });
      }
      if (url.endsWith("/complete")) {
        completed = true;
        return ok({ key: "uploads/u1/demo.m4b", etag: '"x-3"' });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const progress: number[] = [];
    const result = await uploadLargeFile(file, {
      apiBase: "https://api.test",
      fetchFn,
      onProgress: (done) => progress.push(done),
    });

    expect(result.key).toBe("uploads/u1/demo.m4b");
    expect(completed).toBe(true);
    expect([...uploaded.entries()].sort()).toEqual([[1, 4], [2, 4], [3, 2]]);
    expect(putAttempts.get(2)).toBe(2);
    expect(progress.at(-1)).toBe(10);
  });
});
