// src/index.ts
// Lambda entry point: wires the handler to DynamoDB.
import { DynamoAusleihenRepository } from './ausleihen.ts';
import { erstelleRueckgabeHandler } from './rueckgabe.ts';

const repo = new DynamoAusleihenRepository(process.env.TABELLE ?? 'ausleihen');
export const handler = erstelleRueckgabeHandler(repo);
