// src/batch-records.ts
// Pure helper functions without AWS calls, which makes them easy to test.

export interface Review {
  reviewId: string;
  bookTitle: string;
  text: string;
}

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Classification {
  sentiment: Sentiment;
  topics: string[];
  summary: string;
}

export const ALLOWED_TOPICS = ['plot', 'characters', 'language', 'price', 'delivery', 'edition'] as const;

const SYSTEM_PROMPT =
  'You classify book reviews for a bookshop. ' +
  'Respond only with JSON in the format ' +
  '{"sentiment":"positive|neutral|negative","topics":["…"],"summary":"…"}. ' +
  `Allowed topics: ${ALLOWED_TOPICS.join(', ')}. At most three topics, summary at most 20 words.`;

// One record in Converse format: recordId + modelInput.
export function toBatchRecord(review: Review, maxTokens = 300): string {
  const record = {
    recordId: review.reviewId,
    modelInput: {
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [{ text: `Book: ${review.bookTitle}\nReview: ${review.text}` }],
        },
      ],
      inferenceConfig: { maxTokens, temperature: 0 },
    },
  };
  return JSON.stringify(record);
}

export function toJsonl(reviews: Review[]): string {
  return reviews.map((r) => toBatchRecord(r)).join('\n') + '\n';
}

// Extracts the JSON from the model response, even if it is wrapped in a Markdown block.
export function parseClassification(text: string): Classification {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in the model response');
  const raw = JSON.parse(match[0]) as Partial<Classification>;

  if (raw.sentiment !== 'positive' && raw.sentiment !== 'neutral' && raw.sentiment !== 'negative') {
    throw new Error(`Unknown sentiment: ${String(raw.sentiment)}`);
  }
  const topics = Array.isArray(raw.topics)
    ? raw.topics.filter((t): t is string => (ALLOWED_TOPICS as readonly string[]).includes(String(t))).slice(0, 3)
    : [];
  return { sentiment: raw.sentiment, topics, summary: String(raw.summary ?? '').slice(0, 200) };
}

export type LineResult =
  | { recordId: string; ok: true; classification: Classification }
  | { recordId: string; ok: false; reason: string };

// Evaluates one line of the output file (*.jsonl.out).
export function parseOutputLine(line: string): LineResult {
  const row = JSON.parse(line) as {
    recordId?: string;
    modelOutput?: { output?: { message?: { content?: { text?: string }[] } } };
    error?: { errorCode?: number; errorMessage?: string };
  };
  const recordId = row.recordId ?? 'unknown';

  if (row.error) {
    return { recordId, ok: false, reason: `${row.error.errorCode ?? '?'}: ${row.error.errorMessage ?? ''}` };
  }
  const text = (row.modelOutput?.output?.message?.content ?? [])
    .map((c) => c.text ?? '')
    .join('');
  try {
    return { recordId, ok: true, classification: parseClassification(text) };
  } catch (err) {
    return { recordId, ok: false, reason: (err as Error).message };
  }
}

// The job ID is the last segment of the job ARN.
export function jobIdFromArn(jobArn: string): string {
  const id = jobArn.split('/').pop();
  if (!id) throw new Error(`Invalid job ARN: ${jobArn}`);
  return id;
}

// Name for one nightly run, used as both job name and idempotency token.
export function runNameForDate(date: Date): string {
  return `reviews-${date.toISOString().slice(0, 10)}`;
}
