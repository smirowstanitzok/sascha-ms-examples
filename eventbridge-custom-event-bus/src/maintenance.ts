// src/maintenance.ts
import { bikeReturnedEnvelopeSchema } from './events.ts';

// A Lambda target receives a list of events from the subscriber, not a single object
export const handler = async (input: unknown): Promise<{ scheduled: number; skipped: number }> => {
  const events = Array.isArray(input) ? input : [input];
  let scheduled = 0;
  let skipped = 0;

  for (const raw of events) {
    const parsed = bikeReturnedEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      console.warn(JSON.stringify({ msg: 'Unknown event skipped', issues: parsed.error.issues }));
      continue;
    }
    const { bikeId, kmSinceService } = parsed.data.detail;
    // In real life: create a maintenance job, e.g. in a table or a ticket system
    console.log(JSON.stringify({ msg: 'Service due', bikeId, kmSinceService }));
    scheduled += 1;
  }

  return { scheduled, skipped };
};
