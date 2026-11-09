// src/request-approval.ts
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { type ApprovalTask, KEEP_SECONDS, formatEuro } from './approvals.js';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});

export const handler = async (event: ApprovalTask): Promise<{ approvalId: string }> => {
  const approvalId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // The task token stays in DynamoDB. The message only contains the approvalId.
  await db.send(new PutCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      approvalId,
      taskToken: event.taskToken,
      stage: event.stage,
      executionId: event.executionId,
      request: event.request,
      status: 'PENDING',
      createdAt: new Date(now * 1000).toISOString(),
      expiresAt: now + KEEP_SECONDS,
    },
    ConditionExpression: 'attribute_not_exists(approvalId)',
  }));

  const { orderId, amountCents, reason, requestedBy } = event.request;
  await sns.send(new PublishCommand({
    TopicArn: process.env.TOPIC_ARN,
    Subject: `Approval needed: credit of ${formatEuro(amountCents)} for ${orderId}`,
    Message: [
      `The support agent (${requestedBy}) wants to issue a credit.`,
      `Order: ${orderId}`,
      `Amount: ${formatEuro(amountCents)}`,
      `Reason: ${reason}`,
      `Stage: ${event.stage === 'team' ? 'Team' : 'Team lead (escalation)'}`,
      '',
      `Approval ID: ${approvalId}`,
      'Decide with: ./decide.sh <approval ID> approved|rejected "comment"',
    ].join('\n'),
    MessageAttributes: { stage: { DataType: 'String', StringValue: event.stage } },
  }));

  return { approvalId };
};
