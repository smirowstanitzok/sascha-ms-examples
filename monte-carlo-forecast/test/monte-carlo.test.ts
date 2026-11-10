// test/monte-carlo.test.ts
import { describe, expect, it } from 'vitest';
import { addWorkdays, dailyThroughput, percentile, simulateHowMany, simulateWhen } from '../src/monte-carlo.ts';

describe('dailyThroughput', () => {
  it('counts workdays without a finished ticket as 0', () => {
    // 2026-11-02 is a Monday, 2026-11-07/08 are the weekend
    const samples = dailyThroughput(['2026-11-02', '2026-11-02', '2026-11-04'], '2026-11-02', '2026-11-08');
    expect(samples).toEqual([2, 0, 1, 0, 0]);
  });

  it('throws when nothing was finished in the period', () => {
    expect(() => dailyThroughput([], '2026-11-02', '2026-11-06')).toThrow(/no forecast/);
  });
});

describe('percentile', () => {
  it('returns the nearest-rank value', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 50)).toBe(5);
    expect(percentile(sorted, 85)).toBe(9);
    expect(percentile(sorted, 100)).toBe(10);
  });
});

describe('simulateWhen', () => {
  it('is exact with constant throughput', () => {
    const result = simulateWhen([2], 10, { trials: 100 });
    expect(new Set(result)).toEqual(new Set([5]));
  });

  it('is reproducible with the same seed', () => {
    const samples = [0, 1, 3, 0, 2];
    expect(simulateWhen(samples, 20, { seed: 7 })).toEqual(simulateWhen(samples, 20, { seed: 7 }));
  });

  it('never returns an earlier date for higher confidence', () => {
    const result = simulateWhen([0, 1, 2, 0, 3, 1], 25);
    expect(percentile(result, 85)).toBeGreaterThanOrEqual(percentile(result, 50));
  });
});

describe('simulateHowMany', () => {
  it('returns exactly days times throughput with constant throughput', () => {
    expect(new Set(simulateHowMany([3], 4, { trials: 50 }))).toEqual(new Set([12]));
  });
});

describe('addWorkdays', () => {
  it('counts the start day and skips the weekend', () => {
    // Friday is day 1, Monday is day 2
    expect(addWorkdays('2026-11-06', 1)).toBe('2026-11-06');
    expect(addWorkdays('2026-11-06', 2)).toBe('2026-11-09');
  });
});
