// app/src/index.ts
import express from "express";
import { randomUUID } from "node:crypto";
import { createBikeStore } from "./bike-store";
import { log, withRequestContext } from "./request-context";

const app = express();
app.use(express.json());
app.use(withRequestContext);

// Once per environment: expensive client, no request state
const store = createBikeStore();

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

app.post("/bikes", async (req, res) => {
  const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
  if (!model) {
    res.status(400).json({ error: "model is missing" });
    return;
  }
  const bike = { bikeId: randomUUID(), model, status: "available" as const };
  await store.create(bike);
  log("bike created", { bikeId: bike.bikeId });
  res.status(201).json(bike);
});

app.get("/bikes/:bikeId", async (req, res) => {
  const bike = await store.get(req.params.bikeId);
  if (!bike) {
    res.status(404).json({ error: "Bike not found" });
    return;
  }
  res.json(bike);
});

app.post("/bikes/:bikeId/rent", async (req, res) => {
  const result = await store.rent(req.params.bikeId);
  log("rent attempt", { bikeId: req.params.bikeId, result });
  if (result === "not-found") {
    res.status(404).json({ error: "Bike not found" });
  } else if (result === "already-rented") {
    res.status(409).json({ error: "Bike is already rented" });
  } else {
    res.status(200).json({ bikeId: req.params.bikeId, status: "rented" });
  }
});

const [host, port] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT ?? "127.0.0.1:3000").split(":");

app.listen(Number(port), host, () => {
  log("server listening", { host, port });
});
