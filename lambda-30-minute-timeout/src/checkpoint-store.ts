// src/checkpoint-store.ts
export interface CheckpointState {
  nextPage: number;
  done: boolean;
}

export interface CheckpointStore {
  load(orderId: string): Promise<CheckpointState>;
  save(orderId: string, nextPage: number): Promise<void>;
  finish(orderId: string): Promise<void>;
}

// In-memory variant for tests and local experiments
export class MemoryCheckpointStore implements CheckpointStore {
  readonly items = new Map<string, CheckpointState>();

  async load(orderId: string): Promise<CheckpointState> {
    return this.items.get(orderId) ?? { nextPage: 1, done: false };
  }

  async save(orderId: string, nextPage: number): Promise<void> {
    this.items.set(orderId, { nextPage, done: false });
  }

  async finish(orderId: string): Promise<void> {
    const current = await this.load(orderId);
    this.items.set(orderId, { nextPage: current.nextPage, done: true });
  }
}
