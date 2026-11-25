// src/handler.ts
import { GetFunctionConfigurationCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { firstTime } from './dedupe.ts';
import {
  buildMessage,
  classify,
  dedupeKey,
  parseFunctionArn,
  type FunctionStateEvent,
} from './state-event.ts';

const sns = new SNSClient({});
const lambda = new LambdaClient({});

const TOPIC_ARN = process.env.ALERT_TOPIC_ARN!;
const TABLE_NAME = process.env.DEDUPE_TABLE!;

// Events may arrive out of order: look up the current status.
async function currentStatus(arn: string): Promise<string | undefined> {
  const fn = parseFunctionArn(arn);
  try {
    const cfg = await lambda.send(
      new GetFunctionConfigurationCommand({ FunctionName: fn.name, Qualifier: fn.qualifier }),
    );
    return `State=${cfg.State}, LastUpdateStatus=${cfg.LastUpdateStatus}`;
  } catch {
    return undefined; // e.g. the function has been deleted in the meantime
  }
}

export const main = async (event: FunctionStateEvent): Promise<void> => {
  const severity = classify(event);
  if (severity === 'ignore') return;

  if (!(await firstTime(TABLE_NAME, dedupeKey(event)))) {
    console.log(JSON.stringify({ msg: 'Duplicate skipped', id: event.id }));
    return;
  }

  const status = severity === 'error' ? await currentStatus(event.resources[0]) : undefined;
  const { subject, body } = buildMessage(event, status);

  await sns.send(new PublishCommand({ TopicArn: TOPIC_ARN, Subject: subject, Message: body }));
  console.log(JSON.stringify({ msg: 'Notification sent', severity, subject }));
};
