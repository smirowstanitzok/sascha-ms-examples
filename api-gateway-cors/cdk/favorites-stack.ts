// cdk/favorites-stack.ts
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';

interface FavoritesStackProps extends StackProps {
  frontendOrigins: string[];
}

export class FavoritesStack extends Stack {
  constructor(scope: Construct, id: string, props: FavoritesStackProps) {
    super(scope, id, props);

    const favoritesFn = new NodejsFunction(this, 'FavoritesFunction', {
      entry: 'src/favorites.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(5),
    });

    const url = favoritesFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        // With credentials: exact origins only, no "*"
        allowedOrigins: props.frontendOrigins,
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.PUT],
        allowedHeaders: ['content-type'],
        allowCredentials: true,
        maxAge: Duration.hours(1),
      },
    });

    new CfnOutput(this, 'FavoritesUrl', { value: url.url });
  }
}
