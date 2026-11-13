// test/ausleihe.test.ts
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "../src/ausleihe";

const ddbMock = mockClient(DynamoDBDocumentClient);
const anfrage = (body: object) => ({ body: JSON.stringify(body) }) as APIGatewayProxyEventV2;

describe("ausleihe", () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.TABELLE = "ausleihen";
  });

  it("creates a loan", async () => {
    ddbMock.on(PutCommand).resolves({});
    const antwort = await handler(anfrage({ buchId: "b-42", leserId: "l-7" }));
    expect(antwort).toMatchObject({ statusCode: 201 });
    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "ausleihen",
      Item: expect.objectContaining({ pk: "BUCH#b-42", leserId: "l-7" }),
    });
  });

  it("returns 409 when the book is already on loan", async () => {
    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: "taken", $metadata: {} }));
    const antwort = await handler(anfrage({ buchId: "b-42", leserId: "l-7" }));
    expect(antwort).toMatchObject({ statusCode: 409 });
  });

  it("rejects incomplete requests", async () => {
    const antwort = await handler(anfrage({ buchId: "b-42" }));
    expect(antwort).toMatchObject({ statusCode: 400 });
    expect(ddbMock).not.toHaveReceivedCommand(PutCommand);
  });
});
