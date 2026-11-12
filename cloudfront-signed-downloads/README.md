# CloudFront signed URLs: private downloads with Lambda

Example code for the article
**[CloudFront Signed URLs: Private Downloads with Lambda](https://sascha-ms.de/en/cloudfront-signed-urls-lambda)**
(German version: [CloudFront Signed URLs: private Downloads mit Lambda](https://sascha-ms.de/2026/2776-cloudfront-signed-urls-lambda)).

A fictional city library lends e-books as PDFs. A Lambda function behind an HTTP API (JWT authorizer) checks the
loan in DynamoDB, loads a private key from SSM Parameter Store and returns a short-lived CloudFront signed URL
(canned policy, SHA-256). CloudFront verifies the signature with a public key from a trusted key group and fetches the
PDF from a private S3 bucket via origin access control (OAC).

## Files

| File | Purpose |
| --- | --- |
| `serverless.yml` | Serverless Framework v4: HTTP API with JWT authorizer, DynamoDB table, private S3 bucket, CloudFront public key, key group, OAC and distribution |
| `src/sign-download.ts` | Pure function that signs a download URL (max. one hour, SHA-256) |
| `src/private-key.ts` | Loads the private key from Parameter Store and caches it for five minutes |
| `src/handler.ts` | Lambda handler: checks the loan and returns `{ url, expiresAt }` |
| `test/sign-download.test.ts` | Vitest tests that verify the signature with Node.js crypto (no AWS account needed) |

## Run

```bash
npm install
npx tsc --noEmit
npx vitest run
```

Deploy (creates real AWS resources, including a CloudFront distribution):

```bash
openssl genrsa -out private_key.pem 2048
openssl rsa -pubout -in private_key.pem -out public_key.pem
aws ssm put-parameter --name /library/dev/cloudfront/private-key --type SecureString --value file://private_key.pem
aws ssm put-parameter --name /library/dev/cloudfront/public-key --type String --value file://public_key.pem
rm private_key.pem

serverless deploy --stage dev \
  --param="jwtIssuerUrl=https://cognito-idp.eu-central-1.amazonaws.com/<pool-id>" \
  --param="jwtAudience=<app-client-id>"
```

Remove everything afterwards with `serverless remove --stage dev` and delete the two SSM parameters.

Tested with Node.js 22, TypeScript 7.0.2, Vitest 5.1.0, `@aws-sdk/cloudfront-signer` 3.1166.0 and Serverless Framework v4 syntax
(CloudFormation resources checked with `cfn-lint`).
