// src/tools.ts
// Tools for the assistant. Every S3 call uses only the
// scoped-down credentials, never the Lambda function's role.
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ScopedCredentials } from './credential-broker.ts';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(input: Record<string, unknown>): Promise<string>;
}

export function createShopTools(
  bucket: string,
  shopId: string,
  credentials: ScopedCredentials,
): Tool[] {
  const s3 = new S3Client({ credentials });
  const docs = `shops/${shopId}/docs/`;
  const reports = `shops/${shopId}/reports/`;

  return [
    {
      name: 'list_documents',
      description: 'Lists the rental shop documents, e.g. rental terms and price lists.',
      inputSchema: { type: 'object', properties: {} },
      async run() {
        const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: docs }));
        const names = (out.Contents ?? []).map((o) => (o.Key ?? '').slice(docs.length));
        return names.filter(Boolean).join('\n') || 'No documents found.';
      },
    },
    {
      name: 'read_document',
      description: 'Reads a rental shop document. Expects the file name from list_documents.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      async run(input) {
        const name = String(input.name ?? '');
        const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: docs + name }));
        return (await out.Body?.transformToString()) ?? '';
      },
    },
    {
      name: 'save_damage_report',
      description: 'Saves a damage report for a rental bike.',
      inputSchema: {
        type: 'object',
        properties: { bikeId: { type: 'string' }, text: { type: 'string' } },
        required: ['bikeId', 'text'],
      },
      async run(input) {
        const bikeId = String(input.bikeId ?? 'unknown').replace(/[^A-Za-z0-9-]/g, '');
        const key = `${reports}${bikeId}-${Date.now()}.txt`;
        await s3.send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: String(input.text ?? '') }),
        );
        return `Report saved: ${key.slice(reports.length)}`;
      },
    },
  ];
}
