// src/models.ts
// Model profiles in one place: switching models means changing only this file.
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ModelProfile {
  /** Claude API model ID (on Amazon Bedrock: anthropic.<id>) */
  id: string;
  /** Set explicitly because the defaults differ per model */
  effort: Effort;
  /** Thinking tokens count too – so be generous */
  maxTokens: number;
}

export const PROFILES = {
  // Everyday work: reviews, summaries, most agent steps
  daily: { id: 'claude-opus-5-5', effort: 'medium', maxTokens: 32_000 },
  // The hard problems: large migrations, long agent runs
  heavy: { id: 'claude-fable-5-2', effort: 'high', maxTokens: 64_000 },
  // High volume, little reasoning: classification, extraction
  bulk: { id: 'claude-haiku-5-5', effort: 'low', maxTokens: 8_000 },
} as const satisfies Record<string, ModelProfile>;

// Fallback models to use when Fable 5.2 declines a request
export const FALLBACK_MODELS = ['claude-opus-4-8'] as const;
