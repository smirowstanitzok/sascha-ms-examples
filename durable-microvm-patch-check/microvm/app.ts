// microvm/app.ts
import { join } from "node:path";
import { startMicrovmWorker } from "@aws/durable-execution-sdk-js-compute-worker/microvm";
import { writeFiles, runTests, type SourceFile, type TestResult } from "./check.ts";

type Prepared = { directory: string; fileCount: number };

const WORKSPACE = "/tmp/patch-check";

// Lambda starts this process when it builds the image and then takes a
// snapshot. So the worker must listen right away (port 8080).
await startMicrovmWorker<unknown, Prepared | TestResult>({
  routes: {
    // Job 1: write the patch files into the workspace
    "/prepare": async (input, context) => {
      const { patchId, files } = input as { patchId: string; files: SourceFile[] };
      const directory = join(WORKSPACE, patchId.replace(/[^\w-]/g, "_"));
      await writeFiles(directory, files);
      context.logger.info("Patch prepared", { patchId, count: files.length });
      return { directory, fileCount: files.length };
    },
    // Job 2: run the tests in the same workspace
    "/test": async (input, context) => {
      const { directory } = input as { directory: string };
      return runTests(directory, context.signal);
    },
  },
});
