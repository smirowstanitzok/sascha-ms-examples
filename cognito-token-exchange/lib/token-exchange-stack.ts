// lib/token-exchange-stack.ts
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const src = (file: string) => fileURLToPath(new URL(`../src/${file}`, import.meta.url));

const fn = (scope: Construct, id: string, file: string, environment?: Record<string, string>) =>
  new nodejs.NodejsFunction(scope, id, {
    entry: src(file),
    runtime: lambda.Runtime.NODEJS_24_X,
    architecture: lambda.Architecture.ARM_64,
    timeout: Duration.seconds(10),
    environment,
  });

export class TokenExchangeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. User pool on the Essentials plan (required for token exchange)
    const pool = new cognito.UserPool(this, 'Kunden', {
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      signInAliases: { email: true },
      selfSignUpEnabled: false,
      customAttributes: { ki_freigabe: new cognito.StringAttribute({ mutable: true }) },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    pool.addTrigger(
      cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
      fn(this, 'PreToken', 'pre-token.ts'),
      cognito.LambdaVersion.V2_0,
    );
    const domain = pool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: `buchladen-agent-${this.account}` },
    });

    // 2. Resource servers: the orders API and the agent itself
    const lesen = new cognito.ResourceServerScope({ scopeName: 'lesen', scopeDescription: 'Read orders' });
    const stornieren = new cognito.ResourceServerScope({ scopeName: 'stornieren', scopeDescription: 'Cancel orders' });
    const bestellungen = pool.addResourceServer('Bestellungen', { identifier: 'bestellungen', scopes: [lesen, stornieren] });

    const chat = new cognito.ResourceServerScope({ scopeName: 'chat', scopeDescription: 'Talk to the agent' });
    const handeln = new cognito.ResourceServerScope({ scopeName: 'handeln', scopeDescription: 'Agent identifies itself' });
    const agentServer = pool.addResourceServer('Agent', { identifier: 'buchladen-agent', scopes: [chat, handeln] });

    // 3. App client of the web app (public, authorization code with PKCE)
    const webClient = pool.addClient('WebApp', {
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: ['http://localhost:5173/callback'],
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.resourceServer(agentServer, chat),
          cognito.OAuthScope.resourceServer(bestellungen, lesen),
          cognito.OAuthScope.resourceServer(bestellungen, stornieren),
        ],
      },
    });

    // 4. App client of the agent: client credentials (actor token) + token exchange via delegation
    const agentClient = pool.addClient('AgentClient', {
      generateSecret: true,
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [
          cognito.OAuthScope.resourceServer(agentServer, handeln),
          cognito.OAuthScope.resourceServer(bestellungen, lesen), // upper limit for exchanged tokens
        ],
      },
    });
    // The CloudFormation schema doesn't know ALLOW_TOKEN_EXCHANGE_DELEGATION yet (as of 11/13/2026).
    // That's why scripts/enable-token-exchange.ts sets the flow after the deployment.

    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${pool.userPoolId}`;

    // 5. Orders API: only accepts tokens with aud = "bestellungen"
    const ordersApi = new HttpApi(this, 'BestellApi');
    const ordersAuth = new HttpJwtAuthorizer('BestellAuth', issuer, { jwtAudience: ['bestellungen'] });
    const ordersFn = fn(this, 'BestellFn', 'orders-api.ts');
    ordersApi.addRoutes({
      path: '/bestellungen',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('BestellLesen', ordersFn),
      authorizer: ordersAuth,
      authorizationScopes: ['bestellungen/lesen'],
    });
    ordersApi.addRoutes({
      path: '/bestellungen/{id}',
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('BestellStornieren', ordersFn),
      authorizer: ordersAuth,
      authorizationScopes: ['bestellungen/stornieren'],
    });

    // 6. Agent API: accepts web app tokens with the scope buchladen-agent/chat
    const agentFn = fn(this, 'AgentFn', 'agent.ts', {
      USER_POOL_ID: pool.userPoolId,
      AGENT_CLIENT_ID: agentClient.userPoolClientId,
      TOKEN_URL: `${domain.baseUrl()}/oauth2/token`,
      ORDERS_API_URL: ordersApi.apiEndpoint,
    });
    agentFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:DescribeUserPoolClient'],
      resources: [pool.userPoolArn],
    }));
    const agentApi = new HttpApi(this, 'AgentApi');
    agentApi.addRoutes({
      path: '/agent/bestellungen',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('AgentIntegration', agentFn),
      authorizer: new HttpJwtAuthorizer('AgentAuth', issuer, { jwtAudience: [webClient.userPoolClientId] }),
      authorizationScopes: ['buchladen-agent/chat'],
    });

    new CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });
    new CfnOutput(this, 'AgentClientId', { value: agentClient.userPoolClientId });
    new CfnOutput(this, 'WebClientId', { value: webClient.userPoolClientId });
    new CfnOutput(this, 'HostedUi', { value: domain.baseUrl() });
    new CfnOutput(this, 'AgentApiUrl', { value: agentApi.apiEndpoint });
  }
}
