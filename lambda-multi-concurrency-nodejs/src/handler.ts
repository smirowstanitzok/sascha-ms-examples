// src/handler.ts
// The same handler, safe for multi-concurrency on Lambda Managed Instances.
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Context } from 'aws-lambda';
import { once } from './once.js';
import { log, requestContext, withRequestContext } from './request-context.js';
import { loadPriceList, pause, totalCents, type OrderEvent, type Receipt } from './shop.js';

// Fine in module scope: immutable constants and promises that are created once
const getPrices = once(loadPriceList);

export const handler = async (event: OrderEvent, context: Pick<Context, 'awsRequestId'>): Promise<Receipt> =>
  withRequestContext({ requestId: context.awsRequestId, customerId: event.customerId }, async () => {
    const prices = await getPrices();
    await pause(Math.random() * 20);

    const total = totalCents(event, prices); // the order stays a local variable
    const file = join(tmpdir(), `receipt-${randomUUID()}.txt`); // unique file name per invocation
    try {
      await writeFile(file, `${event.orderId};${total}`);
      await pause(Math.random() * 20);
      const [orderIdInFile, totalInFile] = (await readFile(file, 'utf8')).split(';');
      log('Receipt created', { orderId: orderIdInFile });
      return {
        orderId: orderIdInFile,
        customerId: requestContext().customerId,
        totalCents: Number(totalInFile),
        requestId: requestContext().requestId,
        file,
      };
    } finally {
      await rm(file, { force: true }); // all invocations share /tmp – clean up
    }
  });
