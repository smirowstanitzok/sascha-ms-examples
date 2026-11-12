// src/handler.ts
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { signDownload } from "./sign-download";
import { loadPrivateKey } from "./private-key";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BOOK_ID = /^[a-z0-9-]{3,64}$/;

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const readerId = event.requestContext.authorizer.jwt.claims.sub as string | undefined;
  const bookId = event.pathParameters?.bookId ?? "";
  if (!readerId) return json(401, { message: "Not signed in" });
  if (!BOOK_ID.test(bookId)) return json(400, { message: "Invalid book ID" });

  // Is the book currently on loan to this reader?
  const loan = await db.send(
    new GetCommand({ TableName: process.env.LOANS_TABLE, Key: { readerId, bookId } }),
  );
  const dueAt = loan.Item?.dueAt as string | undefined;
  if (!dueAt || new Date(dueAt) < new Date()) {
    return json(403, { message: "No active loan for this book" });
  }

  const privateKey = await loadPrivateKey(process.env.PRIVATE_KEY_PARAM!);
  const download = signDownload({
    domain: process.env.DOWNLOAD_DOMAIN!,
    objectKey: `books/${bookId}.pdf`,
    keyPairId: process.env.KEY_PAIR_ID!,
    privateKey,
    validForSeconds: 10 * 60,
  });

  console.log(JSON.stringify({ msg: "download signed", bookId, expiresAt: download.expiresAt }));
  return json(200, download);
};
