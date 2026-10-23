# Lambda Web Functions: Express app with AWS CDK and CloudFront

**Article:** [Lambda Web Functions: Express App With CDK & CloudFront](https://sascha-ms.de/en/lambda-web-functions-cdk-cloudfront) (English) · [German original](https://sascha-ms.de/2026/208-lambda-web-functions-cdk-cloudfront)

An Express 5 app runs unchanged on Lambda Web Functions. The CDK stack uploads the bundled app, creates the web function with IAM auth and puts CloudFront with Origin Access Control in front of it.

```text
app/     Express app (src/index.ts), bundled with esbuild
infra/   CDK app (bin/app.ts, lib/web-app-stack.ts)
```

## Run it locally

```bash
cd app
npm install
npm run typecheck && npm run build
npm start
curl http://127.0.0.1:3000/
```

## Deploy

```bash
cd app && npm run build
cd ../infra
npm install
npx tsc --noEmit
npx cdk synth
npx cdk deploy
```

The stack deploys to `eu-west-1`, because Web Functions are currently only available in Ireland within the EU. Deploying creates AWS resources that may cost money, remove them with `npx cdk destroy`.
