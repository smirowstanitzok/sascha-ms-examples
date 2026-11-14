// test/types.check.ts
// This file is not executed, only checked by "tsc --noEmit".
// Every line with @ts-expect-error MUST produce a type error.
import { z } from "zod";
import { bookId, memberId, type BookId, type MemberId } from "../src/ids.js";
import { lendBook, type LoanRepository } from "../src/loan-service.js";
import { cents, type Cents } from "../src/money.js";

declare const repo: LoanRepository;
const member = memberId("M-000042");
const book = bookId("B-123456");

void lendBook(repo, member, book, 14);

// @ts-expect-error – swapped parameters
void lendBook(repo, book, member, 14);

// @ts-expect-error – a plain string is not a BookId
const plain: BookId = "B-123456";

// A branded ID is still a string and can be read anywhere.
const asText: string = member;

// @ts-expect-error – decimal euros instead of cents
const fee: Cents = 0.5;

const total: number = cents(150) + cents(50); // result is just a number again

// @ts-expect-error – Zod brands and your own brands are different types
const fromZod: MemberId = z.string().brand<"MemberId">().parse("M-000042");

void plain, asText, fee, total, fromZod;
