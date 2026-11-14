// src/handler.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoLoanRepository } from "./dynamo-repository.js";
import { lendBook, type LoanRepository } from "./loan-service.js";
import { LoanRequest } from "./schemas.js";

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function createHandler(repo: LoanRepository) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    let raw: unknown;
    try {
      raw = JSON.parse(event.body ?? "{}");
    } catch {
      return json(400, { message: "Body is not valid JSON" });
    }

    // At the system boundary, a string becomes a MemberId or BookId.
    const parsed = LoanRequest.safeParse(raw);
    if (!parsed.success) {
      return json(400, { message: "Invalid request", issues: parsed.error.issues.map((i) => i.path.join(".")) });
    }

    const { memberId, bookId, days } = parsed.data;
    const loan = await lendBook(repo, memberId, bookId, days);
    return json(201, loan);
  };
}

export const handler = createHandler(new DynamoLoanRepository(process.env.TABLE_NAME ?? "library-loans"));
