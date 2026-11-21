// client/fan.ts
// Usage: node client/fan.ts wss://<api-id>.execute-api.eu-central-1.amazonaws.com/live blues-vs-reds
const [url, match] = process.argv.slice(2);
if (!url || !match) {
  console.error('Usage: node client/fan.ts <WebSocketUrl> <match-id>');
  process.exit(1);
}

const socket = new WebSocket(`${url}?match=${encodeURIComponent(match)}`);
let heartbeat: ReturnType<typeof setInterval> | undefined;

socket.addEventListener('open', () => {
  console.log(`Connected to match ${match}`);
  // A ping every 5 minutes so the 10-minute idle limit never kicks in.
  heartbeat = setInterval(() => socket.send(JSON.stringify({ action: 'ping' })), 5 * 60 * 1000);
  socket.send(JSON.stringify({ action: 'ping' }));
});

socket.addEventListener('message', (msg) => {
  const data = JSON.parse(String(msg.data));
  if (data.type === 'pong') console.log(`pong (${data.at})`);
  if (data.type === 'ticker') console.log(`${data.minute}'  ${data.text}${data.score ? `  [${data.score}]` : ''}`);
});

socket.addEventListener('close', (e) => {
  clearInterval(heartbeat);
  console.log(`Connection closed (code ${e.code})`);
});
