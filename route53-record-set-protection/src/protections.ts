// src/protections.ts
import type { RRType } from "@aws-sdk/client-route-53";

export interface WantedProtection {
  name: string; // full name, e.g. "bikerental.example"
  type: RRType;
  comment?: string; // max. 256 characters, shown in the error message
}

export interface ProtectionKey {
  name: string;
  type: string;
}

// Route 53 returns names with a trailing dot and special characters in octal (\052 = *)
export function normalizeName(name: string): string {
  return name.replace(/\\052/g, "*").replace(/\.$/, "").toLowerCase();
}

const keyOf = (p: ProtectionKey) => `${normalizeName(p.name)}|${p.type}`;

export function diffProtections(
  wanted: WantedProtection[],
  existing: ProtectionKey[],
): { missing: WantedProtection[]; unexpected: ProtectionKey[] } {
  const existingKeys = new Set(existing.map(keyOf));
  const wantedKeys = new Set(wanted.map(keyOf));
  return {
    missing: wanted.filter((w) => !existingKeys.has(keyOf(w))),
    unexpected: existing.filter((e) => !wantedKeys.has(keyOf(e))),
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
