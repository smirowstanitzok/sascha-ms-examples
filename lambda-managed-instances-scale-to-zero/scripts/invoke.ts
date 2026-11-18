// scripts/invoke.ts
// Invokes the function synchronously and waits patiently if it is currently scaled to zero.
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { withBackoff } from '../src/backoff';

const functionName = process.argv[2] ?? 'bike-rental-reports-dev-maintenanceReport';

// maxAttempts: 1 turns off the SDK's own retries – we are in control
const client = new LambdaClient({ maxAttempts: 1 });

const payload = {
  stationId: 'harbor-east',
  rentals: [
    { bikeId: 'bike-07', kilometers: 320 },
    { bikeId: 'bike-07', kilometers: 240 },
    { bikeId: 'bike-12', kilometers: 90 },
  ],
};

async function main() {
  const started = Date.now();
  const response = await withBackoff(
    () => client.send(new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(payload)),
    })),
    { baseMs: 1_000, capMs: 30_000, maxTotalMs: 8 * 60_000 },
    (attempt, delay) => console.log(`Throttled (429) – attempt ${attempt}, waiting ${Math.round(delay / 1000)} s`),
  );
  const body = Buffer.from(response.Payload ?? []).toString('utf8');
  console.log(`Response after ${Math.round((Date.now() - started) / 1000)} s:`, body);
}

main().catch((error) => {
  console.error('Invocation failed:', error);
  process.exitCode = 1;
});
