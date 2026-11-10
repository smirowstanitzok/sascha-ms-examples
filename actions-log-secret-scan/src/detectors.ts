// src/detectors.ts
export interface Rule {
  id: string;
  description: string;
  pattern: RegExp;
}

export interface Finding {
  rule: string;
  file: string;
  line: number;
  preview: string;
}

// Deliberately specific patterns: few false positives instead of endless noise.
export const rules: Rule[] = [
  { id: "aws-access-key-id", description: "AWS access key ID", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  {
    id: "aws-secret-access-key",
    description: "AWS secret access key next to its name",
    pattern: /(?:aws_secret_access_key|SecretAccessKey)["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}/gi,
  },
  { id: "aws-session-token", description: "AWS session token next to its name", pattern: /(?:aws_session_token|SessionToken)["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{100,}/gi },
  { id: "github-token", description: "GitHub token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{82}\b/g },
  { id: "npm-token", description: "npm access token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { id: "private-key", description: "Private key block", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g },
  { id: "jwt", description: "JSON Web Token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { id: "url-credentials", description: "Password inside a URL", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@*]{3,}@/gi },
  { id: "slack-webhook", description: "Slack webhook URL", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]{20,}/g },
];

// Never print the secret itself: only the first characters and its length.
export function redact(value: string): string {
  return `${value.slice(0, 4)}…(${value.length} chars)`;
}

export function scanText(text: string, file: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((content, index) => {
    for (const rule of rules) {
      for (const match of content.matchAll(rule.pattern)) {
        findings.push({ rule: rule.id, file, line: index + 1, preview: redact(match[0]) });
      }
    }
  });
  return findings;
}
