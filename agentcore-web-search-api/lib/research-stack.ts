// lib/research-stack.ts
import * as path from "node:path";
import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

export interface ResearchStackProps extends StackProps {
  modelId: string;
  trustedDomains: string[];
}

export class ResearchAssistantStack extends Stack {
  constructor(scope: Construct, id: string, props: ResearchStackProps) {
    super(scope, id, props);

    const fn = new NodejsFunction(this, "ResearchFunction", {
      entry: path.join(__dirname, "../src/handler.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(60),
      environment: {
        MODEL_ID: props.modelId,
        TRUSTED_DOMAINS: props.trustedDomains.join(","),
      },
      logGroup: new LogGroup(this, "ResearchLogs", { retention: RetentionDays.TWO_WEEKS }),
      bundling: {
        minify: true,
        // Bundle the SDK: the copy in the Lambda runtime may not know InvokeWebSearch yet.
        externalModules: [],
      },
    });

    // The tool belongs to AWS, so the account field of the ARN is the literal "aws".
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ["bedrock-agentcore:InvokeWebSearch"],
        resources: [`arn:${this.partition}:bedrock-agentcore:${this.region}:aws:tool/web-search.v1`],
      }),
    );

    // Cross-region inference profile plus the foundation model in the target regions.
    const baseModelId = props.modelId.replace(/^(eu|us|apac|global)\./, "");
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:${this.partition}:bedrock:${this.region}:${this.account}:inference-profile/${props.modelId}`,
          `arn:${this.partition}:bedrock:*::foundation-model/${baseModelId}`,
        ],
      }),
    );

    new CfnOutput(this, "FunctionName", { value: fn.functionName });
  }
}
