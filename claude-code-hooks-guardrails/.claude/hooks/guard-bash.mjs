#!/usr/bin/env node
// PreToolUse hook for the Bash tool: blocks risky commands, asks about deployments.
import { readFileSync } from 'node:fs';

const DENY = [
  [/\bgit\s+push\b.*\s(--force|-f)\b/, 'Force pushes are off-limits here. Please create a new commit.'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard discards work. Use git stash or a new branch.'],
  [/\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z)?sh\b/, 'Do not run scripts from the internet directly. Download and show them first.'],
  [/\b(cdk|sls|serverless|terraform)\s+destroy\b/, 'Only a human deletes infrastructure.'],
];

const ASK = [
  [/\b(cdk|sls|serverless)\s+deploy\b/, 'Deployment detected: please confirm yourself.'],
  [/--profile[=\s]+\S*prod/i, 'AWS profile with "prod" in its name detected.'],
];

function decide(command) {
  for (const [re, reason] of DENY) if (re.test(command)) return ['deny', reason];
  for (const [re, reason] of ASK) if (re.test(command)) return ['ask', reason];
  return null;
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(input.tool_input?.command ?? '');
  const result = decide(command);
  if (result) {
    const [permissionDecision, permissionDecisionReason] = result;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision,
        permissionDecisionReason,
      },
    }));
  }
  process.exit(0);
} catch (err) {
  // Fail closed: if the guard itself is broken, block rather than allow.
  process.stderr.write(`guard-bash could not check the input: ${err.message}\n`);
  process.exit(2);
}
