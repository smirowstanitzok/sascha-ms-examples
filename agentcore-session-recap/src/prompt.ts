// src/prompt.ts
import type { Message } from "@aws-sdk/client-bedrock-runtime";
import type { RecapEntry, Turn } from "./memory.ts";

const BASE_PROMPT =
  "You are the support assistant of Radwerk, a small bike rental. " +
  "Answer briefly and kindly. Never invent bookings or prices.";

// Earlier sessions only arrive as compact recaps, never as the full transcript.
export function buildSystemPrompt(history: RecapEntry[], currentSessionId: string): string {
  const earlier = history.filter((entry) => entry.sessionId !== currentSessionId);
  if (earlier.length === 0) return BASE_PROMPT;
  const lines = earlier.map(
    (entry) => `- ${entry.updatedAt.toISOString().slice(0, 10)}: ${entry.text.replace(/\s+/g, " ").trim()}`,
  );
  return `${BASE_PROMPT}\n\nWhat happened in earlier conversations with this customer:\n${lines.join("\n")}`;
}

// The Converse API expects alternating roles that start with "user".
export function toConverseMessages(turns: Turn[], newMessage: string): Message[] {
  const all: Turn[] = [...turns, { role: "USER", text: newMessage }];
  const messages: Message[] = [];
  for (const turn of all) {
    const role = turn.role === "USER" ? "user" : "assistant";
    const last = messages.at(-1);
    if (last && last.role === role) {
      last.content = [{ text: `${last.content?.[0]?.text ?? ""}\n${turn.text}` }];
    } else {
      messages.push({ role, content: [{ text: turn.text }] });
    }
  }
  while (messages[0]?.role === "assistant") messages.shift();
  return messages;
}
