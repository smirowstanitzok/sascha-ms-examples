// infra/tuner-stack.ts
import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { CfnApplication } from 'aws-cdk-lib/aws-sam';
import type { Construct } from 'constructs';

export interface TunerStackProps extends StackProps {
  /** The tool may only invoke and reconfigure functions with this name prefix */
  functionPrefix: string;
}

export class PowerTunerStack extends Stack {
  constructor(scope: Construct, id: string, props: TunerStackProps) {
    super(scope, id, props);

    const tuner = new CfnApplication(this, 'PowerTuner', {
      location: {
        applicationId: 'arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning',
        semanticVersion: '4.4.0',
      },
      parameters: {
        // Least privilege: only your own functions in this region and account instead of "*"
        lambdaResource: `arn:aws:lambda:${this.region}:${this.account}:function:${props.functionPrefix}*`,
        PowerValues: '128,256,512,1024,1536,2048,3008',
        totalExecutionTimeout: '300',
        logGroupRetentionInDays: '7',
      },
    });

    new CfnOutput(this, 'StateMachineArn', {
      value: tuner.getAtt('Outputs.StateMachineARN').toString(),
    });
  }
}
