// web/main.ts
import { uploadLargeFile } from "./upload-client.js";

const input = document.querySelector<HTMLInputElement>("#audiobook")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const result = await uploadLargeFile(file, {
      apiBase: "https://YOUR-API-ID.execute-api.eu-central-1.amazonaws.com",
      onProgress: (done, total) => {
        status.textContent = `${Math.round((done / total) * 100)} % uploaded`;
      },
    });
    status.textContent = `Done: ${result.key}`;
  } catch (err) {
    status.textContent = `Upload failed: ${(err as Error).message}`;
  }
});
