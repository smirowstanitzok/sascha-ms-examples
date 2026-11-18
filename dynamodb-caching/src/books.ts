// src/books.ts
import { GetItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { BOOKS_TABLE, cacheReady, dynamodb, isCacheActive } from "./catalog-client.js";

interface Book {
  authorId: string; // partition key, e.g. "mara-lindqvist"
  isbn: string; // sort key
  title: string;
  year: number;
  shelf: string;
}

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "x-cache-layer": isCacheActive() ? "on" : "off",
  },
  body: JSON.stringify(body),
});

// GET /authors/{authorId}/books/{isbn}
export const getBook = async (event: APIGatewayProxyEventV2) => {
  await cacheReady;
  const { authorId, isbn } = event.pathParameters ?? {};
  if (!authorId || !isbn) return json(400, { message: "authorId and isbn are required" });

  const result = await dynamodb.send(
    new GetItemCommand({
      TableName: BOOKS_TABLE,
      Key: marshall({ authorId, isbn }),
    }),
  );
  if (!result.Item) return json(404, { message: "Book not found" });
  return json(200, unmarshall(result.Item) as Book);
};

// GET /authors/{authorId}/books?fresh=true
export const listBooksByAuthor = async (event: APIGatewayProxyEventV2) => {
  await cacheReady;
  const authorId = event.pathParameters?.authorId;
  if (!authorId) return json(400, { message: "authorId is required" });

  // fresh=true forces a strongly consistent read and thereby refreshes the query cache
  const fresh = event.queryStringParameters?.fresh === "true";
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: BOOKS_TABLE,
      KeyConditionExpression: "authorId = :a",
      ExpressionAttributeValues: marshall({ ":a": authorId }),
      ConsistentRead: fresh,
    }),
  );
  const books = (result.Items ?? []).map((item) => unmarshall(item) as Book);
  return json(200, { authorId, fresh, books });
};

// PUT /authors/{authorId}/books/{isbn}
export const putBook = async (event: APIGatewayProxyEventV2) => {
  await cacheReady;
  const { authorId, isbn } = event.pathParameters ?? {};
  if (!authorId || !isbn) return json(400, { message: "authorId and isbn are required" });

  let input: Partial<Book>;
  try {
    input = JSON.parse(event.body ?? "{}") as Partial<Book>;
  } catch {
    return json(400, { message: "Body is not valid JSON" });
  }
  if (!input.title || typeof input.year !== "number" || !input.shelf) {
    return json(400, { message: "title, year (number) and shelf are required" });
  }

  const book: Book = { authorId, isbn, title: input.title, year: input.year, shelf: input.shelf };
  // Write-through: the write goes to DynamoDB, then the cache updates its entries
  await dynamodb.send(new PutItemCommand({ TableName: BOOKS_TABLE, Item: marshall(book) }));
  return json(200, book);
};
