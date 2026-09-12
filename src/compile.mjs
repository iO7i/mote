// Mote v0.2 compile pipeline:
//   source -> lex -> parse -> check (type/diagnostics) -> emit TS/JS.

import { parse } from "./parser.mjs";
import { check } from "./checker.mjs";
import { emit, emitDeclarations, buildSourceMap, buildPositionMap } from "./emitter.mjs";
import { Diagnostics, controlledDiagnostic } from "./diagnostics.mjs";

export function compile(src, opts = {}) {
  const file = opts.file ?? "<input>";
  let program;
  try {
    program = parse(src, file);
  } catch (error) {
    if (!error?.mote) throw error;
    const diagnostics = new Diagnostics(file);
    diagnostics.add(controlledDiagnostic(error, file));
    return emptyResult(diagnostics);
  }
  const checked = check(program, { file, strict: opts.strict });
  if (checked.diagnostics.hasErrors) {
    return {
      program,
      code: "",
      lineMap: [],
      diagnostics: checked.diagnostics,
      needsRuntime: checked.needsRuntime,
      typeDecls: checked.typeDecls,
      declarations: () => "",
      sourceMap: () => "",
      positionMap: () => [],
    };
  }

  const ctx = {
    needsRuntime: checked.needsRuntime,
    typeDecls: checked.typeDecls,
    runtimeImport: opts.runtimeImport,
    resolveImport: opts.resolveImport,
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
    positionMap: () => buildPositionMap(lineMap),
  };
}

function emptyResult(diagnostics) {
  return {
    program: null,
    code: "",
    lineMap: [],
    diagnostics,
    needsRuntime: false,
    typeDecls: [],
    declarations: () => "",
    sourceMap: () => "",
    positionMap: () => [],
  };
}
