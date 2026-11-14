// src/schemas.ts
import { z } from "zod";
import { bookId, memberId } from "./ids.js";

// Zod checks the format, the smart constructors return the branded types.
export const LoanRequest = z.object({
  memberId: z.string().regex(/^M-\d{6}$/).transform(memberId),
  bookId: z.string().regex(/^B-\d{6}$/).transform(bookId),
  days: z.number().int().min(1).max(28).default(14),
});

export type LoanRequest = z.output<typeof LoanRequest>;
