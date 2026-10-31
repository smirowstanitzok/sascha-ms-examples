// test/request-approval.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { handler } from '../src/request-approval.js';

const db = mockClient(DynamoDBDocumentClient);
const sns = mockClient(SNSClient);

describe('requestApproval', () => {
  beforeEach(() => {
    db.reset();
    sns.reset();
    process.env.TABLE_NAME = 'approvals';
    process.env.TOPIC_ARN = 'arn:aws:sns:eu-central-1:111122223333:approvals';
  });

  it('stores the token and sends only the approval ID', async () => {
    db.on(PutCommand).resolves({});
    sns.on(PublishCommand).resolves({ MessageId: '1' });

    const { approvalId } = await handler({
      taskToken: 'secret-token',
      stage: 'team',
      executionId: 'arn:aws:states:eu-central-1:111122223333:execution:credit:abc',
      request: { orderId: 'B-1001', amountCents: 4500, reason: 'Book damaged', requestedBy: 'agent' },
    });

    const item = db.commandCalls(PutCommand)[0].args[0].input.Item!;
    expect(item.taskToken).toBe('secret-token');
    expect(item.status).toBe('PENDING');

    const message = sns.commandCalls(PublishCommand)[0].args[0].input.Message!;
    expect(message).toContain(approvalId);
    expect(message).toMatch(/45\.00/);
    expect(message).not.toContain('secret-token');
  });
});
