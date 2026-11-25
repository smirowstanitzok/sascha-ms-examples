// src/agent.ts
// Minimal agent loop with the Bedrock Converse API and tool use.
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
  type Tool as BedrockTool,
} from '@aws-sdk/client-bedrock-runtime';
import type { Tool } from './tools.ts';

const SYSTEM_PROMPT =
  'You are the assistant of a bike rental shop. Answer questions only with ' +
  'information from the shop documents and use the tools to find it.';

export async function runAssistant(
  question: string,
  tools: Tool[],
  modelId: string,
  client: Pick<BedrockRuntimeClient, 'send'> = new BedrockRuntimeClient({}),
  maxRounds = 6,
): Promise<string> {
  const messages: Message[] = [{ role: 'user', content: [{ text: question }] }];
  const toolSpecs: BedrockTool[] = tools.map((t) => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: { json: t.inputSchema as never },
    },
  }));

  for (let round = 0; round < maxRounds; round++) {
    const response = await client.send(
      new ConverseCommand({
        modelId,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
        toolConfig: { tools: toolSpecs },
      }),
    );
    const message = response.output?.message;
    if (!message) throw new Error('Empty response from the model');
    messages.push(message);

    if (response.stopReason !== 'tool_use') {
      return (message.content ?? []).map((block) => block.text ?? '').join('').trim();
    }

    const results: ContentBlock[] = [];
    for (const block of message.content ?? []) {
      const use = block.toolUse;
      if (!use?.toolUseId) continue;
      const tool = tools.find((t) => t.name === use.name);
      let text: string;
      let status: 'success' | 'error' = 'success';
      try {
        if (!tool) throw new Error(`Unknown tool: ${use.name}`);
        text = await tool.run((use.input ?? {}) as Record<string, unknown>);
      } catch (error) {
        status = 'error';
        // The model only learns that it failed, no internal details.
        text = (error as Error).name === 'AccessDenied'
          ? 'Access denied.'
          : 'The tool failed.';
      }
      results.push({ toolResult: { toolUseId: use.toolUseId, content: [{ text }], status } });
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error('Too many tool rounds');
}
