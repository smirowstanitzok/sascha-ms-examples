// src/gebuehr.ts
// Pure function: calculates the rental fee in cents.
export const PREIS_PRO_STUNDE_CENT = 300;
export const TAGESHOECHSTPREIS_CENT = 2500;

export function berechneGebuehr(startIso: string, endeIso: string): number {
  const dauerMs = Date.parse(endeIso) - Date.parse(startIso);
  if (Number.isNaN(dauerMs) || dauerMs < 0) {
    throw new RangeError('Invalid time range');
  }
  const angefangeneStunden = Math.max(1, Math.ceil(dauerMs / 3_600_000));
  const tage = Math.floor(angefangeneStunden / 24);
  const reststunden = angefangeneStunden % 24;
  const restpreis = Math.min(reststunden * PREIS_PRO_STUNDE_CENT, TAGESHOECHSTPREIS_CENT);
  return tage * TAGESHOECHSTPREIS_CENT + restpreis;
}
