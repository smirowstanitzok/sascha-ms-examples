// src/pre-traffic-hook.ts
import { CodeDeployClient, PutLifecycleEventHookExecutionStatusCommand } from '@aws-sdk/client-codedeploy';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

interface CodeDeployHookEvent {
  DeploymentId: string;
  LifecycleEventHookExecutionId: string;
}

interface SmokeTest {
  name: string;
  query: Record<string, string>;
  expectStatus: number;
  expectPriceCents?: number;
}

export const SMOKE_TESTS: SmokeTest[] = [
  { name: 'kayak, 2 hours', query: { boat: 'kayak', hours: '2' }, expectStatus: 200, expectPriceCents: 1000 },
  { name: 'canoe, daily cap', query: { boat: 'canoe', hours: '10' }, expectStatus: 200, expectPriceCents: 4200 },
  { name: 'unknown boat type', query: { boat: 'yacht', hours: '1' }, expectStatus: 400 },
];

// Pure check, easy to unit test: returns an error text or null.
export function checkResponse(test: SmokeTest, payload: unknown): string | null {
  const res = payload as { statusCode?: number; body?: string } | undefined;
  if (res?.statusCode !== test.expectStatus) {
    return `${test.name}: expected status ${test.expectStatus}, got ${res?.statusCode}`;
  }
  if (test.expectPriceCents !== undefined) {
    const body = JSON.parse(res.body ?? '{}') as { priceCents?: number };
    if (body.priceCents !== test.expectPriceCents) {
      return `${test.name}: expected ${test.expectPriceCents} cents, got ${body.priceCents}`;
    }
  }
  return null;
}

const lambda = new LambdaClient({});
const codedeploy = new CodeDeployClient({});

export const handler = async (event: CodeDeployHookEvent): Promise<void> => {
  const target = process.env.TARGET_VERSION_ARN;
  const failures: string[] = [];

  for (const test of SMOKE_TESTS) {
    try {
      const result = await lambda.send(
        new InvokeCommand({
          FunctionName: target,
          Payload: Buffer.from(JSON.stringify({ queryStringParameters: test.query })),
        }),
      );
      if (result.FunctionError) {
        failures.push(`${test.name}: function error ${result.FunctionError}`);
        continue;
      }
      const payload = JSON.parse(Buffer.from(result.Payload ?? []).toString('utf8'));
      const problem = checkResponse(test, payload);
      if (problem) failures.push(problem);
    } catch (err) {
      failures.push(`${test.name}: ${(err as Error).message}`);
    }
  }

  const status = failures.length === 0 ? 'Succeeded' : 'Failed';
  console.log(JSON.stringify({ target, status, failures }));

  // Without this callback CodeDeploy waits up to one hour and then fails.
  await codedeploy.send(
    new PutLifecycleEventHookExecutionStatusCommand({
      deploymentId: event.DeploymentId,
      lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
      status,
    }),
  );
};
