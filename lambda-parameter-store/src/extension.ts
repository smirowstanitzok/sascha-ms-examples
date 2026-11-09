// src/extension.ts – alternative: read parameters via the AWS Parameters and Secrets Lambda Extension
const port = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? '2773';

export async function getViaExtension(name: string, decrypt = false): Promise<string> {
  const url = `http://localhost:${port}/systemsmanager/parameters/get?name=${encodeURIComponent(name)}&withDecryption=${decrypt}`;
  const response = await fetch(url, {
    headers: { 'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN ?? '' },
  });
  if (!response.ok) {
    throw new Error(`Extension answered with ${response.status}`);
  }
  // The extension returns the GetParameter response as JSON
  const body = (await response.json()) as { Parameter: { Value: string } };
  return body.Parameter.Value;
}
