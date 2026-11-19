// src/rental-book.ts
import { priceInCent, type Rental } from './pricing.ts';

export class RentalBook {
  // No parameter properties (constructor(private readonly ...)),
  // because a compiler would have to turn them into JavaScript first.
  readonly #rentals: Rental[] = [];

  add(rental: Rental): void {
    this.#rentals.push(rental);
  }

  totalInCent(): number {
    return this.#rentals.reduce((sum, r) => sum + priceInCent(r), 0);
  }

  byBikeType(): Map<Rental['bike'], number> {
    const result = new Map<Rental['bike'], number>();
    for (const r of this.#rentals) {
      result.set(r.bike, (result.get(r.bike) ?? 0) + priceInCent(r));
    }
    return result;
  }
}
