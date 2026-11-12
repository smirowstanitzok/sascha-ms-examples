// src/store.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = process.env.SESSIONS_TABLE!;

export interface SessionRecord {
  sessionId: string;
  microvmId: string;
  endpoint: string;
  expiresAt: number; // epoch seconds, used as DynamoDB TTL
}

export async function saveSession(record: SessionRecord): Promise<void> {
  await db.send(new PutCommand({ TableName, Item: record }));
}

export async function loadSession(sessionId: string): Promise<SessionRecord | undefined> {
  const { Item } = await db.send(new GetCommand({ TableName, Key: { sessionId } }));
  return Item as SessionRecord | undefined;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName, Key: { sessionId } }));
}
