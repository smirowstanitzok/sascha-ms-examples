// test/stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { BikeReturnStack } from '../lib/bike-return-stack.js';

function definition(): Record<string, any> {
  const template = Template.fromStack(new BikeReturnStack(new App(), 'TestStack'));
  const [machine] = Object.values(template.findResources('AWS::StepFunctions::StateMachine'));
  const parts = machine.Properties.DefinitionString['Fn::Join'][1] as unknown[];
  // Replace ARN placeholders with strings so the definition can be parsed
  return JSON.parse(parts.map((p) => (typeof p === 'string' ? p : 'ref')).join(''));
}

describe('BikeReturnStack', () => {
  const def = definition();

  it('limits the whole execution', () => {
    expect(def.TimeoutSeconds).toBe(1200);
  });

  it('sets timeout and heartbeat for the callback task', () => {
    expect(def.States.CheckBattery.TimeoutSeconds).toBe(300);
    expect(def.States.CheckBattery.HeartbeatSeconds).toBe(60);
  });

  it('waits slightly longer for the Lambda task than the function itself', () => {
    expect(def.States.CalculateFee.TimeoutSeconds).toBe(15);
  });

  it('catches timeouts and routes them to the workshop', () => {
    const catcher = def.States.CheckBattery.Catch[0];
    expect(catcher.ErrorEquals).toContain('States.Timeout');
    expect(catcher.ErrorEquals).toContain('States.HeartbeatTimeout');
    expect(catcher.Next).toBe('NotifyWorkshop');
  });
});
