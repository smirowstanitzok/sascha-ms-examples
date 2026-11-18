// src/handler-unsafe.ts
// BROKEN ON PURPOSE: a handler that worked for years on classic Lambda
// and mixes up data on Lambda Managed Instances.
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Context } from 'aws-lambda';
import { loadPriceList, pause, totalCents, type OrderEvent, type PriceList, type Receipt } from './shop.js';

let currentOrder: OrderEvent | undefined; // Trap 1: request data in module scope
let currentRequestId = '';                // Trap 1: the request ID, too
let prices: PriceList | undefined;        // Trap 2: lazy init without a memoized promise

const RECEIPT_FILE = join(tmpdir(), 'receipt.txt'); // Trap 3: fixed file name in /tmp

export const handler = async (event: OrderEvent, context: Pick<Context, 'awsRequestId'>): Promise<Receipt> => {
  currentOrder = event;
  currentRequestId = context.awsRequestId;

  if (!prices) {
    prices = await loadPriceList(); // several requests load in parallel
  }

  await pause(Math.random() * 20); // e.g. load customer data

  const total = totalCents(currentOrder, prices);
  await writeFile(RECEIPT_FILE, `${currentOrder.orderId};${total}`);
  await pause(Math.random() * 20); // e.g. upload to S3
  const content = await readFile(RECEIPT_FILE, 'utf8');
  const [orderIdInFile, totalInFile] = content.split(';');

  return {
    orderId: orderIdInFile,
    customerId: currentOrder.customerId,
    totalCents: Number(totalInFile),
    requestId: currentRequestId,
    file: RECEIPT_FILE,
  };
};
