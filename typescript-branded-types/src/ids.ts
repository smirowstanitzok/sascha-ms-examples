// src/ids.ts
import type { Brand } from "./brand.js";

export type MemberId = Brand<string, "MemberId">;
export type BookId = Brand<string, "BookId">;
export type LoanId = Brand<string, "LoanId">;

const MEMBER_ID = /^M-\d{6}$/;
const BOOK_ID = /^B-\d{6}$/;
const LOAN_ID = /^L-[0-9a-f]{8}$/;

// Smart constructors: the only way to a branded ID leads through a check.
export function memberId(raw: string): MemberId {
  if (!MEMBER_ID.test(raw)) {
    throw new Error(`Invalid member ID: ${raw}`);
  }
  return raw as MemberId;
}

export function bookId(raw: string): BookId {
  if (!BOOK_ID.test(raw)) {
    throw new Error(`Invalid book ID: ${raw}`);
  }
  return raw as BookId;
}

export function newLoanId(random: () => string = () => crypto.randomUUID()): LoanId {
  const id = `L-${random().replaceAll("-", "").slice(0, 8)}`;
  if (!LOAN_ID.test(id)) {
    throw new Error(`Invalid loan ID: ${id}`);
  }
  return id as LoanId;
}
