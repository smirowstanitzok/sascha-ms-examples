// src/flags.ts
// Reads feature flags through the local AppConfig Agent (Lambda extension).

export interface TicketFlags {
  sundayDiscount: { enabled: boolean; discountPercent: number };
  salesStop: { enabled: boolean };
}

// Safe defaults: if the agent does not answer, behavior stays as it was.
export const SAFE_DEFAULTS: TicketFlags = {
  sundayDiscount: { enabled: false, discountPercent: 0 },
  salesStop: { enabled: false },
};

interface RawFlag {
  enabled?: boolean;
  [attribute: string]: unknown;
}

export function buildFlagsUrl(env: NodeJS.ProcessEnv = process.env): string {
  const port = env.AWS_APPCONFIG_EXTENSION_HTTP_PORT ?? "2772";
  const app = env.APPCONFIG_APPLICATION;
  const stage = env.APPCONFIG_ENVIRONMENT;
  const profile = env.APPCONFIG_PROFILE;
  if (!app || !stage || !profile) {
    throw new Error("APPCONFIG_APPLICATION, APPCONFIG_ENVIRONMENT and APPCONFIG_PROFILE must be set");
  }
  return `http://localhost:${port}/applications/${app}/environments/${stage}/configurations/${profile}`;
}

export function parseFlags(raw: Record<string, RawFlag>): TicketFlags {
  const sunday = raw["sunday-discount"] ?? {};
  const stop = raw["sales-stop"] ?? {};
  const percent = Number(sunday["discount-percent"] ?? 0);
  return {
    sundayDiscount: {
      enabled: sunday.enabled === true,
      // Second safeguard on top of the validation in AppConfig
      discountPercent: Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 50) : 0,
    },
    salesStop: { enabled: stop.enabled === true },
  };
}

export async function loadFlags(url: string, timeoutMs = 500): Promise<TicketFlags> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      console.warn(JSON.stringify({ msg: "AppConfig Agent returned an error", status: response.status }));
      return SAFE_DEFAULTS;
    }
    return parseFlags((await response.json()) as Record<string, RawFlag>);
  } catch (error) {
    console.warn(JSON.stringify({ msg: "AppConfig Agent unreachable, using defaults", error: String(error) }));
    return SAFE_DEFAULTS;
  }
}
