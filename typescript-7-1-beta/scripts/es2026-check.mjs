// Checks which ES2026 functions the current Node.js version really supports
const checks = {
  "Array.fromAsync": () => Array.fromAsync,
  "Math.sumPrecise": () => Math.sumPrecise,
  "Map.prototype.getOrInsert": () => Map.prototype.getOrInsert,
  "Error.isError": () => Error.isError,
  "Uint8Array.fromBase64": () => Uint8Array.fromBase64,
  "Iterator.concat": () => globalThis.Iterator?.concat,
  "JSON.rawJSON": () => JSON.rawJSON,
};

console.log(`Node.js ${process.version}`);
for (const [name, get] of Object.entries(checks)) {
  const ok = typeof get() === "function";
  console.log(`${ok ? "✔" : "✘"} ${name}`);
}
