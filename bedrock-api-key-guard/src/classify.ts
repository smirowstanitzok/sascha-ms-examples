// src/classify.ts
// Pure logic without AWS calls: decides whether a CloudTrail event is worth an alert.

export interface CloudTrailDetail {
  eventSource: string;
  eventName: string;
  eventTime: string;
  awsRegion: string;
  sourceIPAddress?: string;
  userAgent?: string;
  userIdentity?: {
    type?: string;
    arn?: string;
    userName?: string;
    sessionContext?: { sessionIssuer?: { arn?: string } };
  };
  requestParameters?: Record<string, unknown> | null;
  additionalEventData?: Record<string, unknown> | null;
}

export type Severity = 'HIGH' | 'MEDIUM';

export interface Finding {
  kind: 'KEY_CREATED' | 'KEY_USED';
  severity: Severity;
  principal: string;
  subject: string;
  body: string;
  /** Only set for usage: one alert per principal and time window is enough. */
  dedupKey?: string;
}

const BEDROCK_SERVICE = 'bedrock.amazonaws.com';
const MAX_DAYS_WITHOUT_WARNING = 90;

/** For roles, the role counts, not the individual session. Otherwise the allow list never matches. */
export function principalOf(detail: CloudTrailDetail): string {
  const identity = detail.userIdentity ?? {};
  return identity.sessionContext?.sessionIssuer?.arn ?? identity.arn ?? 'unknown';
}

export function parseAllowList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** SNS allows at most 100 characters in the subject. */
function subjectLine(text: string): string {
  return text.length <= 100 ? text : `${text.slice(0, 97)}...`;
}

function contextLines(detail: CloudTrailDetail): string[] {
  return [
    `Time: ${detail.eventTime}`,
    `Region: ${detail.awsRegion}`,
    `Call: ${detail.eventSource} ${detail.eventName}`,
    `Source IP: ${detail.sourceIPAddress ?? '-'}`,
    `User-Agent: ${detail.userAgent ?? '-'}`,
  ];
}

export function classify(detail: CloudTrailDetail, allowList: string[]): Finding | null {
  const params = detail.requestParameters ?? {};
  const principal = principalOf(detail);

  // Case 1: someone creates a long-term Bedrock API key.
  if (
    detail.eventSource === 'iam.amazonaws.com' &&
    detail.eventName === 'CreateServiceSpecificCredential' &&
    params.serviceName === BEDROCK_SERVICE
  ) {
    const userName = String(params.userName ?? 'unknown');
    const days = typeof params.credentialAgeDays === 'number' ? params.credentialAgeDays : undefined;
    const severity: Severity =
      days === undefined || days > MAX_DAYS_WITHOUT_WARNING ? 'HIGH' : 'MEDIUM';
    const lifetime = days === undefined ? 'no expiry date' : `valid for ${days} days`;

    return {
      kind: 'KEY_CREATED',
      severity,
      principal,
      subject: subjectLine(`[${severity}] New Bedrock API key for ${userName}`),
      body: [
        `A long-term Bedrock API key was created (${lifetime}).`,
        `Created by: ${principal}`,
        `Associated IAM user: ${userName}`,
        ...contextLines(detail),
        '',
        'Check: is there an approved request for this? If not, deactivate the key immediately:',
        `aws iam list-service-specific-credentials --user-name ${userName} --service-name ${BEDROCK_SERVICE}`,
      ].join('\n'),
    };
  }

  // Case 2: a Bedrock call was authenticated with an API key (bearer token).
  if (
    detail.eventSource === BEDROCK_SERVICE &&
    detail.additionalEventData?.callWithBearerToken === true
  ) {
    if (allowList.includes(principal)) {
      return null;
    }
    // Long-term keys always belong to an IAM user, short-term keys inherit a session.
    const isIamUser = detail.userIdentity?.type === 'IAMUser';
    const keyHint = isIamUser
      ? 'probably a long-term key (IAM user)'
      : 'probably a short-term key (generated from a session)';
    const modelId = String(params.modelId ?? '-');
    const severity: Severity = isIamUser ? 'HIGH' : 'MEDIUM';

    return {
      kind: 'KEY_USED',
      severity,
      principal,
      dedupKey: `${principal}#bearer`,
      subject: subjectLine(`[${severity}] Bedrock API key used by ${principal.split('/').pop()}`),
      body: [
        `A principal that is not on the allow list called Bedrock with an API key (${keyHint}).`,
        `Principal: ${principal}`,
        `Model: ${modelId}`,
        ...contextLines(detail),
        '',
        'Further calls by this principal will not be reported again within the time window.',
      ].join('\n'),
    };
  }

  return null;
}
