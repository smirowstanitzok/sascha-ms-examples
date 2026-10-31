// test/decide.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { SFNClient, SendTaskSuccessCommand, TaskTimedOut } from '@aws-sdk/client-sfn';
import type { LambdaFunctionURLEventWithIAMAuthorizer } from 'aws-lambda';
import { handler } from '../src/decide.js';

const db = mockClient(DynamoDBDocumentClient);
const sfn = mockClient(SFNClient);

const APPROVAL_ID = '7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f';
const AGENT = 'arn:aws:sts::111122223333:assumed-role/support-agent/session-1';
const LEAD = 'arn:aws:sts::111122223333:assumed-role/credit-approvers/lena';

function event(body: object, userArn?: string) {
  return {
    body: JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: { authorizer: userArn ? { iam: { userArn } } : undefined },
  } as unknown as LambdaFunctionURLEventWithIAMAuthorizer;
}

const pending = {
  approvalId: APPROVAL_ID,
  taskToken: 'token-123',
  status: 'PENDING',
  request: { orderId: 'B-1001', amountCents: 4500, reason: 'Book damaged', requestedBy: AGENT },
};

describe('decide', () => {
  beforeEach(() => {
    db.reset();
    sfn.reset();
    process.env.TABLE_NAME = 'approvals';
  });

  it('resumes the workflow on approval', async () => {
    db.on(GetCommand).resolves({ Item: pending });
    db.on(UpdateCommand).resolves({});
    sfn.on(SendTaskSuccessCommand).resolves({});

    const res = await handler(event({ approvalId: APPROVAL_ID, decision: 'approved', comment: 'looks fine' }, LEAD));

    expect(res).toMatchObject({ statusCode: 200 });
    const sent = sfn.commandCalls(SendTaskSuccessCommand)[0].args[0].input;
    expect(sent.taskToken).toBe('token-123');
    expect(JSON.parse(sent.output!)).toEqual({ decision: 'approved', decidedBy: LEAD, comment: 'looks fine' });
  });

  it('rejects requests without an IAM signature', async () => {
    const res = await handler(event({ approvalId: APPROVAL_ID, decision: 'approved' }));
    expect(res).toMatchObject({ statusCode: 403 });
  });

  it('prevents the agent from approving itself', async () => {
    db.on(GetCommand).resolves({ Item: pending });
    const res = await handler(event({ approvalId: APPROVAL_ID, decision: 'approved' }, AGENT));
    expect(res).toMatchObject({ statusCode: 403 });
    expect(sfn.commandCalls(SendTaskSuccessCommand)).toHaveLength(0);
  });

  it('returns 409 when someone has already decided', async () => {
    db.on(GetCommand).resolves({ Item: { ...pending, status: 'APPROVED' } });
    db.on(UpdateCommand).rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const res = await handler(event({ approvalId: APPROVAL_ID, decision: 'rejected' }, LEAD));
    expect(res).toMatchObject({ statusCode: 409 });
  });

  it('returns 410 when the deadline has passed', async () => {
    db.on(GetCommand).resolves({ Item: pending });
    db.on(UpdateCommand).resolves({});
    sfn.on(SendTaskSuccessCommand).rejects(new TaskTimedOut({ message: 'closed', $metadata: {} }));
    const res = await handler(event({ approvalId: APPROVAL_ID, decision: 'approved' }, LEAD));
    expect(res).toMatchObject({ statusCode: 410 });
  });

  it('validates the input', async () => {
    const res = await handler(event({ approvalId: 'abc', decision: 'maybe' }, LEAD));
    expect(res).toMatchObject({ statusCode: 400 });
  });
});
