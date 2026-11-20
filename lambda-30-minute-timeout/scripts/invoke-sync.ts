// scripts/invoke-sync.ts
import { Agent } from 'node:https';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const THIRTY_ONE_MINUTES = 31 * 60 * 1000;

// A client for synchronous calls that may take up to 30 minutes
const lambda = new LambdaClient({
  maxAttempts: 1, // no automatic retry: a retry would start a second run
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5_000,
    requestTimeout: THIRTY_ONE_MINUTES,
    httpsAgent: new Agent({ keepAlive: true, keepAliveMsecs: 60_000 }),
  }),
});

const functionName = process.argv[2];
if (!functionName) {
  console.error('Usage: node scripts/invoke-sync.ts <function-name>');
  process.exit(1);
}

// Same shape as an SQS event, so the handler can process it directly
const event = {
  Records: [{ messageId: 'manual-1', body: JSON.stringify({ orderId: 'demo-42', pageCount: 300 }) }],
};

const started = Date.now();
const response = await lambda.send(
  new InvokeCommand({
    FunctionName: functionName,
    Payload: new TextEncoder().encode(JSON.stringify(event)),
  }),
);
console.log(`Status ${response.StatusCode} after ${Math.round((Date.now() - started) / 1000)} s`);
if (response.FunctionError) console.error(new TextDecoder().decode(response.Payload));
