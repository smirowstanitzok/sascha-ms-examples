// src/scan-zip.ts
import { unzipSync, strFromU8 } from "fflate";
import { scanText, type Finding } from "./detectors.js";

// A workflow log archive contains one text file per job and step.
export function scanLogArchive(zip: Uint8Array): Finding[] {
  const files = unzipSync(zip);
  const findings: Finding[] = [];
  for (const [name, data] of Object.entries(files)) {
    if (!name.endsWith(".txt")) continue;
    findings.push(...scanText(strFromU8(data), name));
  }
  return findings;
}
