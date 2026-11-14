// src/handler.ts
import { wantedProtections } from "./config.js";
import { diffProtections } from "./protections.js";
import { createProtections, listProtections, route53 } from "./route53.js";

const hostedZoneId = process.env.HOSTED_ZONE_ID!;
const autoRepair = process.env.AUTO_REPAIR === "true";

export const handler = async () => {
  const existing = await listProtections(route53, hostedZoneId);
  const { missing, unexpected } = diffProtections(wantedProtections, existing);

  if (missing.length > 0 && autoRepair) {
    await createProtections(route53, hostedZoneId, missing);
  }

  // Embedded Metric Format: CloudWatch turns this log line into a metric
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "DnsGuard",
            Dimensions: [["HostedZoneId"]],
            Metrics: [
              { Name: "MissingProtections", Unit: "Count" },
              { Name: "RepairedProtections", Unit: "Count" },
            ],
          },
        ],
      },
      HostedZoneId: hostedZoneId,
      // Count repaired gaps too: someone removed a protection
      MissingProtections: missing.length,
      RepairedProtections: autoRepair ? missing.length : 0,
      missing: missing.map((m) => `${m.name} ${m.type}`),
      unexpected: unexpected.map((u) => `${u.name} ${u.type}`),
    }),
  );

  return { missing: missing.length, unexpected: unexpected.length, repaired: autoRepair };
};
