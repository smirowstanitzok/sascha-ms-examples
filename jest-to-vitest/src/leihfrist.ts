// src/leihfrist.ts
// Loan period of the fictional city library: 28 days from checkout
export const LEIHFRIST_TAGE = 28;

export function berechneRueckgabe(ausleihe: Date): Date {
  const rueckgabe = new Date(ausleihe);
  rueckgabe.setUTCDate(rueckgabe.getUTCDate() + LEIHFRIST_TAGE);
  return rueckgabe;
}

export function istUeberfaellig(rueckgabe: Date, jetzt: Date = new Date()): boolean {
  return jetzt.getTime() > rueckgabe.getTime();
}
