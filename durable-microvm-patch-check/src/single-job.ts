// src/single-job.ts
import { withDurableExecution } from "@aws/durable-execution-sdk-js";
import { microvm } from "@aws/durable-execution-sdk-js-extensions/compute/microvm";

export const handler = withDurableExecution(async (event: { text: string }, context) =>
  microvm<{ words: number }>(context, "count", { text: event.text }, {
    imageIdentifier: process.env.MICROVM_IMAGE_ARN!,
    executionRoleArn: process.env.MICROVM_ROLE_ARN!,
    timeout: { minutes: 5 },
    heartbeatTimeout: { seconds: 60 },
  }),
);
