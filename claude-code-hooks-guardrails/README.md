# Claude Code hooks: guardrails for your AI agent

**Article:** [Claude Code Hooks: Guardrails for Your AI Agent](https://sascha-ms.de/en/claude-code-hooks-guardrails) (English) · [German original](https://sascha-ms.de/2026/213-claude-code-hooks-leitplanken)

Hooks turn rules that you would otherwise only ask for in `CLAUDE.md` into hard checks. This folder is a complete project with four hooks:

| Hook | Event | Purpose |
| --- | --- | --- |
| `.claude/hooks/guard-bash.mjs` | PreToolUse (Bash) | Blocks force pushes and other risky commands, asks before deployments |
| `.claude/hooks/protect-paths.mjs` | PreToolUse (Edit, Write) | Protects secrets, lockfiles, `cdk.out` and everything outside the project |
| `.claude/hooks/format-file.mjs` | PostToolUse (Edit, Write) | Formats the changed file with Prettier |
| `.claude/hooks/stop-typecheck.mjs` | Stop | Claude may only stop when `tsc --noEmit` is green |

All hooks are registered in `.claude/settings.json`.

## Run it

```bash
npm install
npm test   # tests the hooks without Claude Code: JSON in, check the result
```

Try a single hook by hand:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}' | node .claude/hooks/guard-bash.mjs
```

To use the hooks in your own project, copy the `.claude` folder and adjust the rules.
