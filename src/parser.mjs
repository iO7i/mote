// Mote v0.2 parser — token stream -> untyped syntax AST.
// Recursive descent; precedence climbing for binary operators.
// Whitespace/newlines are insignificant (see lexer); boundaries are structural.

import { lex } from "./lexer.mjs";

const BINOP = {
  "??": 2,
  "||": 3,
  "&&": 4,
  "==": 5, "!=": 5,
  "<": 6, ">": 6, "<=": 6, ">=": 6,
  "+": 7, "-": 7,
  "*": 8, "/": 8, "%": 8,
};

function parseError(msg, tok, file) {
  const e = new Error(`${file}:${tok.line}:${tok.col}: parse error: ${msg}`);
  e.mote = { phase: "parse", line: tok.line, col: tok.col, file, code: "M001" };
  return e;
}

export function parse(src, file = "<input>") {
  const tokens = lex(src, file);
  let pos = 0;

  const peek = (k = 0) => tokens[pos + k];
  const next = () => tokens[pos++];
  const at = (type, value) => {
    const t = peek();
    return t.type === type && (value === undefined || t.value === value);
  };
  const atOp = (v) => at("op", v);
  const eat = (type, value) => (at(type, value) ? next() : null);
  const expect = (type, value) => {
    const t = peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw parseError(`expected ${value ?? type}, got ${t.value ?? t.type}`, t, file);
    }
    return next();
  };

  // A member name / object key / type name may be spelled like a keyword.
  const NAME_TOKENS = new Set([
    "ident", "use", "as", "pub", "fn", "let", "mut",
    "type", "match", "case", "true", "false", "nil",
  ]);
  // Close a generic '>'. The lexer may have merged it into '>=', '>>', '>>=';
  // split the token in place and keep the remainder for the next read.
  const expectGt = () => {
    const t = peek();
    if (t.type === "op" && t.value === ">") { next(); return; }
    if (t.type === "op" && (t.value === ">=" || t.value === ">>" || t.value === ">>=")) {
      t.value = t.value.slice(1);
      t.col += 1;
      return;
    }
    throw parseError(`expected >, got ${t.value ?? t.type}`, t, file);
  };

  const expectName = () => {
    const t = peek();
    if (!NAME_TOKENS.has(t.type)) {
      throw parseError(`expected name, got ${t.value ?? t.type}`, t, file);
    }
    return next().value;
  };

  const program = { kind: "Program", body: [] };
  while (!at("eof")) program.body.push(parseTopLevel());
  return program;

  // ---------------------------------------------------------------- statements

  function parseTopLevel() {
    if (at("use")) return parseUse();
    if (at("type")) return parseTypeDecl();
    let pub = false, isAsync = false;
    if (at("pub")) { next(); pub = true; }
    if (at("async")) { next(); isAsync = true; }
    if (at("fn")) return parseFn(pub, isAsync);
    if (pub || isAsync) throw parseError("'pub'/'async' can only precede 'fn'", peek(), file);
    if (at("let")) return parseLet();
    return { kind: "ExprStmt", expr: parseExpr() };
  }

  function parseUse() {
    const kw = expect("use");
    const mod = expect("str");
    expect("as");
    const alias = expect("ident");
    return { kind: "Use", module: mod.value, alias: alias.value, line: kw.line, col: kw.col };
  }

  function parseTypeDecl() {
    const kw = expect("type");
    const name = expect("ident");
    const typeParams = parseTypeParams();
    expect("op", "=");
    const type = parseType();
    return {
      kind: "TypeDecl", name: name.value, typeParams, type,
      line: kw.line, col: kw.col,
    };
  }

  function parseTypeParams() {
    const params = [];
    if (atOp("<")) {
      next();
      do { params.push(expect("ident").value); } while (eat("op", ","));
      expectGt();
    }
    return params;
  }

  function parseFn(pub, isAsync = false) {
    const kw = expect("fn");
    const name = expect("ident");
    const typeParams = parseTypeParams();
    expect("op", "(");
    const params = [];
    if (!atOp(")")) {
      do {
        const pname = expect("ident");
        let ptype = null;
        if (eat("op", ":")) ptype = parseType();
        params.push({ name: pname.value, type: ptype, line: pname.line, col: pname.col });
      } while (eat("op", ","));
    }
    expect("op", ")");
    let retType = null;
    if (eat("op", "->")) retType = parseType();
    expect("op", "=");
    const body = parseExpr();
    return {
      kind: "Fn", pub, isAsync, name: name.value, typeParams, params, retType, body,
      line: kw.line, col: kw.col,
    };
  }

  function parseLet() {
    const kw = expect("let");
    const name = expect("ident");
    let type = null;
    if (eat("op", ":")) type = parseType();
    expect("op", "=");
    const init = parseExpr();
    return { kind: "Let", name: name.value, type, init, line: kw.line, col: kw.col };
  }

  // ---------------------------------------------------------------- types

  function parseType() { return parseUnionType(); }

  function parseUnionType() {
    let t = parseOptionalType();
    if (atOp("|")) {
      const options = [t];
      while (eat("op", "|")) options.push(parseOptionalType());
      return { kind: "TUnion", options };
    }
    return t;
  }

  function parseOptionalType() {
    let t = parsePrimaryType();
    while (atOp("?")) { next(); t = { kind: "TOptional", inner: t }; }
    return t;
  }

  function parsePrimaryType() {
    if (atOp("[")) {
      next();
      const element = parseType();
      expect("op", "]");
      return { kind: "TArray", element };
    }
    if (atOp("{")) return parseObjectType();
    const t = peek();
    if (t.type === "ident" || t.type === "nil") {
      next();
      const named = { kind: "TName", name: t.value, line: t.line, col: t.col };
      // generic type reference, e.g. Result<Event>
      if (atOp("<")) {
        next();
        const args = [];
        do { args.push(parseType()); } while (eat("op", ","));
        expectGt();
        named.args = args;
      }
      return named;
    }
    throw parseError(`expected type, got ${t.value ?? t.type}`, t, file);
  }

  function parseObjectType() {
    const open = expect("op", "{");
    const fields = [];
    if (!atOp("}")) {
      do {
        if (atOp("}")) break;
        const nameTok = peek();
        const name = expectName();
        expect("op", ":");
        const type = parseType();
        fields.push({
          name, type, optional: type.kind === "TOptional",
          line: nameTok.line, col: nameTok.col,
        });
      } while (eat("op", ","));
    }
    expect("op", "}");
    return { kind: "TObject", fields, line: open.line, col: open.col };
  }

  // ---------------------------------------------------------------- expressions

  function parseExpr() { return parseTernaryOrTry(); }

  function parseTernaryOrTry() {
    const cond = parseBinary(0);
    if (!atOp("?")) return cond;

    // '?' is either a ternary (cond ? yes : no) or the postfix Result-unwrap
    // operator (expr?). Disambiguate by attempting the ternary and backtracking.
    const save = pos;
    next(); // consume '?'
    try {
      const yes = parseExpr();
      if (atOp(":")) {
        next();
        const no = parseExpr(); // right associative
        return { kind: "Ternary", cond, yes, no };
      }
    } catch { /* fall through to unwrap */ }
    pos = save;
    const q = expect("op", "?");
    return { kind: "Try", expr: cond, line: q.line, col: q.col };
  }

  function parseBinary(minPrec) {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (t.type !== "op") break;
      const prec = BINOP[t.value];
      if (prec === undefined || prec < minPrec) break;
      next();
      const right = parseBinary(prec + 1); // left associative
      left = { kind: "Binary", op: t.value, left, right, line: t.line, col: t.col };
    }
    return left;
  }

  function parseUnary() {
    const t = peek();
    if (t.type === "await") {
      next();
      return { kind: "Await", operand: parseUnary(), line: t.line, col: t.col };
    }
    if (t.type === "op" && (t.value === "-" || t.value === "!")) {
      next();
      return { kind: "Unary", op: t.value, operand: parseUnary(), line: t.line, col: t.col };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let e = parsePrimary();
    for (;;) {
      if (atOp(".")) {
        const dot = next();
        e = { kind: "Member", obj: e, prop: expectName(), line: dot.line, col: dot.col };
      } else if (atOp("(")) {
        e = finishCall(e, null);
      } else if (atOp("<") && looksLikeGenericCall()) {
        next();
        const typeArgs = [];
        do { typeArgs.push(parseType()); } while (eat("op", ","));
        expectGt();
        e = finishCall(e, typeArgs);
      } else if (atOp("[")) {
        const open = next();
        const index = parseExpr();
        expect("op", "]");
        e = { kind: "Index", obj: e, index, line: open.line, col: open.col };
      } else break;
    }
    return e;
  }

  function finishCall(callee, typeArgs) {
    const open = expect("op", "(");
    const args = [];
    if (!atOp(")")) {
      do { args.push(parseExpr()); } while (eat("op", ","));
    }
    expect("op", ")");
    return { kind: "Call", callee, args, typeArgs, line: open.line, col: open.col };
  }

  // Decide whether a '<' begins generic type arguments (followed by '(') rather
  // than a comparison operator. Pure lookahead with restore; never consumes.
  function looksLikeGenericCall() {
    const save = pos;
    if (!atOp("<")) return false;
    next();
    try {
      do { parseType(); } while (eat("op", ","));
      const ok = atOp(">") && peek(1).type === "op" && peek(1).value === "(";
      pos = save;
      return ok;
    } catch {
      pos = save;
      return false;
    }
  }

  function parsePrimary() {
    const t = peek();
    switch (t.type) {
      case "num": next(); return { kind: "Num", raw: t.value, line: t.line, col: t.col };
      case "str": next(); return { kind: "Str", raw: t.value, line: t.line, col: t.col };
      case "ident": next(); return { kind: "Ident", name: t.value, line: t.line, col: t.col };
      case "true": next(); return { kind: "Bool", value: true, line: t.line, col: t.col };
      case "false": next(); return { kind: "Bool", value: false, line: t.line, col: t.col };
      case "nil": next(); return { kind: "Nil", line: t.line, col: t.col };
    }
    if (atOp("(")) { next(); const e = parseExpr(); expect("op", ")"); return e; }
    if (atOp("{")) return parseObject();
    if (atOp("[")) return parseArray();
    throw parseError(`unexpected ${t.value ?? t.type} in expression`, t, file);
  }

  function parseObject() {
    const open = expect("op", "{");
    const props = [];
    if (!atOp("}")) {
      do {
        if (atOp("}")) break; // trailing comma
        const kt = peek();
        let key, keyIsString = false;
        if (kt.type === "str") { key = next().value; keyIsString = true; }
        else key = expectName();
        expect("op", ":");
        props.push({ key, keyIsString, value: parseExpr(), line: kt.line, col: kt.col });
      } while (eat("op", ","));
    }
    expect("op", "}");
    return { kind: "Object", props, line: open.line, col: open.col };
  }

  function parseArray() {
    const open = expect("op", "[");
    const elements = [];
    if (!atOp("]")) {
      do {
        if (atOp("]")) break; // trailing comma
        elements.push(parseExpr());
      } while (eat("op", ","));
    }
    expect("op", "]");
    return { kind: "Array", elements, line: open.line, col: open.col };
  }
}
