// src/route53.ts
import {
  Route53Client,
  CreateResourceRecordSetProtectionsCommand,
  paginateListResourceRecordSetProtections,
} from "@aws-sdk/client-route-53";
import { chunk, type ProtectionKey, type WantedProtection } from "./protections.js";

// Route 53 is a global service, the API runs in us-east-1
export const route53 = new Route53Client({ region: "us-east-1" });

export async function listProtections(
  client: Route53Client,
  hostedZoneId: string,
): Promise<(ProtectionKey & { comment?: string })[]> {
  const result: (ProtectionKey & { comment?: string })[] = [];
  const pages = paginateListResourceRecordSetProtections(
    { client },
    { HostedZoneId: hostedZoneId },
  );
  for await (const page of pages) {
    for (const p of page.ResourceRecordSetProtections ?? []) {
      result.push({ name: p.RecordName!, type: p.RecordType!, comment: p.Comment });
    }
  }
  return result;
}

export async function createProtections(
  client: Route53Client,
  hostedZoneId: string,
  protections: WantedProtection[],
): Promise<void> {
  // at most 100 entries per request, each request is all or nothing
  for (const batch of chunk(protections, 100)) {
    await client.send(
      new CreateResourceRecordSetProtectionsCommand({
        HostedZoneId: hostedZoneId,
        Protections: batch.map((p) => ({
          RecordName: p.name,
          RecordType: p.type,
          ...(p.comment ? { Comment: p.comment } : {}),
        })),
      }),
    );
  }
}
