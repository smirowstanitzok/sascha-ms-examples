// test/radverleih.test.ts
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { RadverleihApiStack, RadverleihDatenStack } from '../lib/radverleih-stack';

test('API stack contains a Lambda function with a function URL', () => {
  const app = new cdk.App();
  const daten = new RadverleihDatenStack(app, 'Daten');
  const api = new RadverleihApiStack(app, 'Api', { raederTabelle: daten.raederTabelle });
  const template = Template.fromStack(api);
  template.resourceCountIs('AWS::Lambda::Function', 1);
  template.hasResourceProperties('AWS::Lambda::Url', { AuthType: 'AWS_IAM' });
});
