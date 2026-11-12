// src/microvm.ts
import {
  CreateMicrovmAuthTokenCommand,
  GetMicrovmCommand,
  LambdaMicrovmsClient,
  RunMicrovmCommand,
  TerminateMicrovmCommand,
} from '@aws-sdk/client-lambda-microvms';

const client = new LambdaMicrovmsClient({});
const region = process.env.AWS_REGION ?? 'us-east-1';
const connector = (name: string) =>
  `arn:aws:lambda:${region}:aws:network-connector:aws-network-connector:${name}`;

export interface Sandbox {
  microvmId: string;
  endpoint: string;
}

// Starts a fresh MicroVM from the snapshot for one learner session
export async function startSandbox(sessionId: string): Promise<Sandbox> {
  const egress = process.env.EGRESS_CONNECTOR_ARN;
  const result = await client.send(
    new RunMicrovmCommand({
      imageIdentifier: process.env.IMAGE_ARN!,
      clientToken: sessionId, // idempotent: retries do not start a second VM
      runHookPayload: sessionId,
      ingressNetworkConnectors: [connector('HTTP_INGRESS')],
      // Without our own VPC connector the VM would have internet access
      ...(egress ? { egressNetworkConnectors: [egress] } : {}),
      idlePolicy: {
        autoResumeEnabled: true,
        maxIdleDurationSeconds: 600,
        suspendedDurationSeconds: 1800,
      },
      maximumDurationInSeconds: 3 * 60 * 60,
    }),
  );
  return { microvmId: result.microvmId!, endpoint: result.endpoint! };
}

// Waits briefly until the MicroVM accepts traffic
export async function waitUntilReady(microvmId: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { state, stateReason } = await client.send(
      new GetMicrovmCommand({ microvmIdentifier: microvmId }),
    );
    // SUSPENDED is fine: auto-resume holds the first request
    if (state === 'RUNNING' || state === 'SUSPENDED') return;
    if (state === 'TERMINATING' || state === 'TERMINATED') {
      throw new Error(`MicroVM ${microvmId} is no longer available: ${stateReason ?? state}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`MicroVM ${microvmId} was not ready within ${timeoutMs} ms`);
}

// Short-lived token, valid for port 8080 only
export async function authHeaderFor(microvmId: string): Promise<string> {
  const { authToken } = await client.send(
    new CreateMicrovmAuthTokenCommand({
      microvmIdentifier: microvmId,
      expirationInMinutes: 5,
      allowedPorts: [{ port: 8080 }],
    }),
  );
  const value = authToken?.['X-aws-proxy-auth'];
  if (!value) throw new Error('No auth token received');
  return value;
}

export async function stopSandbox(microvmId: string): Promise<void> {
  await client.send(new TerminateMicrovmCommand({ microvmIdentifier: microvmId }));
}
