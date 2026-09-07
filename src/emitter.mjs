// Mote v0.2 emitter — typed AST -> readable TypeScript (or plain JS for `run`).
// Type-checking already happened; this stage only renders. It emits the runtime
// import, a `$schemas` registry, `type` declarations, and functions with
// resolved annotations. Set ctx.emitTypes=false to produce runnable JavaScript.

import { tsProperty, tsType, schemaLiteral } from "./schema.mjs";

const OPMAP = { "==": "===", "!=": "!==" };
const PREC = {
  "??": 2, "||": 3, "&&": 4,
  "==": 5, "!=": 5,
  "<": 6, ">": 6, "<=": 6, ">=": 6,
  "+": 7, "-": 7,
  "*": 8, "/": 8, "%": 8,
};

function precOf(node) {
  switch (node.kind) {
    case "Ternary": return 1;
    case "Try": return 10;
    case "Binary": return PREC[node.op];
    case "Unary": case "Await": return 9;
    case "Member": case "Call": case "Index": return 10;
    default: return 11;
  }
}

let TYPES = true; // set per emit() call; controls TS-only output (annotations, generics)

export function emit(program, ctx = {}) {
  const emitTypes = ctx.emitTypes !== false;
  TYPES = emitTypes;
  const runtimeImport = ctx.runtimeImport ?? "./mote-runtime.js";
  const chunks = [];   // { text, srcLine }
  const push = (text, srcLine) => chunks.push({ text, srcLine });

  if (ctx.needsRuntime) push(`import * as $mote from ${JSON.stringify(runtimeImport)};`, 1);

  for (const s of program.body) if (s.kind === "Use") push(emitUse(s, ctx), s.line);

  if (emitTypes) {
    for (const s of program.body) if (s.kind === "TypeDecl") push(emitTypeDecl(s), s.line);
  }

  if (ctx.needsRuntime && ctx.typeDecls?.length) push(emitSchemas(ctx.typeDecls, emitTypes), 1);

  for (const s of program.body) {
    if (s.kind === "Fn") push(emitFn(s, emitTypes), s.line);
    else if (s.kind === "Let") push(emitLet(s, emitTypes), s.line);
    else if (s.kind === "ExprStmt") push(`${emitExpr(s.expr, 0)};`, s.line);
  }

  const { code, lineMap } = assemble(chunks);
  return { code, lineMap };
}

function assemble(chunks) {
  const lines = [];
  const lineMap = []; // [{ genLine (1-based), srcLine }]
  chunks.forEach((c, i) => {
    if (i > 0) lines.push("");
    for (const ln of c.text.split("\n")) {
      lines.push(ln);
      lineMap.push({ genLine: lines.length, srcLine: c.srcLine ?? 1 });
    }
  });
  return { code: lines.join("\n") + "\n", lineMap };
}

function emitUse(s, ctx) {
  // Parser preserves the original quoted literal for exact source rendering.
  // Decode only when the directory compiler needs to rewrite a local .mt edge.
  let decoded;
  try { decoded = JSON.parse(s.module); } catch {
    decoded = /^['"].*['"]$/.test(s.module) ? s.module.slice(1, -1) : null;
  }
  const rewritten = decoded && ctx.resolveImport ? ctx.resolveImport(decoded) : null;
  return `import * as ${s.alias} from ${rewritten ? JSON.stringify(rewritten) : s.module};`;
}

function emitTypeDecl(s) {
  if (!s.typeR) return `// type ${s.name} (unresolved)`;
  const tp = s.typeParams?.length ? `<${s.typeParams.join(", ")}>` : "";
  return `type ${s.name}${tp} = ${tsType(s.typeR)};`;
}

function emitSchemas(typeDecls, emitTypes) {
  const lines = [emitTypes ? "const $schemas: $mote.Registry = {};" : "const $schemas = {};"];
  for (const d of typeDecls) {
    lines.push(`$schemas[${JSON.stringify(d.name)}] = ${schemaLiteral(d.type)};`);
  }
  return lines.join("\n");
}

function emitFn(s, emitTypes) {
  const kw = `${s.pub ? "export " : ""}${s.isAsync ? "async " : ""}function`;
  const tp = emitTypes && s.typeParams?.length ? `<${s.typeParams.join(", ")}>` : "";
  const params = s.params.map((p, i) => {
    if (!emitTypes) return p.name;
    const t = s.paramTypesR?.[i];
    return t ? `${p.name}: ${tsType(t)}` : p.name;
  }).join(", ");
  let ret = "";
  if (emitTypes && s.retTypeR) {
    const rt = tsType(s.retTypeR);
    ret = `: ${s.isAsync ? `Promise<${rt}>` : rt}`;
  }
  return `${kw} ${s.name}${tp}(${params})${ret} {\n  return ${emitExpr(s.body, 1)};\n}`;
}

function emitLet(s, emitTypes) {
  const ann = emitTypes && s.type ? `: ${tsType(s.typeR)}` : "";
  return `const ${s.name}${ann} = ${emitExpr(s.init, 0)};`;
}

function emitExpr(node, indent) {
  switch (node.kind) {
    case "Num": return node.raw;
    case "Str": return node.raw;
    case "Bool": return node.value ? "true" : "false";
    case "Nil": return "null";
    case "Ident": return node.name;

    case "Member": return `${wrap(node.obj, 10, indent)}.${node.prop}`;
    case "Index": return `${wrap(node.obj, 10, indent)}[${emitExpr(node.index, indent)}]`;

    case "Call": return emitCall(node, indent);

    case "Try":
      return `$mote.unwrap(${emitExpr(node.expr, indent)})`;

    case "Await":
      return `await ${wrap(node.operand, 9, indent)}`;

    case "Unary":
      return `${node.op}${wrap(node.operand, 9, indent)}`;

    case "Binary": {
      const op = OPMAP[node.op] ?? node.op;
      const p = PREC[node.op];
      return `${wrapBin(node.left, p, "left", node.op, indent)} ${op} ` +
             `${wrapBin(node.right, p, "right", node.op, indent)}`;
    }

    case "Ternary": {
      const cond = wrap(node.cond, 2, indent);
      const yes = wrap(node.yes, 2, indent);
      const no = emitExpr(node.no, indent);
      return `${cond} ? ${yes} : ${no}`;
    }

    case "Object": return emitObject(node, indent);
    case "Array": return `[${node.elements.map((e) => emitExpr(e, indent)).join(", ")}]`;

    default:
      throw new Error(`cannot emit expression '${node.kind}'`);
  }
}

function emitCall(node, indent) {
  // trusted cast: no runtime, no schema. `(value as T)` in TS; bare value in JS.
  if (node.builtin === "cast") {
    const v = emitExpr(node.args[0], indent);
    return TYPES && node.castTypeR ? `(${v} as ${tsType(node.castTypeR)})` : v;
  }
  // runtime validator builtins
  if (node.builtin === "json" || node.builtin === "env" || node.builtin === "check") {
    const args = node.args.map((a) => emitExpr(a, indent)).join(", ");
    const generic = TYPES ? `<${node.typeName}>` : "";
    return `$mote.${node.builtin}${generic}(${args}, $schemas, ${JSON.stringify(node.typeName)})`;
  }
  const callee = wrap(node.callee, 10, indent);
  const args = node.args.map((a) => emitExpr(a, indent)).join(", ");
  return `${callee}(${args})`;
}

function wrap(node, parentPrec, indent) {
  const s = emitExpr(node, indent);
  return precOf(node) < parentPrec ? `(${s})` : s;
}

function wrapBin(node, parentPrec, side, parentOp, indent) {
  const s = emitExpr(node, indent);
  const cp = precOf(node);
  let need = cp < parentPrec || (cp === parentPrec && side === "right");
  if (node.kind === "Binary") {
    const logical = node.op === "||" || node.op === "&&";
    if (parentOp === "??" && logical) need = true;
    if ((parentOp === "||" || parentOp === "&&") && node.op === "??") need = true;
  }
  return need ? `(${s})` : s;
}

function emitObject(node, indent) {
  if (node.props.length === 0) return "{}";
  const pad = "  ".repeat(indent + 1);
  const closePad = "  ".repeat(indent);
  const parts = node.props.map((p) => `${pad}${tsProperty(p.key)}: ${emitExpr(p.value, indent + 1)},`);
  return `{\n${parts.join("\n")}\n${closePad}}`;
}

// --- declaration (.d.ts) output ------------------------------------------

export function emitDeclarations(program) {
  const lines = [];
  for (const s of program.body) {
    if (s.kind === "TypeDecl") {
      const tp = s.typeParams?.length ? `<${s.typeParams.join(", ")}>` : "";
      lines.push(`export type ${s.name}${tp} = ${tsType(s.typeR)};`);
    }
  }
  for (const s of program.body) {
    if (s.kind === "Fn" && s.pub) {
      const tp = s.typeParams?.length ? `<${s.typeParams.join(", ")}>` : "";
      const params = s.params.map((p, i) =>
        `${p.name}: ${s.paramTypesR?.[i] ? tsType(s.paramTypesR[i]) : "unknown"}`).join(", ");
      const ret = s.retTypeR ? tsType(s.retTypeR) : "unknown";
      lines.push(`export declare function ${s.name}${tp}(${params}): ${ret};`);
    }
  }
  return lines.join("\n") + "\n";
}

// --- coarse source map (Mote -> emitted TS), line granularity ------------

export function buildSourceMap(lineMap, sourceFile, sourceContent, generatedFile) {
  const vlq = makeVlq();
  let prevSrcLine = 0;
  const segments = lineMap.map((m) => {
    const seg = vlq([0, 0, m.srcLine - 1 - prevSrcLine, 0]);
    prevSrcLine = m.srcLine - 1;
    return seg;
  });
  return JSON.stringify({
    version: 3,
    file: generatedFile,
    sources: [sourceFile],
    sourcesContent: [sourceContent],
    names: [],
    mappings: segments.join(";"),
  });
}

function makeVlq() {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const encode = (n) => {
    let v = n < 0 ? ((-n) << 1) | 1 : n << 1;
    let out = "";
    do {
      let digit = v & 31;
      v >>>= 5;
      if (v > 0) digit |= 32;
      out += CHARS[digit];
    } while (v > 0);
    return out;
  };
  return (nums) => nums.map(encode).join("");
}
