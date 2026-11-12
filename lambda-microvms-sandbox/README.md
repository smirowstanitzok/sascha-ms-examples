# Lambda MicroVMs: run AI code safely in a sandbox

Example code for the article:

- English: [Lambda MicroVMs: run AI code safely in a sandbox](https://sascha-ms.de/en/lambda-microvms-ai-sandbox)
- German: [Lambda MicroVMs: KI-Code sicher in der Sandbox ausführen](https://sascha-ms.de/2026/2738-lambda-microvms-ki-sandbox)

A fictional learning platform ("Codegarden") runs JavaScript snippets from learners and an AI tutor. Every learning session gets its own Lambda MicroVM. A Lambda orchestrator (Serverless Framework, TypeScript) starts, uses and terminates the MicroVMs.

## Files

| Path | Purpose |
| --- | --- |
| `sandbox/execute.ts` | Runs a snippet in a child process with timeout and output limit |
| `sandbox/server.ts` | HTTP server on port 8080 with /ready and /run hooks and /snippets |
| `sandbox/execute.test.ts` | Tests with the built-in Node.js test runner |
| `sandbox/Dockerfile` | Image for the MicroVM (Node.js 24, type stripping) |
| `sandbox/hooks.json` | Hook configuration for create-microvm-image |
| `sandbox/build-image.sh` | Zips, uploads to S3 and creates the MicroVM image |
| `orchestrator/serverless.yml` | HTTP API, three functions, DynamoDB table with TTL |
| `orchestrator/src/microvm.ts` | Run, wait, auth token, terminate via @aws-sdk/client-lambda-microvms |
| `orchestrator/src/store.ts` | Session storage in DynamoDB |
| `orchestrator/src/handlers.ts` | POST /sessions, POST /sessions/{id}/snippets, DELETE /sessions/{id} |

## Run

```bash
# Test the runner locally (Node.js 24, or 22.6+ with the flag)
cd sandbox
node --experimental-strip-types --test execute.test.ts

# Build the MicroVM image (needs an S3 bucket and a build role, see article)
export ARTIFACT_BUCKET=your-bucket
export BUILD_ROLE_ARN=arn:aws:iam::123456789012:role/CodegardenBuildRole
./build-image.sh

# Deploy the orchestrator
cd ../orchestrator
npm install
npx tsc --noEmit
serverless deploy --region us-east-1
```

Outbound internet access of MicroVMs is open by default. For untrusted code, pass a VPC egress connector without an internet route via --param="egressConnectorArn=..." (see article).

## Tested with

- Node.js 22.23 (--experimental-strip-types) for the runner tests, Node.js 24 in the image
- @aws-sdk/client-lambda-microvms 3.1167.0, TypeScript 5.9, Serverless Framework v4
- The AWS deployment itself was not executed in this test (no AWS credentials); tsc --noEmit and the runner tests pass.

Terminate MicroVMs and run serverless remove afterwards to avoid costs.
