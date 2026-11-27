// src/calibrate.ts
import { readFile, writeFile } from 'node:fs/promises';
import type { LabeledAnswer } from './types.ts';
import { CRITERIA } from './criteria.ts';
import { createClaudeJudge, createMockJudge } from './judge.ts';
import { calibrate, splitOf, type Pair } from './metrics.ts';

const SET = (process.env.SET ?? 'dev') as 'dev' | 'test';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);

const raw = await readFile(new URL('../data/labels.jsonl', import.meta.url), 'utf8');
const items: LabeledAnswer[] = raw
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line))
  .filter((item: LabeledAnswer) => splitOf(item.id) === SET);

const judge = process.env.JUDGE_MOCK ? createMockJudge() : createClaudeJudge();

// All jobs: every example × every criterion
const jobs = items.flatMap((item) => CRITERIA.map((criterion) => ({ item, criterion })));
const results: Array<{ id: string; criterion: string; human: string; judge: string; reason: string }> = [];

// Simple limit for parallel calls
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { item, criterion } = jobs[next++];
    const r = await judge(criterion, item.question, item.answer);
    results.push({
      id: item.id,
      criterion: criterion.key,
      human: item.labels[criterion.key],
      judge: r.verdict,
      reason: r.reason,
    });
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
console.log(`Set: ${SET} · examples: ${items.length} · verdicts: ${results.length}\n`);
for (const c of CRITERIA) {
  const pairs = results.filter((r) => r.criterion === c.key) as unknown as Pair[];
  const rep = calibrate(pairs);
  console.log(`${c.name}:`);
  console.log(`  agreement ${pct(rep.agreement)} · Kappa ${rep.kappa.toFixed(2)} · unknown ${pct(rep.unknownRate)}`);
  console.log(`  false pass ${pct(rep.falsePassRate)} · false fail ${pct(rep.falseFailRate)}`);
}

// Save disagreements – you read these next
const disagreements = results.filter((r) => r.judge !== r.human);
await writeFile(`disagreements-${SET}.json`, JSON.stringify(disagreements, null, 2));
console.log(`\n${disagreements.length} disagreements in disagreements-${SET}.json`);
