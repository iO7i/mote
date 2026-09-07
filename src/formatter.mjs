// Mote formatter — two projections of the SAME AST:
//   compact:  token-conscious canonical form (minimal whitespace)
//   readable: expanded whitespace/indentation for human review
// Both must re-parse to an identical AST (see formatter round-trip tests).

export function formatMote(program, mode = "compact") {
  const r = mode === "readable";
  const out = program.body.map((s) => formatStmt(s, r));
  return out.join(r ? "\n\n" : "\n") + "\n";
}

function formatStmt(s, r) {
  switch (s.kind) {
    case "Use":
      return `use ${s.module} as ${s.alias}`;
    case "TypeDecl": {
      const tp = s.typeParams?.length ? `<${s.typeParams.join(r ? ", " : ",")}>` : "";
      const eq = r ? " = " : "=";
      return `type ${s.name}${tp}${eq}${formatType(s.type, r, 0)}`;
    }
    case "Fn": {
      const kw = `${s.pub ? "pub " : ""}${s.isAsync ? "async " : ""}fn `;
      const tp = s.typeParams?.length ? `<${s.typeParams.join(r ? ", " : ",")}>` : "";
      const params = s.params.map((p) =>
        p.type ? `${p.name}${r ? ": " : ":"}${formatType(p.type, r, 0)}` : p.name)
        .join(r ? ", " : ",");
      const ret = s.retType ? `${r ? " -> " : "->"}${formatType(s.retType, r, 0)}` : "";
      const body = formatExpr(s.body, r, 0);
      const eq = r ? " =\n  " : "=";
      return `${kw}${s.name}${tp}(${params})${ret}${eq}${body}`;
    }
    case "Let": {
      const ann = s.type ? `${r ? ": " : ":"}${formatType(s.type, r, 0)}` : "";
      const eq = r ? " = " : "=";
      return `let ${s.name}${ann}${eq}${formatExpr(s.init, r, 0)}`;
    }
    case "ExprStmt":
      return formatExpr(s.expr, r, 0);
    default:
      throw new Error(`cannot format statement '${s.kind}'`);
  }
}

// --- types ---------------------------------------------------------------

function formatType(t, r, indent) {
  switch (t.kind) {
    case "TName":
      return t.args?.length
        ? `${t.name}<${t.args.map((a) => formatType(a, r, indent)).join(r ? ", " : ",")}>`
        : t.name;
    case "TOptional":
      return `${formatType(t.inner, r, indent)}?`;
    case "TUnion":
      return t.options.map((o) => formatType(o, r, indent)).join(r ? " | " : "|");
    case "TArray":
      return `[${formatType(t.element, r, indent)}]`;
    case "TObject":
      return formatObjectType(t, r, indent);
    default:
      throw new Error(`cannot format type '${t.kind}'`);
  }
}

function formatObjectType(t, r, indent) {
  if (!t.fields.length) return "{}";
  const field = (f) => `${f.name}:${formatType(f.type, r, indent + 1)}`;
  if (!r) return `{${t.fields.map(field).join(",")}}`;
  const pad = "  ".repeat(indent + 1);
  const close = "  ".repeat(indent);
  const parts = t.fields.map((f) => `${pad}${f.name}: ${formatType(f.type, r, indent + 1)}`);
  return `{\n${parts.join(",\n")}\n${close}}`;
}

// --- expressions ---------------------------------------------------------

const SP = (r, op) => (r ? ` ${op} ` : op);

function formatExpr(node, r, indent) {
  switch (node.kind) {
    case "Num": return node.raw;
    case "Str": return node.raw;
    case "Bool": return node.value ? "true" : "false";
    case "Nil": return "nil";
    case "Ident": return node.name;

    case "Member": return `${paren(node.obj, 10, r, indent)}.${node.prop}`;
    case "Index": return `${paren(node.obj, 10, r, indent)}[${formatExpr(node.index, r, indent)}]`;

    case "Call": {
      const ta = node.typeArgs?.length
        ? `<${node.typeArgs.map((t) => formatType(t, r, indent)).join(r ? ", " : ",")}>` : "";
      const callee = paren(node.callee, 10, r, indent);
      const args = node.args.map((a) => formatExpr(a, r, indent)).join(r ? ", " : ",");
      return `${callee}${ta}(${args})`;
    }

    case "Try": return `${paren(node.expr, 10, r, indent)}?`;

    case "Await": return `await ${paren(node.operand, 9, r, indent)}`;

    case "Unary": return `${node.op}${paren(node.operand, 9, r, indent)}`;

    case "Binary": {
      const p = PREC[node.op];
      return `${parenBin(node.left, p, "left", node.op, r, indent)}${SP(r, node.op)}` +
             `${parenBin(node.right, p, "right", node.op, r, indent)}`;
    }

    case "Ternary": {
      const c = paren(node.cond, 2, r, indent);
      const y = paren(node.yes, 2, r, indent);
      const n = formatExpr(node.no, r, indent);
      return r ? `${c} ? ${y} : ${n}` : `${c}?${y}:${n}`;
    }

    case "Object": return formatObject(node, r, indent);
    case "Array":
      return `[${node.elements.map((e) => formatExpr(e, r, indent)).join(r ? ", " : ",")}]`;

    default:
      throw new Error(`cannot format expression '${node.kind}'`);
  }
}

const PREC = {
  "??": 2, "||": 3, "&&": 4,
  "==": 5, "!=": 5, "<": 6, ">": 6, "<=": 6, ">=": 6,
  "+": 7, "-": 7, "*": 8, "/": 8, "%": 8,
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

function paren(node, parentPrec, r, indent) {
  const s = formatExpr(node, r, indent);
  return precOf(node) < parentPrec ? `(${s})` : s;
}

function parenBin(node, parentPrec, side, parentOp, r, indent) {
  const s = formatExpr(node, r, indent);
  const cp = precOf(node);
  let need = cp < parentPrec || (cp === parentPrec && side === "right");
  if (node.kind === "Binary") {
    const logical = node.op === "||" || node.op === "&&";
    if (parentOp === "??" && logical) need = true;
    if ((parentOp === "||" || parentOp === "&&") && node.op === "??") need = true;
  }
  return need ? `(${s})` : s;
}

function formatObject(node, r, indent) {
  if (!node.props.length) return "{}";
  const key = (p) => (p.keyIsString ? p.key : p.key);
  if (!r) return `{${node.props.map((p) => `${key(p)}:${formatExpr(p.value, r, indent + 1)}`).join(",")}}`;
  const pad = "  ".repeat(indent + 1);
  const close = "  ".repeat(indent);
  const parts = node.props.map((p) => `${pad}${key(p)}: ${formatExpr(p.value, r, indent + 1)}`);
  return `{\n${parts.join(",\n")}\n${close}}`;
}
