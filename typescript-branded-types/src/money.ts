// src/money.ts
import type { Brand } from "./brand.js";

// Amounts are always whole cents, never decimal euros.
export type Cents = Brand<number, "Cents">;

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid cent amount: ${value}`);
  }
  return value as Cents;
}

export function addCents(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function formatEuro(value: Cents): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value / 100);
}
