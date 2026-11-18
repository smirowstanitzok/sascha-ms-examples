// scripts/get-token.ts
// Fetches an access token via the OAuth 2.0 client credentials flow
// Usage: npx tsx scripts/get-token.ts <TokenUrl> <ClientId> <ClientSecret> <Scope>
const [tokenUrl, clientId, clientSecret, scope] = process.argv.slice(2);

if (!tokenUrl || !clientId || !clientSecret || !scope) {
  console.error('Usage: npx tsx scripts/get-token.ts <TokenUrl> <ClientId> <ClientSecret> <Scope>');
  process.exit(1);
}

async function main(): Promise<void> {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  });
  if (!response.ok) {
    console.error(`Token endpoint responded with ${response.status}: ${await response.text()}`);
    process.exit(1);
  }
  const { access_token } = (await response.json()) as { access_token: string };
  console.log(access_token);
}

main();
