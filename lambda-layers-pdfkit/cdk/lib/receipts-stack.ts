// cdk/lib/receipts-stack.ts
import * as path from 'node:path';
import { Stack, type StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

export class ReceiptsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Own layer: the folder must contain nodejs/node_modules
    const pdfLayer = new lambda.LayerVersion(this, 'PdfLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../layers/pdf')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_24_X],
      compatibleArchitectures: [lambda.Architecture.ARM_64, lambda.Architecture.X86_64],
      description: 'pdfkit 0.20.2 for receipts',
    });

    // Managed Powertools layer, pinned to an exact version
    const powertools = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'Powertools',
      `arn:aws:lambda:${this.region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:51`,
    );

    new NodejsFunction(this, 'CreateReceipt', {
      entry: path.join(__dirname, '../../src/receipt.ts'),
      // The function code lives one folder above the CDK app
      projectRoot: path.join(__dirname, '../..'),
      depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      layers: [pdfLayer, powertools],
      bundling: {
        minify: true,
        // Neither bundled nor installed: these come from the runtime and the layers
        externalModules: ['@aws-sdk/*', 'pdfkit', '@aws-lambda-powertools/*'],
      },
    });
  }
}
