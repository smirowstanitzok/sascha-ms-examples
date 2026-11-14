// src/change-protected.ts
// Usage: npm run change -- <HostedZoneId> <change-batch.json>
import { readFile } from "node:fs/promises";
import {
  ChangeResourceRecordSetsCommand,
  DeleteResourceRecordSetProtectionsCommand,
  waitUntilResourceRecordSetsChanged,
  type ChangeBatch,
} from "@aws-sdk/client-route-53";
import { normalizeName, type WantedProtection } from "./protections.js";
import { createProtections, listProtections, route53 } from "./route53.js";

const [hostedZoneId, file] = process.argv.slice(2);
if (!hostedZoneId || !file) {
  console.error("Usage: npm run change -- <HostedZoneId> <change-batch.json>");
  process.exit(1);
}

const changeBatch: ChangeBatch = JSON.parse(await readFile(file, "utf8"));
const touched = new Set(
  (changeBatch.Changes ?? []).map(
    (c) => `${normalizeName(c.ResourceRecordSet!.Name!)}|${c.ResourceRecordSet!.Type}`,
  ),
);

// 1. Remember only the protections this change touches (including comments)
const affected: WantedProtection[] = (await listProtections(route53, hostedZoneId))
  .filter((p) => touched.has(`${normalizeName(p.name)}|${p.type}`))
  .map((p) => ({ name: normalizeName(p.name), type: p.type as WantedProtection["type"], comment: p.comment }));

console.log(`Affected protections: ${affected.length}`);

try {
  // 2. Remove exactly those protections
  if (affected.length > 0) {
    await route53.send(
      new DeleteResourceRecordSetProtectionsCommand({
        HostedZoneId: hostedZoneId,
        Protections: affected.map((p) => ({ RecordName: p.name, RecordType: p.type })),
      }),
    );
  }

  // 3. Apply the change and wait until it is on all Route 53 servers
  const { ChangeInfo } = await route53.send(
    new ChangeResourceRecordSetsCommand({ HostedZoneId: hostedZoneId, ChangeBatch: changeBatch }),
  );
  await waitUntilResourceRecordSetsChanged(
    { client: route53, maxWaitTime: 300 },
    { Id: ChangeInfo!.Id! },
  );
  console.log(`Change ${ChangeInfo!.Id} is INSYNC.`);
} finally {
  // 4. Always restore the protection, even if step 3 fails
  if (affected.length > 0) {
    await createProtections(route53, hostedZoneId, affected);
    console.log("Protection restored.");
  }
}
