# Human in the loop for AI agents with Step Functions

An AI support agent may *request* a credit, but a human has to approve it. The workflow pauses with `.waitForTaskToken`, escalates after a deadline and never hands the task token to the agent.

- Article (English): https://sascha-ms.de/en/human-loop-ai-agents-step-functions
- Artikel (Deutsch): https://sascha-ms.de/2026/1608-human-in-the-loop-step-functions

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Lambda functions, DynamoDB table, SNS topic, state machine, IAM roles and policies (Serverless Framework v4) |
| `statemachine/credit-approval.asl.json` | Workflow in JSONata: amount check, AskTeam, AskLead, ApplyCredit |
| `src/request-approval.ts` | Stores the task token in DynamoDB, notifies approvers with an approval ID only |
| `src/decide.ts` | Function URL (AWS_IAM): four-eyes check, first decision wins, calls `SendTaskSuccess` |
| `src/apply-credit.ts` | Placeholder for your accounting system with an idempotency key |
| `src/approvals.ts` | Shared types and input validation |
| `scripts/decide.sh` | Sends a SigV4-signed decision with curl |
| `test/*.test.ts` | Vitest tests for the handlers and the choice rules |

## Run

```bash
npm install
npx tsc --noEmit
npm run validate
npm test
serverless deploy --param="approverEmail=support-team@example.com"
```

Start a request the way the agent tool would:

```bash
aws stepfunctions start-execution \
  --state-machine-arn "<StateMachineArn>" \
  --input '{"orderId":"B-1001","amountCents":4500,"reason":"Book delivered with water damage","requestedBy":"arn:aws:sts::111122223333:assumed-role/support-agent/session-1"}'

export DECIDE_URL="<function URL of decide>"
./scripts/decide.sh <approval ID> approved "Photo of the damage provided"
```

Attach the `ApproverPolicyArn` output to the approvers' role and `AgentPolicyArn` to the role the agent tool runs with. The agent role must never get `states:SendTaskSuccess`.

## Tested with

Node.js 22, TypeScript 7.0.2, Vitest 5.0.5, AWS SDK for JavaScript v3 (3.1161.0), asl-validator 4.0.0. The CloudFormation template was generated and checked with cfn-lint. Deployment targets Serverless Framework v4 and the `nodejs24.x` runtime.
