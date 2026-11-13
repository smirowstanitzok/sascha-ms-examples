// test/mahnlauf.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import sendeErinnerung from "../src/erinnerung";
import { mahnlauf } from "../src/mahnlauf";

// Vitest: the factory returns an object with all exports, including the default export
vi.mock("../src/erinnerung", () => ({ default: vi.fn() }));

// Partial mock: importOriginal loads the real module asynchronously, so the factory is async
vi.mock("../src/leihfrist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/leihfrist")>()),
  istUeberfaellig: vi.fn((rueckgabe: Date) => rueckgabe.getUTCFullYear() < 2026),
}));

const erinnerung = vi.mocked(sendeErinnerung);

describe("mahnlauf", () => {
  // Curly braces: if a hook returns a function, Vitest calls it as a cleanup function
  beforeEach(() => {
    erinnerung.mockClear();
  });

  it("reminds only for overdue loans", async () => {
    const anzahl = await mahnlauf([
      { leserId: "l-1", titel: "The City of Clocks", rueckgabe: "2025-12-01T00:00:00Z" },
      { leserId: "l-2", titel: "Fog over Kiel", rueckgabe: "2026-12-24T00:00:00Z" },
    ]);
    expect(anzahl).toBe(1);
    expect(erinnerung).toHaveBeenCalledTimes(1);
    expect(erinnerung).toHaveBeenCalledWith("l-1", "The City of Clocks");
  });

  it("sends nothing when everything is on time", async () => {
    await mahnlauf([]);
    expect(erinnerung).not.toHaveBeenCalled();
  });
});
