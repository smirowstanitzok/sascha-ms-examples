// src/tools.ts
import type { Tool } from '@aws-sdk/client-bedrock-runtime';
import type { ToolOutput } from './chat-loop.js';

// Fictional stock of a bike rental on Lake Constance.
const STOCK: Record<string, Record<string, number>> = {
  konstanz: { trekking: 4, ebike: 0, kinder: 2 },
  lindau: { trekking: 1, ebike: 3, kinder: 0 },
  meersburg: { trekking: 0, ebike: 5, kinder: 1 },
};

export const tools: Tool[] = [
  {
    toolSpec: {
      name: 'check_availability',
      description:
        'Checks how many bikes of one type are currently available at a rental station.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            station: { type: 'string', enum: Object.keys(STOCK) },
            bikeType: { type: 'string', enum: ['trekking', 'ebike', 'kinder'] },
          },
          required: ['station', 'bikeType'],
        },
      },
    },
  },
];

type AvailabilityInput = { station?: unknown; bikeType?: unknown };

export async function runTool(
  name: string,
  input: unknown,
): Promise<ToolOutput> {
  if (name !== 'check_availability') {
    throw new Error(`Unknown tool: ${name}`);
  }
  const { station, bikeType } = (input ?? {}) as AvailabilityInput;
  if (typeof station !== 'string' || typeof bikeType !== 'string') {
    throw new Error('station and bikeType must be strings');
  }
  const available = STOCK[station]?.[bikeType];
  if (available === undefined) {
    throw new Error(`No data for ${station}/${bikeType}`);
  }
  return { station, bikeType, available };
}
