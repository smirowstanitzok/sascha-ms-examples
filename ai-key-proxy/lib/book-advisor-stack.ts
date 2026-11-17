// lib/book-advisor-stack.ts
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export interface BookAdvisorProps extends StackProps {
  modelId: string;
  dailyTokenLimit: number;
  alarmTokensPerHour: number;
}

export class BookAdvisorStack extends Stack {
  constructor(scope: Construct, id: string, props: BookAdvisorProps) {
    super(scope, id, props);

    const quota = new Table(this, 'AiQuota', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY, // for the example only
    });

    const chat = new NodejsFunction(this, 'ChatFunction', {
      entry: 'src/chat-handler.ts',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      reservedConcurrentExecutions: 5, // cap against exploding costs in case of abuse
      logGroup: new LogGroup(this, 'ChatLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        MODEL_ID: props.modelId,
        QUOTA_TABLE: quota.tableName,
        DAILY_TOKEN_LIMIT: String(props.dailyTokenLimit),
      },
      bundling: { minify: true, sourceMap: false },
    });
    // The function only needs UpdateItem, so that is all it gets
    quota.grant(chat, 'dynamodb:UpdateItem');

    // Least privilege: exactly one inference profile and the model behind it, no bedrock:*
    const profileArn = `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${props.modelId}`;
    const modelName = props.modelId.replace(/^(eu|us|apac|global)\./, '');
    chat.addToRolePolicy(
      new PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: [profileArn] }),
    );
    chat.addToRolePolicy(
      new PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:*::foundation-model/${modelName}`],
        conditions: { StringLike: { 'bedrock:InferenceProfileArn': profileArn } },
      }),
    );

    const readers = new UserPool(this, 'Readers', { selfSignUpEnabled: false });
    const client = readers.addClient('WebClient', { authFlows: { userSrp: true, adminUserPassword: true } });

    const api = new HttpApi(this, 'BookAdvisorApi', {
      defaultAuthorizer: new HttpUserPoolAuthorizer('ReaderAuth', readers, { userPoolClients: [client] }),
    });
    api.addRoutes({
      path: '/chat',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('ChatIntegration', chat),
    });

    // Alarm when more tokens are used in one hour than planned
    new Alarm(this, 'TokenAlarm', {
      metric: new Metric({
        namespace: 'BookAdvisor',
        metricName: 'TokensUsed',
        statistic: 'Sum',
        period: Duration.hours(1),
      }),
      threshold: props.alarmTokensPerHour,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Unusually high AI usage – check keys and accounts',
    });

    new CfnOutput(this, 'ApiUrl', { value: `${api.apiEndpoint}/chat` });
    new CfnOutput(this, 'UserPoolId', { value: readers.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
  }
}
