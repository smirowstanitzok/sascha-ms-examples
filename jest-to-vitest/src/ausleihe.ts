// src/ausleihe.ts
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { berechneRueckgabe } from "./leihfrist";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const tabelle = process.env.TABELLE;
  if (!tabelle) throw new Error("TABELLE is missing");

  const body = JSON.parse(event.body ?? "{}") as { buchId?: string; leserId?: string };
  if (!body.buchId || !body.leserId) {
    return { statusCode: 400, body: JSON.stringify({ fehler: "buchId and leserId are required" }) };
  }

  const rueckgabe = berechneRueckgabe(new Date()).toISOString();
  try {
    await ddb.send(
      new PutCommand({
        TableName: tabelle,
        Item: { pk: `BUCH#${body.buchId}`, leserId: body.leserId, rueckgabe },
        // A book can only be on loan once at a time
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return { statusCode: 409, body: JSON.stringify({ fehler: "Book is already on loan" }) };
    }
    throw err;
  }
  return { statusCode: 201, body: JSON.stringify({ buchId: body.buchId, rueckgabe }) };
}
