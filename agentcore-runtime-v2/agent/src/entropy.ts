// agent/src/entropy.ts
import { closeSync, openSync, readSync } from 'node:fs';

// Reads fresh bytes from the kernel on every call.
// Do not use node:crypto here: on AgentCore Runtime V2 its OpenSSL state
// is copied into the snapshot and can repeat across restored instances.
export function freshBytes(size: number): Buffer {
  const buf = Buffer.alloc(size);
  const fd = openSync('/dev/urandom', 'r');
  try {
    let offset = 0;
    while (offset < size) {
      offset += readSync(fd, buf, offset, size - offset, null);
    }
  } finally {
    closeSync(fd);
  }
  return buf;
}

// UUID v4 built from kernel entropy
export function freshId(): string {
  const b = freshBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
