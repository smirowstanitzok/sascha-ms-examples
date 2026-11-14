// src/dynamo-repository.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { loanSk, memberPk } from "./keys.js";
import type { Loan, LoanRepository } from "./loan-service.js";

export class DynamoLoanRepository implements LoanRepository {
  constructor(
    private readonly tableName: string,
    private readonly doc = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  ) {}

  async save(loan: Loan): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: memberPk(loan.memberId), sk: loanSk(loan.bookId), ...loan },
        // A member can only borrow the same book once at a time.
        ConditionExpression: "attribute_not_exists(sk)",
      }),
    );
  }
}
