import { replayStream } from "./replay";
import { processRecords } from "./process";

interface ReplayEvent { from: string; until?: string }

export const handler = async (event: ReplayEvent) => {
  const from = new Date(event.from);
  if (Number.isNaN(from.getTime())) throw new Error("Bitte 'from' als ISO-Zeitpunkt angeben");
  const count = await replayStream({
    streamArn: process.env.STREAM_ARN!,
    from,
    until: event.until ? new Date(event.until) : undefined,
    handle: processRecords,
  });
  return { replayed: count };
};
