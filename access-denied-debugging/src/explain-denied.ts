// src/explain-denied.ts
// Usage: npx tsx src/explain-denied.ts --region eu-central-1 "<error message or authorization ID>"
import {
  GetRequestAuthorizationDetailsCommand,
  GetRequestAuthorizationPolicyCommand,
  IAMToolboxClient,
  ResourceNotFoundException,
  type GetRequestAuthorizationDetailsCommandOutput,
} from "@aws-sdk/client-iam-toolbox";
import { extractAuthorizationId } from "./authorization-id";

type Evaluation = NonNullable<GetRequestAuthorizationDetailsCommandOutput["evaluations"]>[number];
type PolicyInfo = NonNullable<GetRequestAuthorizationDetailsCommandOutput["policies"]>[number];

function parseArgs(argv: string[]): { region: string; input: string } {
  const regionIndex = argv.indexOf("--region");
  const region = regionIndex >= 0 ? argv[regionIndex + 1] : process.env.AWS_REGION;
  const input = argv.filter((_, i) => i !== regionIndex && i !== regionIndex + 1).join(" ");
  if (!region || !input) {
    throw new Error('Usage: explain-denied --region <region> "<error message or authorization ID>"');
  }
  return { region, input };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Details are recorded asynchronously – retry "not found" a few times.
async function loadDetails(client: IAMToolboxClient, authorizationId: string) {
  const evaluations: Evaluation[] = [];
  const policies: PolicyInfo[] = [];
  let nextToken: string | undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      do {
        const page = await client.send(
          new GetRequestAuthorizationDetailsCommand({ authorizationId, nextToken }),
        );
        evaluations.push(...(page.evaluations ?? []));
        policies.push(...(page.policies ?? []));
        nextToken = page.nextToken;
      } while (nextToken);
      return { evaluations, policies };
    } catch (error) {
      if (error instanceof ResourceNotFoundException && attempt < 4) {
        await sleep(attempt * 5000);
        continue;
      }
      throw error;
    }
  }
}

async function main(): Promise<void> {
  const { region, input } = parseArgs(process.argv.slice(2));
  const authorizationId = extractAuthorizationId(input) ?? input.trim();
  const client = new IAMToolboxClient({ region });

  const { evaluations, policies } = await loadDetails(client, authorizationId);
  const denied = evaluations.filter((e) => e.evaluatedEffect !== "ALLOW");
  if (denied.length === 0) {
    console.log("No denied evaluation found for this authorization ID.");
    return;
  }

  const policyUris = new Set<string>();
  for (const evaluation of denied) {
    console.log(`\n${evaluation.evaluatedEffect}: ${evaluation.action} on ${evaluation.resource}`);
    for (const check of evaluation.checks ?? []) {
      if (check.evaluatedEffect === "ALLOW" || check.evaluatedEffect === "NO_IMPACT") continue;
      const target = check.targetArn ? ` (${check.targetArn})` : "";
      console.log(`  check ${check.checkType}${target}: ${check.evaluatedEffect}`);
      console.log(`    look at: ${(check.relevantPolicyTypes ?? []).join(", ")}`);
      for (const policy of check.matchedPolicies ?? []) {
        const sids = (policy.matchedStatements ?? []).map((s) => s.sid ?? "(no Sid)").join(", ");
        console.log(`    matched: ${policy.uri} ${sids ? `[${sids}]` : ""}`);
        policyUris.add(policy.uri!);
      }
    }
  }

  // Show the denying policies as they were at the time of the request.
  for (const policyUri of policyUris) {
    if (!policies.some((p) => p.uri === policyUri)) continue;
    const { policyDocument } = await client.send(
      new GetRequestAuthorizationPolicyCommand({ authorizationId, policyUri }),
    );
    console.log(`\nPolicy ${policyUri} (as recorded):`);
    console.log(JSON.stringify(policyDocument, null, 2));
  }
}

main().catch((error: Error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exit(1);
});
