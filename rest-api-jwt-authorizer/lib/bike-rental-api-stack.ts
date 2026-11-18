// lib/bike-rental-api-stack.ts
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class BikeRentalApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1) Identity provider: a user pool for machine clients only
    const pool = new cognito.UserPool(this, 'MachinePool', {
      selfSignUpEnabled: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const domain = pool.addDomain('TokenDomain', {
      cognitoDomain: { domainPrefix: `bike-rental-${cdk.Aws.ACCOUNT_ID}` },
    });

    const readBikes = new cognito.ResourceServerScope({
      scopeName: 'bikes:read',
      scopeDescription: 'Read bikes and availability',
    });
    const writeRentals = new cognito.ResourceServerScope({
      scopeName: 'rentals:write',
      scopeDescription: 'Create rentals',
    });
    const server = pool.addResourceServer('BikeRentalServer', {
      identifier: 'bike-rental',
      scopes: [readBikes, writeRentals],
    });

    // Station display board: read only
    const stationDisplay = pool.addClient('StationDisplay', {
      generateSecret: true,
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [cognito.OAuthScope.resourceServer(server, readBikes)],
      },
    });
    // Booking app: may read and create rentals
    const bookingApp = pool.addClient('BookingApp', {
      generateSecret: true,
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [
          cognito.OAuthScope.resourceServer(server, readBikes),
          cognito.OAuthScope.resourceServer(server, writeRentals),
        ],
      },
    });

    // 2) Lambda functions behind the API
    const fnDefaults = {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(5),
    };
    const listBikes = new NodejsFunction(this, 'ListBikesFn', {
      ...fnDefaults,
      entry: path.join(__dirname, '../src/list-bikes.ts'),
    });
    const createRental = new NodejsFunction(this, 'CreateRentalFn', {
      ...fnDefaults,
      entry: path.join(__dirname, '../src/create-rental.ts'),
    });

    // 3) REST API with JWT authorizer
    const api = new apigw.RestApi(this, 'BikeRentalApi', {
      restApiName: 'bike-rental',
      deployOptions: { stageName: 'v1' },
    });

    const cognitoIssuer = `https://cognito-idp.${cdk.Aws.REGION}.amazonaws.com/${pool.userPoolId}`;
    const issuers: Record<string, unknown>[] = [
      {
        Issuer: cognitoIssuer,
        // For Cognito access tokens, API Gateway checks client_id instead of aud
        Audiences: [stationDisplay.userPoolClientId, bookingApp.userPoolClientId],
      },
    ];
    // Optional: second issuer, e.g. Okta, Auth0 or Entra ID
    const extraIssuer = this.node.tryGetContext('extraIssuer') as string | undefined;
    const extraAudience = this.node.tryGetContext('extraAudience') as string | undefined;
    if (extraIssuer && extraAudience) {
      issuers.push({ Issuer: extraIssuer, Audiences: [extraAudience] });
    }

    // CDK 2.277 does not know JwtConfiguration as a property yet, hence the override
    const authorizer = new apigw.CfnAuthorizer(this, 'JwtAuthorizer', {
      restApiId: api.restApiId,
      name: 'bike-rental-jwt',
      type: 'JWT',
      identitySource: 'method.request.header.Authorization',
    });
    authorizer.addPropertyOverride('JwtConfiguration', {
      DefaultAlgorithms: ['RS256'],
      Issuers: issuers,
    });

    const jwtAuthorizer: apigw.IAuthorizer = {
      authorizerId: authorizer.ref,
      authorizationType: 'JWT' as apigw.AuthorizationType,
    };

    // The L2 construct only sets scopes for COGNITO_USER_POOLS, so set them ourselves
    const requireScopes = (method: apigw.Method, scopes: string[]) => {
      (method.node.defaultChild as apigw.CfnMethod).addPropertyOverride('AuthorizationScopes', scopes);
      // Overrides are not part of the deployment hash: add them on purpose
      // so that a scope change also triggers a new deployment
      api.latestDeployment?.addToLogicalId({ [method.node.path]: scopes });
    };

    const bikes = api.root.addResource('bikes');
    const getBikes = bikes.addMethod('GET', new apigw.LambdaIntegration(listBikes), {
      authorizer: jwtAuthorizer,
    });
    // Cognito writes scopes as "<resource server>/<scope>", other IdPs often without a prefix
    requireScopes(getBikes, ['bike-rental/bikes:read', 'bikes:read']);

    const rentals = api.root.addResource('rentals');
    const postRental = rentals.addMethod('POST', new apigw.LambdaIntegration(createRental), {
      authorizer: jwtAuthorizer,
    });
    requireScopes(postRental, ['bike-rental/rentals:write', 'rentals:write']);

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'TokenUrl', { value: `${domain.baseUrl()}/oauth2/token` });
    new cdk.CfnOutput(this, 'Issuer', { value: cognitoIssuer });
    new cdk.CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });
    new cdk.CfnOutput(this, 'StationDisplayClientId', { value: stationDisplay.userPoolClientId });
    new cdk.CfnOutput(this, 'BookingAppClientId', { value: bookingApp.userPoolClientId });
  }
}
