// src/add-book.ts
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { parseBook, textForEmbedding } from './book.ts';
import { embed } from './embed.ts';

const dynamodb = new DynamoDBClient({});

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  let book;
  try {
    book = parseBook(JSON.parse(event.body ?? '{}'));
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ message: (err as Error).message }) };
  }

  const embedding = await embed(textForEmbedding(book));

  await dynamodb.send(
    new PutItemCommand({
      TableName: process.env.BOOKS_TABLE,
      // number[] becomes a list of numbers (L of N) – exactly what the vector index expects
      Item: marshall({ ...book, embedding }),
    }),
  );

  return { statusCode: 201, body: JSON.stringify({ isbn: book.isbn }) };
}
