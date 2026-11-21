// src/check-agent.ts
import { createHash } from 'node:crypto';
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from 'aws-lambda';
import { type AgentRecord, denialReason, scopeFromPath, statusFor, usageKey } from './agent-rules.ts';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.AGENT_TABLE ?? '';

const json = (statusCode: number, body: unknown): LambdaFunctionURLResult => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export async function handler(event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> {
  const token = event.headers['x-agent-token'];
  if (!token) return json(401, { reason: 'missing_token' });

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const scope = scopeFromPath(event.headers['x-requested-path'] ?? '/');
  const key = usageKey(new Date());

  try {
    // Check and count in a single, atomic write
    const res = await db.send(new UpdateCommand({
      TableName: TABLE,
      Key: { tokenHash },
      UpdateExpression: 'SET #used = if_not_exists(#used, :zero) + :one',
      ConditionExpression:
        'attribute_exists(tokenHash) AND #status = :active AND contains(scopes, :scope) ' +
        'AND (attribute_not_exists(#used) OR #used < dailyBudget)',
      ExpressionAttributeNames: { '#used': key, '#status': 'status' },
      ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':active': 'active', ':scope': scope },
      ReturnValues: 'ALL_NEW',
      ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
    }));
    const agent = res.Attributes as AgentRecord;
    return json(200, {
      agentId: agent.agentId,
      remaining: agent.dailyBudget - Number(agent[key]),
    });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      const old = err.Item ? (unmarshall(err.Item) as AgentRecord) : undefined;
      const reason = denialReason(old, scope, key);
      return json(statusFor(reason), { reason });
    }
    throw err;
  }
}
