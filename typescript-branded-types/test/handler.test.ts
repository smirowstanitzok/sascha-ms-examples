// test/handler.test.ts
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createHandler } from "../src/handler.js";
import type { Loan, LoanRepository } from "../src/loan-service.js";

class InMemoryRepo implements LoanRepository {
  loans: Loan[] = [];
  async save(loan: Loan) {
    this.loans.push(loan);
  }
}

const event = (body: unknown) => ({ body: JSON.stringify(body) }) as APIGatewayProxyEventV2;

describe("POST /loans", () => {
  it("creates a loan", async () => {
    const repo = new InMemoryRepo();
    const res = (await createHandler(repo)(
      event({ memberId: "M-000042", bookId: "B-123456", days: 7 }),
    )) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(201);
    expect(repo.loans[0]).toMatchObject({ memberId: "M-000042", bookId: "B-123456", lateFeePerDay: 50 });
  });

  it("rejects swapped IDs with 400", async () => {
    const repo = new InMemoryRepo();
    const res = (await createHandler(repo)(
      event({ memberId: "B-123456", bookId: "M-000042" }),
    )) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(400);
    expect(repo.loans).toHaveLength(0);
  });
});
