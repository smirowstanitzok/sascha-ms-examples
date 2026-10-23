import express from "express";

const app = express();
app.use(express.json());

// State per execution environment – shared by parallel requests!
const startedAt = new Date().toISOString();

app.get("/", (_req, res) => {
  res.json({ message: "Hello from Lambda Web Functions", startedAt });
});

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

app.post("/echo", (req, res) => {
  res.status(201).json({ received: req.body });
});

// Streaming: send the response piece by piece
app.get("/stream", async (_req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  for (let i = 1; i <= 5; i++) {
    res.write(`Line ${i}\n`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  res.end();
});

// Lambda provides host and port as "host:port"; locally we use 127.0.0.1:3000
const [host, port] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT ?? "127.0.0.1:3000").split(":");

app.listen(Number(port), host, () => {
  console.log(`Server listening on ${host}:${port}`);
});
