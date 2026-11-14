// src/config.ts
import type { WantedProtection } from "./protections.js";

const zone = "bikerental.example";
const why = "Production. Read runbook DNS-01 before changing.";

export const wantedProtections: WantedProtection[] = [
  { name: zone, type: "A", comment: why },
  { name: zone, type: "AAAA", comment: why },
  { name: zone, type: "MX", comment: "Mail delivery. Change only after agreement." },
  { name: zone, type: "TXT", comment: "SPF and domain verifications." },
  { name: `www.${zone}`, type: "CNAME", comment: why },
  { name: `_dmarc.${zone}`, type: "TXT" },
  // Reserve a name that does not exist (yet): nobody can create it
  { name: `admin.${zone}`, type: "A", comment: "Reserved. No public admin host." },
];
