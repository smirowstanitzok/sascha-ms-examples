// src/handlers/create-loan.ts
import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import createError from 'http-errors';
import { randomUUID } from 'node:crypto';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { correlationId, type CorrelatedContext } from '../middlewares/correlation-id.js';
import { validateBody, type Check } from '../middlewares/validate-body.js';

interface LoanRequest {
  bookId: string;
  memberId: string;
  days: number;
}

type LoanEvent = Omit<APIGatewayProxyEventV2, 'body'> & { body: LoanRequest };

const checkLoanRequest: Check<LoanRequest> = (body) => {
  const problems: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.bookId !== 'string' || b.bookId.length === 0) problems.push('bookId is required');
  if (typeof b.memberId !== 'string' || b.memberId.length === 0) problems.push('memberId is required');
  if (!Number.isInteger(b.days) || (b.days as number) < 1 || (b.days as number) > 28) {
    problems.push('days must be a whole number between 1 and 28');
  }
  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, value: { bookId: b.bookId as string, memberId: b.memberId as string, days: b.days as number } };
};

// Pure business logic: no parsing, no error formatting, no headers
const createLoan = async (
  event: LoanEvent,
  context: CorrelatedContext,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const { bookId, memberId, days } = event.body;
  if (bookId.startsWith('ref-')) {
    throw createError(409, 'Reference books cannot be borrowed');
  }
  const dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  console.log(JSON.stringify({ msg: 'loan created', correlationId: context.correlationId, bookId }));
  return {
    statusCode: 201,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loanId: randomUUID(), bookId, memberId, dueDate }),
  };
};

export const handler = middy<LoanEvent, APIGatewayProxyStructuredResultV2, Error, CorrelatedContext>()
  .use(httpHeaderNormalizer())
  .use(correlationId())
  .use(httpErrorHandler({ fallbackMessage: 'Internal error' }))
  .use(httpJsonBodyParser())
  .use(validateBody(checkLoanRequest))
  .handler(createLoan);
