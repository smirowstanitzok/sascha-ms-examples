// src/loan-service.ts
import { newLoanId, type BookId, type LoanId, type MemberId } from "./ids.js";
import { cents, type Cents } from "./money.js";

export interface Loan {
  loanId: LoanId;
  memberId: MemberId;
  bookId: BookId;
  dueDate: string;
  lateFeePerDay: Cents;
}

export interface LoanRepository {
  save(loan: Loan): Promise<void>;
}

const LATE_FEE_PER_DAY = cents(50);

// The parameter order is now type-checked:
// lendBook(bookId, memberId) no longer compiles.
export async function lendBook(
  repo: LoanRepository,
  member: MemberId,
  book: BookId,
  days: number,
  now: Date = new Date(),
): Promise<Loan> {
  const due = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const loan: Loan = {
    loanId: newLoanId(),
    memberId: member,
    bookId: book,
    dueDate: due.toISOString().slice(0, 10),
    lateFeePerDay: LATE_FEE_PER_DAY,
  };
  await repo.save(loan);
  return loan;
}
