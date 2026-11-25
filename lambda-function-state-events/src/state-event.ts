// src/state-event.ts
// Pure functions without AWS calls: easy to test without mocks.

export type FunctionStateDetail = {
  action?: string;
  state?: string;
  stateReason?: string;
  stateReasonCode?: string;
  lastUpdateStatus?: string;
  lastUpdateStatusReasonCode?: string;
  revisionId?: string;
};

export type FunctionStateEvent = {
  id: string;
  'detail-type': string;
  source: string;
  time: string;
  region: string;
  resources: string[];
  detail: FunctionStateDetail;
};

export type Severity = 'error' | 'info' | 'ignore';

export type FunctionRef = {
  name: string;
  qualifier?: string;
};

const FAILURE_TYPES = new Set([
  'Event Function Version Activation Failed',
  'Event Function Version Update Failed',
]);

// arn:aws:lambda:eu-central-1:111122223333:function:radwerk-rentals:7
export function parseFunctionArn(arn: string): FunctionRef {
  const parts = arn.split(':');
  if (parts.length < 7 || parts[2] !== 'lambda' || parts[5] !== 'function') {
    throw new Error(`Not a Lambda function ARN: ${arn}`);
  }
  return { name: parts[6], qualifier: parts[7] };
}

export function classify(event: FunctionStateEvent): Severity {
  if (FAILURE_TYPES.has(event['detail-type'])) return 'error';
  if (
    event['detail-type'] === 'Event Function Version Activated' &&
    event.detail.action === 'PublishVersion'
  ) {
    return 'info';
  }
  return 'ignore';
}

// Key for duplicate detection: revisionId is unique per state change,
// only Deleting/Deleted share one (with a different detail-type).
export function dedupeKey(event: FunctionStateEvent): string {
  return `${event['detail-type']}#${event.detail.revisionId ?? event.id}`;
}

export function buildMessage(
  event: FunctionStateEvent,
  currentStatus?: string,
): { subject: string; body: string } {
  const fn = parseFunctionArn(event.resources[0] ?? '');
  const version = fn.qualifier ?? '$LATEST';
  const d = event.detail;

  if (classify(event) === 'info') {
    return {
      subject: `Version ${version} of ${fn.name} is ready`,
      body: [
        `Function: ${fn.name}`,
        `Version: ${version}`,
        `Time: ${event.time}`,
        'The version can be invoked now.',
      ].join('\n'),
    };
  }

  const reason = d.stateReason ?? 'no reason provided';
  const code = d.lastUpdateStatusReasonCode ?? d.stateReasonCode ?? 'unknown';
  const lines = [
    `Function: ${fn.name}`,
    `Version: ${version}`,
    `Event: ${event['detail-type']}`,
    `Triggered by: ${d.action ?? 'unknown'}`,
    `Reason: ${reason} (${code})`,
    `Time: ${event.time}`,
  ];
  if (currentStatus) lines.push(`Status according to GetFunction: ${currentStatus}`);
  // SNS allows at most 100 characters in the subject.
  const subject = `Deployment failed: ${fn.name}`.slice(0, 100);
  return { subject, body: lines.join('\n') };
}
