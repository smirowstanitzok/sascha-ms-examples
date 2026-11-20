// test/gebuehr.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { berechneGebuehr } from '../src/gebuehr.ts';

describe('berechneGebuehr', () => {
  const faelle = [
    { name: '10 minutes cost a full hour', ende: '2026-05-02T09:10:00Z', erwartet: 300 },
    { name: '61 minutes cost two hours', ende: '2026-05-02T10:01:00Z', erwartet: 600 },
    { name: '12 hours are capped at the daily price', ende: '2026-05-02T21:00:00Z', erwartet: 2500 },
    { name: '25 hours are one day plus one hour', ende: '2026-05-03T10:00:00Z', erwartet: 2800 },
  ];

  for (const fall of faelle) {
    it(fall.name, () => {
      assert.equal(berechneGebuehr('2026-05-02T09:00:00Z', fall.ende), fall.erwartet);
    });
  }

  it('throws a RangeError when end is before start', () => {
    assert.throws(
      () => berechneGebuehr('2026-05-02T09:00:00Z', '2026-05-02T08:00:00Z'),
      { name: 'RangeError', message: /Invalid time range/ },
    );
  });
});
