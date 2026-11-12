// test/global-setup.ts
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

// Safety net: the tests create and delete resources.
// They must only ever run against the emulator, never against a real account.
export default async function setup(): Promise<void> {
  if (!process.env.AWS_ENDPOINT_URL) {
    throw new Error("AWS_ENDPOINT_URL is not set – source scripts/emulator-env.sh first");
  }
  const expected = process.env.EMULATOR_ACCOUNT_ID ?? "000000000000";
  const { Account } = await new STSClient({}).send(new GetCallerIdentityCommand({}));
  if (Account !== expected) {
    throw new Error(`Expected emulator account ${expected}, got ${Account}. Aborting.`);
  }
}
