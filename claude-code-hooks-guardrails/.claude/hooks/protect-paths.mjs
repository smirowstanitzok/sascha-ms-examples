#!/usr/bin/env node
// PreToolUse hook for Edit and Write: protects secrets, lockfiles and everything outside the project.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());

const BLOCKED = [
  [/(^|\/)\.env(\.|$)/, 'Environment files contain secrets and stay off-limits.'],
  [/\.(pem|key|p12)$/, 'Key files are not touched.'],
  [/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/, 'Only change lockfiles via the package manager (npm install).'],
  [/(^|\/)cdk\.out\//, 'cdk.out is generated. Change the stack code instead of the output.'],
];

const ASK = [
  [/(^|\/)\.github\/workflows\//, 'Change to a CI pipeline: please review yourself.'],
];

function respond(permissionDecision, permissionDecisionReason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason },
  }));
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const raw = String(input.tool_input?.file_path ?? '');
  const abs = path.resolve(input.cwd ?? root, raw);
  const rel = path.relative(root, abs).split(path.sep).join('/');

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    respond('deny', `Writing outside the project is not allowed: ${abs}`);
  } else {
    const hit = BLOCKED.find(([re]) => re.test(rel));
    const ask = ASK.find(([re]) => re.test(rel));
    if (hit) respond('deny', `${rel}: ${hit[1]}`);
    else if (ask) respond('ask', `${rel}: ${ask[1]}`);
  }
  process.exit(0);
} catch (err) {
  process.stderr.write(`protect-paths could not check the input: ${err.message}\n`);
  process.exit(2);
}
