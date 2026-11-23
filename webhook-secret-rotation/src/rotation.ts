// src/rotation.ts
import { randomBytes } from "node:crypto";
import {
  SSMClient,
  PutParameterCommand,
  LabelParameterVersionCommand,
  UnlabelParameterVersionCommand,
  GetParameterHistoryCommand,
  type ParameterHistory,
} from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const PARAM = process.env.SECRET_PARAM!;
const OVERLAP_HOURS = Number(process.env.OVERLAP_HOURS ?? "24");

// 32 random bytes in the format of the Standard Webhooks specification
export function newSecret(): string {
  return `whsec_${randomBytes(32).toString("base64")}`;
}

async function history(name: string): Promise<ParameterHistory[]> {
  const all: ParameterHistory[] = [];
  let NextToken: string | undefined;
  do {
    const page = await ssm.send(
      new GetParameterHistoryCommand({ Name: name, WithDecryption: false, NextToken, MaxResults: 50 }),
    );
    all.push(...(page.Parameters ?? []));
    NextToken = page.NextToken;
  } while (NextToken);
  return all;
}

export function versionWithLabel(items: ParameterHistory[], label: string): ParameterHistory | undefined {
  return items.find((v) => v.Labels?.includes(label));
}

// Step 1: create a new secret and move the labels
// Without a value the function generates a secret (sender role),
// with a value it stores the provider's secret (receiver role)
export async function rotate(secret?: string): Promise<{ current: number; previous?: number }> {
  const items = await history(PARAM).catch((err: Error) => {
    if (err.name === "ParameterNotFound") return []; // very first run
    throw err;
  });
  if (versionWithLabel(items, "previous")) {
    throw new Error("rotation still running: retire 'previous' first");
  }
  const before = versionWithLabel(items, "current");

  const put = await ssm.send(
    new PutParameterCommand({ Name: PARAM, Value: secret ?? newSecret(), Type: "SecureString", Overwrite: true }),
  );
  const newVersion = put.Version!;

  if (before?.Version) {
    await ssm.send(
      new LabelParameterVersionCommand({ Name: PARAM, ParameterVersion: before.Version, Labels: ["previous"] }),
    );
  }
  // A label can only sit on one version: "current" moves along
  await ssm.send(
    new LabelParameterVersionCommand({ Name: PARAM, ParameterVersion: newVersion, Labels: ["current"] }),
  );
  console.log(JSON.stringify({ msg: "rotated", current: newVersion, previous: before?.Version }));
  return { current: newVersion, previous: before?.Version };
}

// Decides whether the old secret may go (pure function, easy to test)
export function shouldRetire(currentSince: Date, now: Date, overlapHours: number): boolean {
  return now.getTime() - currentSince.getTime() >= overlapHours * 3600 * 1000;
}

// Step 2: remove the "previous" label after the overlap window
export async function retire(now = new Date()): Promise<{ retired: boolean }> {
  const items = await history(PARAM);
  const current = versionWithLabel(items, "current");
  const previous = versionWithLabel(items, "previous");
  if (!current?.LastModifiedDate || !previous?.Version) return { retired: false };
  if (!shouldRetire(current.LastModifiedDate, now, OVERLAP_HOURS)) return { retired: false };

  await ssm.send(
    new UnlabelParameterVersionCommand({ Name: PARAM, ParameterVersion: previous.Version, Labels: ["previous"] }),
  );
  console.log(JSON.stringify({ msg: "retired", version: previous.Version }));
  return { retired: true };
}

export const rotateHandler = async (event?: { secret?: string }) => rotate(event?.secret);
export const retireHandler = async () => retire();
