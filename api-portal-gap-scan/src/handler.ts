// src/handler.ts
// Weekly Lambda: finds gaps and sends the report via SNS.
import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2';
import { APIGatewayClient } from '@aws-sdk/client-api-gateway';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { collectFunctionUrls, collectHttpApis, collectRestMethods } from './collect.ts';
import { findGaps, formatReport } from './gaps.ts';

const region = process.env.AWS_REGION ?? 'eu-central-1';
const sns = new SNSClient({ region });

export async function scan() {
  const [httpApis, functionUrls, restMethods] = await Promise.all([
    collectHttpApis(new ApiGatewayV2Client({ region })),
    collectFunctionUrls(new LambdaClient({ region })),
    collectRestMethods(new APIGatewayClient({ region })),
  ]);
  return findGaps({ httpApis, functionUrls, restMethods });
}

export const handler = async () => {
  const gaps = await scan();
  const report = formatReport(gaps, region);
  console.log(report);
  const topicArn = process.env.REPORT_TOPIC_ARN;
  // Only send mail when something needs attention.
  if (topicArn && gaps.some((g) => g.severity !== 'info')) {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: `API Portal gap report ${region}`.slice(0, 100),
        Message: report,
      }),
    );
  }
  return { findings: gaps.length, high: gaps.filter((g) => g.severity === 'high').length };
};
