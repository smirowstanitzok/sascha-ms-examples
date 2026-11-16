// lib/radverleih-stack.ts
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

// Stack 1: data – a table for the rental bikes
export class RadverleihDatenStack extends Stack {
  public readonly raederTabelle: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.raederTabelle = new dynamodb.TableV2(this, 'Raeder', {
      partitionKey: { name: 'radId', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      // Demo environments only: delete the table together with the stack
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}

interface RadverleihApiStackProps extends StackProps {
  raederTabelle: dynamodb.TableV2;
}

// Stack 2: API – a Lambda function with a function URL that returns available bikes
export class RadverleihApiStack extends Stack {
  constructor(scope: Construct, id: string, props: RadverleihApiStackProps) {
    super(scope, id, props);

    const freieRaeder = new lambda.Function(this, 'FreieRaeder', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      memorySize: 256,
      timeout: Duration.seconds(5),
      environment: { TABELLE: props.raederTabelle.tableName },
      code: lambda.Code.fromInline(`
        exports.handler = async () => ({
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ freieRaeder: [], tabelle: process.env.TABELLE }),
        });
      `),
    });

    props.raederTabelle.grantReadData(freieRaeder);

    const url = freieRaeder.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    });

    new CfnOutput(this, 'ApiUrl', { value: url.url });
  }
}
