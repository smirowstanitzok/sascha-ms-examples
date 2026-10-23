// Mini type check via the new compiler API (preview in TypeScript 7.1 Beta)
import { API, formatDiagnostics } from "typescript/sync";

const api = new API({ cwd: process.cwd() });

try {
  // read tsconfig.json – returns the file list and resolved options
  const config = api.parseConfigFile("tsconfig.json");
  const program = api.createProgram(config.fileNames, config.options);

  try {
    const diagnostics = [
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ];

    if (diagnostics.length === 0) {
      console.log(`No errors in ${config.fileNames.length} files.`);
    } else {
      console.log(formatDiagnostics(diagnostics, program));
      process.exitCode = 1;
    }
  } finally {
    program.dispose(); // releases the memory on the Go side
  }
} finally {
  api.close();
}
