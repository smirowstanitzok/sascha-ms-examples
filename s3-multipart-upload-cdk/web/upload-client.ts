// web/upload-client.ts
// Browser client: slice the file into parts, upload in parallel, retry on errors.

interface StartResponse {
  id: string;
  key: string;
  partSize: number;
  partCount: number;
}

interface SignedPart {
  partNumber: number;
  contentLength: number;
  url: string;
}

export interface UploadOptions {
  apiBase: string; // e.g. https://abc123.execute-api.eu-central-1.amazonaws.com
  concurrency?: number; // how many parts run at the same time
  maxRetries?: number;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  fetchFn?: typeof fetch; // replaceable for tests
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadLargeFile(file: Blob & { name: string }, opts: UploadOptions) {
  const { apiBase, concurrency = 4, maxRetries = 3, onProgress, fetchFn = fetch } = opts;

  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetchFn(`${apiBase}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  };

  // 1. Register the upload
  const upload = await post<StartResponse>("/uploads", {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });

  const sign = async (partNumbers: number[]) =>
    (await post<{ parts: SignedPart[] }>(`/uploads/${upload.id}/parts`, { partNumbers })).parts;

  let uploadedBytes = 0;
  const queue = Array.from({ length: upload.partCount }, (_, i) => i + 1);

  // 2. Upload one part – with a fresh URL on every attempt
  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * upload.partSize;
    const chunk = file.slice(start, start + upload.partSize);
    for (let attempt = 0; ; attempt++) {
      try {
        const [signed] = await sign([partNumber]);
        const res = await fetchFn(signed.url, { method: "PUT", body: chunk });
        if (!res.ok) throw new Error(`Part ${partNumber}: HTTP ${res.status}`);
        uploadedBytes += chunk.size;
        onProgress?.(uploadedBytes, file.size);
        return;
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        await sleep(2 ** attempt * 500); // 0.5 s, 1 s, 2 s …
      }
    }
  };

  // 3. Several "workers" pull part numbers from the queue
  try {
    const worker = async () => {
      for (let n = queue.shift(); n !== undefined; n = queue.shift()) await uploadPart(n);
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, upload.partCount) }, worker));

    // 4. Complete – the server checks count and size of all parts
    return await post<{ key: string; etag: string }>(`/uploads/${upload.id}/complete`, {});
  } catch (err) {
    // Clean up so no orphaned parts cost storage
    await fetchFn(`${apiBase}/uploads/${upload.id}`, { method: "DELETE" }).catch(() => undefined);
    throw err;
  }
}
