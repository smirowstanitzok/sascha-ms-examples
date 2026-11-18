// cdk/app.ts
import * as path from 'node:path';
import { App, Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

class BikeRentalReportStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Test network: public subnets without NAT gateway (for production: private subnets + VPC endpoints)
    const vpc = new ec2.Vpc(this, 'ReportVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC }],
    });
    const securityGroup = new ec2.SecurityGroup(this, 'ReportSg', { vpc, allowAllOutbound: true });

    const capacityProvider = new lambda.CapacityProvider(this, 'ReportCapacity', {
      subnets: vpc.publicSubnets,
      securityGroups: [securityGroup],
      architectures: [lambda.Architecture.ARM_64],
      maxVCpuCount: 16,
    });

    const fn = new NodejsFunction(this, 'MaintenanceReport', {
      entry: path.join(__dirname, '..', 'src', 'handler.ts'),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64, // must match the capacity provider
      memorySize: 2048,
      timeout: Duration.minutes(5),
    });

    capacityProvider.addFunction(fn, {
      perExecutionEnvironmentMaxConcurrency: 32,
      publishToLatestPublished: true,
      // Scale to zero: minimum 0, maximum greater than 0
      latestPublishedScalingConfig: { minExecutionEnvironments: 0, maxExecutionEnvironments: 6 },
    });
  }
}

const app = new App();
new BikeRentalReportStack(app, 'BikeRentalReportStack');
