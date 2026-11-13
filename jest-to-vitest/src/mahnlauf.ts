// src/mahnlauf.ts
import sendeErinnerung from "./erinnerung";
import { istUeberfaellig } from "./leihfrist";

export interface Ausleihe {
  leserId: string;
  titel: string;
  rueckgabe: string;
}

// Sends exactly one reminder for every overdue loan
export async function mahnlauf(ausleihen: Ausleihe[]): Promise<number> {
  const faellig = ausleihen.filter((a) => istUeberfaellig(new Date(a.rueckgabe)));
  for (const a of faellig) {
    await sendeErinnerung(a.leserId, a.titel);
  }
  return faellig.length;
}
