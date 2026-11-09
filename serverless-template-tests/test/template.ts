// test/template.ts
import { readFileSync } from 'node:fs';

export interface CfnResource {
  Type: string;
  Properties?: Record<string, any>;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
}

export interface CfnTemplate {
  Resources: Record<string, CfnResource>;
  Outputs?: Record<string, unknown>;
}

export function loadTemplate(stage: string): CfnTemplate {
  const file = `.serverless-${stage}/cloudformation-template-update-stack.json`;
  return JSON.parse(readFileSync(file, 'utf8')) as CfnTemplate;
}

export function resourcesOfType(template: CfnTemplate, type: string): [string, CfnResource][] {
  return Object.entries(template.Resources).filter(([, r]) => r.Type === type);
}

export function onlyResourceOfType(template: CfnTemplate, type: string): CfnResource {
  const found = resourcesOfType(template, type);
  if (found.length !== 1) {
    throw new Error(`Expected exactly one resource of type ${type}, found: ${found.length}`);
  }
  return found[0][1];
}
