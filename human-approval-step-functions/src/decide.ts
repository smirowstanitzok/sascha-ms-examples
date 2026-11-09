// src/decide.ts
import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SFNClient, SendTaskSuccessCommand, TaskTimedOut, InvalidToken } from '@aws-sdk/client-sfn';
import type { APIGatewayProxyResultV2, LambdaFunctionURLEventWithIAMAuthorizer } from 'aws-lambda';
import { parseDecision } from './approvals.js';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sfn = new SFNClient({});

const reply = (statusCode: number, body: object): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event: LambdaFunctionURLEventWithIAMAuthorizer): Promise<APIGatewayProxyResultV2> => {
  // With AuthType AWS_IAM, this tells you who signed the request
  const decidedBy = event.requestContext.authorizer?.iam?.userArn;
  if (!decidedBy) return reply(403, { message: 'IAM signature required' });

  let input;
  try {
    input = parseDecision(event.isBase64Encoded && event.body
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body);
  } catch (error) {
    return reply(400, { message: (error as Error).message });
  }

  const table = process.env.TABLE_NAME;
  const { Item } = await db.send(new GetCommand({ TableName: table, Key: { approvalId: input.approvalId } }));
  if (!Item) return reply(404, { message: 'Approval not found' });

  // Four-eyes principle: whoever requested the credit must not approve it
  if (decidedBy === Item.request.requestedBy) {
    return reply(403, { message: 'You cannot approve your own request' });
  }

  // Only one decision per approval: the first click wins
  try {
    await db.send(new UpdateCommand({
      TableName: table,
      Key: { approvalId: input.approvalId },
      UpdateExpression: 'SET #s = :decided, decidedBy = :by, decidedAt = :at',
      ConditionExpression: '#s = :pending',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':decided': input.decision.toUpperCase(),
        ':pending': 'PENDING',
        ':by': decidedBy,
        ':at': new Date().toISOString(),
      },
    }));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return reply(409, { message: 'Someone has already decided' });
    }
    throw error;
  }

  try {
    await sfn.send(new SendTaskSuccessCommand({
      taskToken: Item.taskToken,
      output: JSON.stringify({ decision: input.decision, decidedBy, comment: input.comment ?? '' }),
    }));
  } catch (error) {
    if (error instanceof TaskTimedOut || error instanceof InvalidToken) {
      // Deadline passed or workflow already moved on (e.g. escalated)
      await db.send(new UpdateCommand({
        TableName: table,
        Key: { approvalId: input.approvalId },
        UpdateExpression: 'SET #s = :expired',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':expired': 'EXPIRED' },
      }));
      return reply(410, { message: 'The deadline for this approval has passed' });
    }
    throw error;
  }

  return reply(200, { message: `Decision saved: ${input.decision}` });
};
