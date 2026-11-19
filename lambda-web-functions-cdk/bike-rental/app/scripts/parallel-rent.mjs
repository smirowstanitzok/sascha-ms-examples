// app/scripts/parallel-rent.mjs
// 20 customers want the same bike at once – exactly one may get it
const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";

const created = await fetch(`${baseUrl}/bikes`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model: "Cargo bike Gull" }),
}).then((r) => r.json());

const attempts = Array.from({ length: 20 }, () =>
  fetch(`${baseUrl}/bikes/${created.bikeId}/rent`, { method: "POST" }).then((r) => r.status),
);
const statuses = await Promise.all(attempts);

const count = (code) => statuses.filter((s) => s === code).length;
console.log(`200 (rented): ${count(200)}, 409 (already taken): ${count(409)}`);
process.exit(count(200) === 1 && count(409) === 19 ? 0 : 1);
