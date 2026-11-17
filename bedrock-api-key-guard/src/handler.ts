// src/handler.ts
import type { EventBridgeEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
  DynamoDBClient,
  PutItemCommand,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import { classify, parseAllowList, type CloudTrailDetail, type Finding } from './classify.js';

export interface Deps {
  publish: (subject: string, message: string) => Promise<void>;
  /** Returns true if no alert has been sent for this key within the time window yet. */
  claimAlert: (dedupKey: string, nowSeconds: number) => Promise<boolean>;
  allowList: string[];
  now: () => number;
}

type CloudTrailEvent = EventBridgeEvent<'AWS API Call via CloudTrail', CloudTrailDetail>;

export function createHandler(deps: Deps) {
  return async (event: CloudTrailEvent): Promise<'alerted' | 'ignored' | 'deduplicated'> => {
    const finding: Finding | null = classify(event.detail, deps.allowList);
    if (!finding) {
      return 'ignored';
    }
    if (finding.dedupKey) {
      const isFirst = await deps.claimAlert(finding.dedupKey, Math.floor(deps.now() / 1000));
      if (!isFirst) {
        return 'deduplicated';
      }
    }
    await deps.publish(finding.subject, finding.body);
    console.log(JSON.stringify({ level: 'WARN', kind: finding.kind, principal: finding.principal }));
    return 'alerted';
  };
}

// Wiring for Lambda: real clients, configuration from environment variables.
const sns = new SNSClient({});
const dynamo = new DynamoDBClient({});
const windowSeconds = Number(process.env.DEDUP_MINUTES ?? '60') * 60;

export const handler = createHandler({
  allowList: parseAllowList(process.env.ALLOWED_PRINCIPALS),
  now: () => Date.now(),
  publish: async (subject, message) => {
    await sns.send(new PublishCommand({ TopicArn: process.env.TOPIC_ARN, Subject: subject, Message: message }));
  },
  claimAlert: async (dedupKey, nowSeconds) => {
    try {
      await dynamo.send(
        new PutItemCommand({
          TableName: process.env.DEDUP_TABLE,
          Item: {
            pk: { S: dedupKey },
            expiresAt: { N: String(nowSeconds + windowSeconds) },
          },
          // TTL deletes with a delay, so our own timestamp is what counts.
          ConditionExpression: 'attribute_not_exists(pk) OR expiresAt < :now',
          ExpressionAttributeValues: { ':now': { N: String(nowSeconds) } },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return false;
      }
      throw error;
    }
  },
});
