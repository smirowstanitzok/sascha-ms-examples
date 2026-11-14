// src/keys.ts
import type { Brand } from "./brand.js";
import type { BookId, MemberId } from "./ids.js";

// Composite DynamoDB keys get their own brand as well.
export type PartitionKey = Brand<string, "PartitionKey">;
export type SortKey = Brand<string, "SortKey">;

export const memberPk = (id: MemberId) => `MEMBER#${id}` as PartitionKey;
export const loanSk = (id: BookId) => `LOAN#${id}` as SortKey;
