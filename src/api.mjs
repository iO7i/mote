// Stable programmatic compiler interface. It never executes imported modules.

import { compile } from "./compile.mjs";
import { Diagnostics } from "./diagnostics.mjs";

export const COMPILER = Object.freeze({ name: "mote", version: "0.1.0", diagnosticsVersion: 1 });

export function compileSource(source, options = {}) {
  const file = options.file ?? "<input>";
  try {
    const result = compile(source, options);
    return Object.freeze({
      ...result,
      envelope: diagnosticEnvelope(result.diagnostics, { file }),
    });
  } catch (error) {
    const diagnostics = new Diagnostics(file);
    diagnostics.error("M902", error instanceof Error ? error.message : "unexpected compiler failure");
    return Object.freeze({
      program: null, code: "", lineMap: [], needsRuntime: false, typeDecls: [],
      declarations: () => "", sourceMap: () => "", positionMap: () => [],
      diagnostics,
      envelope: diagnosticEnvelope(diagnostics, { file, internal: true }),
    });
  }
}

export function checkSource(source, options = {}) {
  const result = compileSource(source, { ...options, emitTypes: false });
  return Object.freeze({ ok: !result.diagnostics.hasErrors, diagnostics: result.diagnostics.items, envelope: result.envelope });
}

export function diagnosticEnvelope(diagnostics, extra = {}) {
  return {
    schemaVersion: 1,
    compiler: COMPILER,
    ok: !diagnostics.hasErrors,
    diagnostics: diagnostics.items.map((d) => ({
      code: d.code,
      severity: d.severity,
      message: d.message,
      file: d.file,
      span: { line: d.line, column: d.col },
    })),
    ...extra,
  };
}
