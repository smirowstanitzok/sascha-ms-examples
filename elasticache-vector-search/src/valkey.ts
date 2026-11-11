// src/valkey.ts
import { GlideClusterClient, ServiceType } from "@valkey/valkey-glide";

let pending: Promise<GlideClusterClient> | undefined;

/** One client per Lambda instance; GLIDE refreshes the IAM token itself. */
export function getClient(): Promise<GlideClusterClient> {
  pending ??= GlideClusterClient.createClient({
    addresses: [{ host: required("CACHE_HOST"), port: 6379 }],
    useTLS: true,
    requestTimeout: 2000,
    credentials: {
      username: "default.iam-user",
      iamConfig: {
        clusterName: required("CACHE_NAME").toLowerCase(),
        service: ServiceType.Elasticache,
        region: required("AWS_REGION"),
      },
    },
  }).catch((error: unknown) => {
    pending = undefined; // reconnect on the next call
    throw error;
  });
  return pending;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is missing`);
  return value;
}
