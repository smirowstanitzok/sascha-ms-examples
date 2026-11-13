// lib/agent-stack.ts
import * as path from 'node:path';
import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface AgentStackProps extends StackProps {
  modelId: string;
}

export class SpokeworksAgentStack extends Stack {
  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);

    const runtime = new agentcore.Runtime(this, 'SupportAgentRuntime', {
      runtimeName: 'spokeworks_support',
      description: 'Support agent of the fictional bike rental Spokeworks',
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, '..', 'agent'),
        { platform: Platform.LINUX_ARM64 },
      ),
      // Set explicitly instead of relying on the regional default
      platformVersion: agentcore.PlatformVersion.V2,
      environmentVariables: { MODEL_ID: props.modelId },
    });

    // Converse with an inference profile needs the profile and the foundation models
    runtime.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:*:${this.account}:inference-profile/${props.modelId}`,
          'arn:aws:bedrock:*::foundation-model/*',
        ],
      }),
    );

    new CfnOutput(this, 'AgentRuntimeArn', { value: runtime.agentRuntimeArn });
  }
}
