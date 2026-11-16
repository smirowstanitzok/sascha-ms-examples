// src/receipt.ts
import { Logger } from '@aws-lambda-powertools/logger';
import PDFDocument from 'pdfkit';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// Powertools comes from the managed layer, pdfkit from our own layer.
const logger = new Logger({ serviceName: 'bike-rental-receipts' });

export interface Rental {
  id: string;
  bike: string;
  minutes: number;
  centsPerMinute: number;
}

// Fictional sample data. A real service would read this from DynamoDB.
const RENTALS: Record<string, Rental> = {
  'R-1001': { id: 'R-1001', bike: 'City bike #17', minutes: 95, centsPerMinute: 4 },
  'R-1002': { id: 'R-1002', bike: 'E-bike #3', minutes: 40, centsPerMinute: 9 },
};

export function priceInEuro(rental: Rental): string {
  return ((rental.minutes * rental.centsPerMinute) / 100).toFixed(2);
}

export function receiptAsPdf(rental: Rental): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Bike rental receipt');
    doc.moveDown();
    doc.fontSize(12).text(`Rental: ${rental.id}`);
    doc.text(`Bike: ${rental.bike}`);
    doc.text(`Duration: ${rental.minutes} minutes`);
    doc.text(`Amount: ${priceInEuro(rental)} EUR`);
    doc.end();
  });
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const id = event.pathParameters?.rentalId ?? '';
  const rental = RENTALS[id];
  if (!rental) {
    logger.warn('Rental not found', { id });
    return { statusCode: 404, body: JSON.stringify({ error: 'Rental not found' }) };
  }

  const pdf = await receiptAsPdf(rental);
  logger.info('Receipt created', { id, bytes: pdf.length });
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/pdf' },
    isBase64Encoded: true,
    body: pdf.toString('base64'),
  };
};
