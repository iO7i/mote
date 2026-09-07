// Mote v0.2 compile pipeline:
//   source -> lex -> parse -> check (type/diagnostics) -> emit TS/JS.

import { parse } from "./parser.mjs";
import { check } from "./checker.mjs";
import { emit, emitDeclarations, buildSourceMap } from "./emitter.mjs";

export function compile(src, opts = {}) {
  const file = opts.file ?? "<input>";
  const program = parse(src, file);
  const checked = check(program, { file, strict: opts.strict });

  const ctx = {
    needsRuntime: checked.needsRuntime,
    typeDecls: checked.typeDecls,
    runtimeImport: opts.runtimeImport,
    emitTypes: opts.emitTypes,
  };
  const { code, lineMap } = emit(program, ctx);

  return {
    program,
    code,
    lineMap,
    diagnostics: checked.diagnostics,
    needsRuntime: checked.needsRuntime,
    typeDecls: checked.typeDecls,
    declarations: () => emitDeclarations(program),
    sourceMap: (generatedFile) => buildSourceMap(lineMap, file, src, generatedFile),
  };
}
