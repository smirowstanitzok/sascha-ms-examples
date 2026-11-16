// test/fair-queues.test.ts
import { describe, expect, it } from 'vitest';
import { toBatchEntries } from '../src/enqueue.js';
import { parseClubJob, type ClubJob } from '../src/job.js';
import { simulate } from '../scripts/simulate.js';

const job = (clubId: string, n: number): ClubJob => ({
  clubId, jobId: `${clubId}-${n}`, memberId: `m-${n}`, type: 'membership-card',
});

describe('toBatchEntries', () => {
  it('sets the club ID as MessageGroupId', () => {
    const [chunk] = toBatchEntries([job('sv-a', 1), job('tsv-gross', 2)]);
    expect(chunk.map((e) => e.MessageGroupId)).toEqual(['sv-a', 'tsv-gross']);
  });

  it('splits into batches of at most 10 messages with unique Ids', () => {
    const chunks = toBatchEntries(Array.from({ length: 23 }, (_, i) => job('sv-a', i)));
    expect(chunks.map((c) => c.length)).toEqual([10, 10, 3]);
    expect(new Set(chunks[1].map((e) => e.Id)).size).toBe(10);
  });

  it('rejects jobs without a clubId', () => {
    expect(() => toBatchEntries([job(' ', 1)])).toThrow(/no clubId/);
  });
});

describe('parseClubJob', () => {
  it('detects incomplete jobs', () => {
    expect(() => parseClubJob('{"clubId":"sv-a"}')).toThrow(/required/);
  });
});

describe('simulate', () => {
  it('keeps the wait time of quiet clubs much lower with fairness', () => {
    const oldest = simulate('oldest-first');
    const fair = simulate('fair');
    expect(fair.quietP95).toBeLessThan(oldest.quietP95 / 5);
  });
});
