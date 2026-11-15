// test/order.test.ts
import { expect, it } from 'vitest';
import middy from '@middy/core';

const trace = (log: string[], name: string) => ({
  before: () => { log.push(`${name}.before`); },
  after: () => { log.push(`${name}.after`); },
});

it('runs middlewares like an onion', async () => {
  const log: string[] = [];
  const handler = middy(async () => { log.push('handler'); return 'ok'; })
    .use(trace(log, 'A'))
    .use(trace(log, 'B'));
  await handler({}, {} as any);
  expect(log).toEqual(['A.before', 'B.before', 'handler', 'B.after', 'A.after']);
});

it('skips the handler and every after hook on an early return', async () => {
  const log: string[] = [];
  const handler = middy(async () => { log.push('handler'); return 'ok'; })
    .use(trace(log, 'A'))
    .use({ before: () => ({ statusCode: 503, body: 'maintenance' }) })
    .use(trace(log, 'B'));
  const res = await handler({}, {} as any);
  expect(res).toEqual({ statusCode: 503, body: 'maintenance' });
  expect(log).toEqual(['A.before']);
});
