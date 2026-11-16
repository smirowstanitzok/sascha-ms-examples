// web/main.ts
import { askAdvisor } from './sse-client.js';

const answer = document.querySelector('#answer')!;
const status = document.querySelector('#status')!;

// CloudFront forwards the path /ask to the function URL.
const stopReason = await askAdvisor('/ask', 'Where can I get a kids bike in Konstanz?', {
  onText: (text) => answer.append(text),
  onTool: (_name, state) => {
    status.textContent = state === 'start' ? 'checking availability …' : '';
  },
  onError: (message, retryable) => {
    status.textContent = retryable ? `${message} Try again?` : message;
  },
});

// Without a done event, stopReason stays "unknown": the connection dropped.
if (stopReason === 'unknown') status.textContent = 'Answer incomplete.';
