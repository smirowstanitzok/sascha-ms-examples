// lib/rental-stack.ts
import * as path from 'node:path';
import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { Architecture, CfnFunction, Runtime, RuntimeFamily } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

export interface RentalStackProps extends StackProps {
  /** dev, test or prod – also the name of the runtime alias */
  stage: string;
  /** ARN of the runtime (not of the alias) */
  runtimeArn: string;
}

export class RentalStack extends Stack {
  constructor(scope: Construct, id: string, props: RentalStackProps) {
    super(scope, id, props);

    // "custom" tells Lambda: the runtime comes from RuntimeConfig
    const customRuntime = new Runtime('custom', RuntimeFamily.NODEJS);

    const rentBike = new NodejsFunction(this, 'RentBike', {
      entry: path.join(import.meta.dirname, '../src/rent-bike.ts'),
      handler: 'handler',
      runtime: customRuntime,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      bundling: {
        target: 'node24',
        format: OutputFormat.CJS,
        // provided by the runtime image, so not bundled
        externalModules: ['@radwerk/logger', '@aws-sdk/*'],
      },
    });

    // RuntimeConfig is not yet a typed L2 property – set it on the L1 resource
    const cfn = rentBike.node.defaultChild as CfnFunction;
    cfn.addPropertyOverride('RuntimeConfig', {
      RuntimeArn: props.runtimeArn,
      RuntimeAlias: props.stage,
    });
  }
}
