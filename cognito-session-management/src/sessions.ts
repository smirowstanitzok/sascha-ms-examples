// src/sessions.ts
import type { SessionDescriptionType } from "@aws-sdk/client-cognito-identity-provider";

// What a session looks like in the “Speichenwerk” app
export interface SessionView {
  id: string;
  type: "Browser sign-in" | "App session";
  device: string;
  lastActive: string | null;
  location: string;
  ip: string;
  current: boolean;
}

// Show only the first two blocks of an IPv4 address, the first three for IPv6
export function maskIp(ip?: string): string {
  if (!ip) return "unknown";
  if (ip.includes(".")) {
    const [a, b] = ip.split(".");
    return `${a}.${b}.x.x`;
  }
  return ip.split(":").slice(0, 3).join(":") + ":…";
}

export function toView(session: SessionDescriptionType): SessionView {
  const city = session.LastLocation?.City;
  const country = session.LastLocation?.Country;
  return {
    id: session.SessionId ?? "",
    type: session.SessionType === "SSO" ? "Browser sign-in" : "App session",
    device: session.DeviceType ?? "unknown device",
    lastActive: session.LastActiveDate ? session.LastActiveDate.toISOString() : null,
    location: [city, country].filter(Boolean).join(", ") || "unknown",
    ip: maskIp(session.LastIPAddress),
    current: session.IsCurrentSession === true,
  };
}

// Current session first, then the most recently active ones
export function sortSessions(list: SessionView[]): SessionView[] {
  return [...list].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return (b.lastActive ?? "").localeCompare(a.lastActive ?? "");
  });
}

// Token sessions start with “tkn”, SSO sessions with “sso” (28 characters)
export function isValidSessionId(id: string | undefined): id is string {
  return typeof id === "string" && /^(tkn|sso)[A-Za-z0-9_-]{25}$/.test(id);
}
