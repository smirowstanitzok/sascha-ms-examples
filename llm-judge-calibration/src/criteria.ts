// src/criteria.ts
import type { Criterion } from './types.ts';

// Rental rules of the fictional bike rental shop "Radwerk".
// The judge gets them as context so it can check facts.
export const POLICY = `
- Rentals from age 18 with ID; under 18 only with a parent or legal guardian.
- Price: city bike €15 per day, e-bike €35 per day.
- Deposit: €50 (city bike), €200 (e-bike), refunded on return.
- Free cancellation up to 24 hours before pickup, after that 50% of the daily price.
- Return by 7 pm; every started hour of delay costs €5.
- Breakdown: call the hotline, the bike is replaced within 2 hours.
`.trim();

// One judge per criterion – each rubric checks exactly one thing.
export const CRITERIA: Criterion[] = [
  {
    key: 'policy',
    name: 'Policy compliance',
    rubric: `PASS if every factual statement in the answer matches the rental rules.
FAIL if the answer misstates at least one rule or promises something
the rules do not allow (e.g. discounts, exceptions, other deadlines).
Missing details are not a FAIL as long as nothing wrong is said.`,
  },
  {
    key: 'tone',
    name: 'Tone',
    rubric: `PASS if the answer is friendly and factual and does not lecture the customer.
FAIL for blame, sarcasm, pressure or condescending wording.
Short answers are fine as long as they are polite.`,
  },
];
