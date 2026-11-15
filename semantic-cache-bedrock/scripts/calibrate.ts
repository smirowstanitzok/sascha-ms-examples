// scripts/calibrate.ts
import { embed } from "../src/embed";

/** Question pairs with your judgment: should the same answer fit? */
const pairs: { a: string; b: string; same: boolean }[] = [
  { a: "How long can I rent a bike?", b: "What is the maximum rental period?", same: true },
  { a: "Can I return the bike at another station?", b: "Is it possible to drop it off somewhere else?", same: true },
  { a: "Do you have child seats?", b: "Can I book a child seat as an extra?", same: true },
  { a: "What happens if I get a flat tire?", b: "What happens if I bring the bike back late?", same: false },
  { a: "Do I need a helmet for the e-bike?", b: "Do I need a license for the cargo bike?", same: false },
];

function cosineDistance(x: number[], y: number[]): number {
  let dot = 0;
  for (let i = 0; i < x.length; i++) dot += x[i] * y[i];
  return 1 - dot; // vectors are normalized
}

async function main(): Promise<void> {
  for (const pair of pairs) {
    const [va, vb] = await Promise.all([embed(pair.a), embed(pair.b)]);
    const d = cosineDistance(va, vb).toFixed(3);
    console.log(`${pair.same ? "same     " : "different"} ${d}  ${pair.a} | ${pair.b}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
