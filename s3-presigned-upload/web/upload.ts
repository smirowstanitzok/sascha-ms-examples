// web/upload.ts
// Runs in the browser: fetches the signed form fields and sends the file straight to S3
export async function ladeSchadensfotoHoch(
  apiBasis: string,
  ausleihId: string,
  datei: File,
): Promise<string> {
  const antwort = await fetch(`${apiBasis}/ausleihen/${ausleihId}/schadensfotos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: datei.type }),
  });
  if (!antwort.ok) throw new Error(`Upload URL rejected: ${antwort.status}`);

  const { url, fields, key } = (await antwort.json()) as {
    url: string;
    fields: Record<string, string>;
    key: string;
  };

  const formular = new FormData();
  for (const [name, wert] of Object.entries(fields)) formular.append(name, wert);
  formular.append("file", datei); // must be the last field

  const upload = await fetch(url, { method: "POST", body: formular });
  // On success, S3 responds with 204 No Content by default
  if (upload.status !== 204) {
    throw new Error(`Upload failed: ${upload.status} ${await upload.text()}`);
  }
  return key;
}
