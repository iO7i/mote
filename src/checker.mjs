// Mote v0.2 type checker.
// Pragmatic structural checker with light generic unification. It resolves the
// type environment, checks bodies/calls/members, and annotates the AST with
// resolved Types for the emitter. Diagnostics carry stable M-codes + locations.

import { Diagnostics } from "./diagnostics.mjs";
import {
  T, STR, NUM, BOOL, NIL, UNKNOWN, ANY, PRIMS,
  resolveTypeExpr, resolveNamed, assignable, show, join,
} from "./types.mjs";

// Ambient globals available without import; members are external/unchecked.
const AMBIENT = ["console", "JSON", "process", "Buffer", "Math", "Date", "Object", "Array", "Number"];

export function check(program, opts = {}) {
  const file = opts.file ?? "<input>";
  const strict = opts.strict !== false; // strict by default
  const diags = new Diagnostics(file);
  const typeEnv = new Map();   // type name -> Type (definition body)
  const typeDecls = [];        // ordered [{name, type, node}]
  const typeParamsByName = new Map();
  const globals = new Map();   // value name -> Type
  const state = { needsRuntime: false };

  // 1) collect type declarations (two-pass for forward references)
  for (const s of program.body) {
    if (s.kind !== "TypeDecl") continue;
    const tvars = new Set(s.typeParams);
    const type = resolveTypeExpr(s.type, tvars);
    s.typeR = type; // always annotate so the emitter can render, even on error
    if (typeEnv.has(s.name)) { diags.error("M102", `duplicate type '${s.name}'`, s); continue; }
    if (s.typeParams.length) {
      // Generic aliases were parsed but not instantiated by the old resolver,
      // which could silently turn T into an unchecked runtime value. Keep the
      // grammar stable and reject the unsound construct until it is implemented.
      diags.error("M310", `generic type alias '${s.name}' is not supported by this compiler`, s);
    }
    typeEnv.set(s.name, type);
    typeParamsByName.set(s.name, s.typeParams);
    typeDecls.push({ name: s.name, type, node: s });
  }
  // verify all named references resolve
  for (const { type, node } of typeDecls) checkNamedRefs(type, node);
  detectAliasCycles();

  // 2) seed globals: ambient + imports + function signatures.
  // User declarations may SHADOW ambients; duplicates are only among user names.
  const declared = new Set();
  for (const name of AMBIENT) globals.set(name, ANY);
  for (const s of program.body) {
    if (s.kind === "Use") {
      if (declared.has(s.alias)) diags.error("M102", `duplicate binding '${s.alias}'`, s);
      declared.add(s.alias);
      globals.set(s.alias, ANY); // untyped npm import: members treated as external
    }
  }
  for (const s of program.body) {
    if (s.kind !== "Fn") continue;
    if (declared.has(s.name)) diags.error("M102", `duplicate function '${s.name}'`, s);
    declared.add(s.name);
    globals.set(s.name, signatureOf(s));
  }

  // 3) check function bodies
  for (const s of program.body) {
    if (s.kind === "Fn") checkFn(s);
  }

  // 4) check top-level statements in order
  const topScope = new Scope(globals);
  for (const s of program.body) {
    if (s.kind === "Let") {
      const initType = infer(s.init, topScope);
      const declared = s.type ? resolveTypeExpr(s.type, new Set()) : null;
      if (declared) checkNamedRefs(declared, s);
      if (declared && !assignable(initType, declared, typeEnv)) {
        diags.error("M401", `'${s.name}' declared ${show(declared)} but initializer is ${show(initType)}`, s);
      }
      s.typeR = declared ?? initType;
      if (topScope.hasOwn(s.name)) diags.error("M102", `duplicate binding '${s.name}'`, s);
      topScope.set(s.name, s.typeR);
    } else if (s.kind === "ExprStmt") {
      infer(s.expr, topScope);
    }
  }

  return { diagnostics: diags, typeEnv, typeDecls, needsRuntime: state.needsRuntime, strict };

  // ---------------------------------------------------------------- helpers

  function signatureOf(fn) {
    const tvars = new Set(fn.typeParams);
    const params = fn.params.map((p) => ({
      name: p.name,
      type: p.type ? resolveTypeExpr(p.type, tvars) : ANY,
    }));
    const ret = fn.retType ? resolveTypeExpr(fn.retType, tvars) : null; // null => infer
    return T.fn(params, ret ?? UNKNOWN, fn.typeParams);
  }

  function checkFn(fn) {
    const sig = globals.get(fn.name);
    const tvars = new Set(fn.typeParams);

    if (strict && fn.pub) {
      const missing = fn.params.some((p) => !p.type) || !fn.retType;
      if (missing) {
        diags.error("M420",
          `public function '${fn.name}' must annotate all parameters and return type`, fn);
      }
    }

    sig.params.forEach((p, i) => checkNamedRefs(p.type, fn.params[i]));
    if (fn.retType) checkNamedRefs(resolveTypeExpr(fn.retType, tvars), fn);

    const scope = new Scope(globals);
    fn.paramTypesR = sig.params.map((p) => p.type);
    fn.params.forEach((p, i) => scope.set(p.name, sig.params[i].type));

    const bodyType = infer(fn.body, scope);
    const declaredRet = fn.retType ? resolveTypeExpr(fn.retType, tvars) : null;
    if (declaredRet && !assignable(bodyType, declaredRet, typeEnv)) {
      diags.error("M401",
        `'${fn.name}' returns ${show(bodyType)} but is declared ${show(declaredRet)}`, fn.body);
    }
    fn.retTypeR = declaredRet ?? bodyType;
  }

  function checkNamedRefs(type, node, seen = new Set()) {
    if (!type || typeof type !== "object") return;
    switch (type.t) {
      case "named":
        if (type.name === "Result") { type.args?.forEach((a) => checkNamedRefs(a, node, seen)); return; }
        if (!typeEnv.has(type.name) && !PRIMS.has(type.name)) {
          diags.error("M110", `unknown type '${type.name}'`, node);
        }
        const params = typeParamsByName.get(type.name);
        if (params && type.args.length !== params.length) {
          diags.error("M310", `type '${type.name}' expects ${params.length} type argument(s), got ${type.args.length}`, node);
        }
        type.args?.forEach((a) => checkNamedRefs(a, node, seen));
        return;
      case "opt": checkNamedRefs(type.inner, node, seen); return;
      case "array": checkNamedRefs(type.element, node, seen); return;
      case "union": type.options.forEach((o) => checkNamedRefs(o, node, seen)); return;
      case "object": type.fields.forEach((f) => checkNamedRefs(f.type, node, seen)); return;
      case "result": checkNamedRefs(type.inner, node, seen); return;
    }
  }

  function detectAliasCycles() {
    const reported = new Set();
    const complete = new Set();
    for (const name of typeEnv.keys()) visit(name, []);

    function visit(name, trail) {
      if (complete.has(name)) return;
      const at = trail.indexOf(name);
      if (at >= 0) {
        for (const cycleName of trail.slice(at)) {
          if (reported.has(cycleName)) continue;
          reported.add(cycleName);
          const decl = typeDecls.find((d) => d.name === cycleName);
          diags.error("M111", `cyclic type alias involving '${cycleName}'`, decl?.node);
        }
        return;
      }
      const type = typeEnv.get(name);
      if (!type) return;
      for (const dep of namedDependencies(type)) visit(dep, [...trail, name]);
      complete.add(name);
    }
  }

  function namedDependencies(type, found = new Set()) {
    if (!type || typeof type !== "object") return found;
    switch (type.t) {
      case "named":
        if (typeEnv.has(type.name)) found.add(type.name);
        type.args?.forEach((arg) => namedDependencies(arg, found));
        break;
      case "opt": namedDependencies(type.inner, found); break;
      case "array": namedDependencies(type.element, found); break;
      case "union": type.options.forEach((option) => namedDependencies(option, found)); break;
      case "object": type.fields.forEach((field) => namedDependencies(field.type, found)); break;
      case "result": namedDependencies(type.inner, found); break;
    }
    return found;
  }

  // ---------------------------------------------------------------- inference

  function infer(node, scope) {
    switch (node.kind) {
      case "Num": return NUM;
      case "Str": return STR;
      case "Bool": return BOOL;
      case "Nil": return NIL;

      case "Ident": {
        const t = scope.get(node.name);
        if (!t) { diags.error("M101", `unknown identifier '${node.name}'`, node); return ANY; }
        return t;
      }

      case "Member": return inferMember(node, scope);

      case "Index": {
        const ot = resolveNamed(infer(node.obj, scope), typeEnv);
        infer(node.index, scope);
        if (ot.t === "array") return ot.t === "opt" ? UNKNOWN : ot.element;
        if (ot.t === "any") return ANY;
        return ANY;
      }

      case "Call": return inferCall(node, scope);

      case "Await":
        // Promise types are not modelled in the MVP; await is pass-through.
        return infer(node.operand, scope);

      case "Unary": {
        const ot = infer(node.operand, scope);
        if (node.op === "!") return BOOL;
        if (!isNumish(ot)) diags.error("M410", `unary '-' expects num, got ${show(ot)}`, node);
        return NUM;
      }

      case "Binary": return inferBinary(node, scope);

      case "Ternary": {
        infer(node.cond, scope);
        const y = infer(node.yes, scope);
        const n = infer(node.no, scope);
        return join(y, n, typeEnv);
      }

      case "Object":
        return T.object(node.props.map((p) => ({
          name: p.key, optional: false, type: infer(p.value, scope),
        })));

      case "Array": {
        if (!node.elements.length) return T.array(UNKNOWN);
        let el = infer(node.elements[0], scope);
        for (let i = 1; i < node.elements.length; i++) el = join(el, infer(node.elements[i], scope), typeEnv);
        return T.array(el);
      }

      case "Try": {
        state.needsRuntime = true;
        const et = resolveNamed(infer(node.expr, scope), typeEnv);
        if (et.t === "result") return et.inner;
        if (et.t === "any") return ANY;
        diags.error("M501", `'?' unwrap expects a Result, got ${show(et)}`, node);
        return ANY;
      }

      default:
        return ANY;
    }
  }

  function inferMember(node, scope) {
    const ot = infer(node.obj, scope);
    const rot = resolveNamed(ot, typeEnv);
    if (rot.t === "any" || rot.t === "unknown") return ANY;
    if (rot.t === "opt") {
      diags.error("M201",
        `cannot access '.${node.prop}' on ${show(ot)} (optional)`, node);
      return ANY;
    }
    if (rot.t === "object") {
      const f = rot.fields.find((x) => x.name === node.prop);
      if (!f) { diags.error("M202", `no property '${node.prop}' on ${show(ot)}`, node); return ANY; }
      return f.optional ? T.opt(f.type) : f.type;
    }
    diags.error("M202", `cannot access '.${node.prop}' on ${show(ot)}`, node);
    return ANY;
  }

  function inferCall(node, scope) {
    // trusted escape hatch: cast<T>(value) asserts a type WITHOUT runtime
    // validation (no schema, no runtime). Unsafe by design; use only for values
    // already trusted (internal, not from an untrusted boundary).
    if (node.callee.kind === "Ident" && node.callee.name === "cast") {
      const ta = node.typeArgs ?? [];
      if (ta.length !== 1) { diags.error("M310", "cast<T>() requires exactly one type argument", node); }
      node.builtin = "cast";
      node.castTypeR = ta[0] ? resolveTypeExpr(ta[0], new Set()) : ANY;
      checkNamedRefs(node.castTypeR, node);
      node.args.forEach((a) => infer(a, scope));
      return node.castTypeR;
    }

    // builtin runtime validators: json<T>(raw), env<T>(name), check<T>(value)
    if (node.callee.kind === "Ident" &&
        (node.callee.name === "json" || node.callee.name === "env" || node.callee.name === "check")) {
      const b = node.callee.name;
      state.needsRuntime = true;
      const ta = node.typeArgs ?? [];
      if (ta.length !== 1 || ta[0].kind !== "TName" || ta[0].args?.length || PRIMS.has(ta[0].name)) {
        diags.error("M310", `${b}<T>() requires exactly one named type argument`, node);
        node.builtin = b; node.typeName = ta[0]?.name ?? "unknown";
        return T.result(ANY);
      }
      node.builtin = b;
      node.typeName = ta[0].name;
      if (!typeEnv.has(ta[0].name)) diags.error("M110", `unknown type '${ta[0].name}'`, node);
      else if (!isReifiable(typeEnv.get(ta[0].name), new Set([ta[0].name]))) {
        diags.error("M311", `${b}<${ta[0].name}>() requires a concrete runtime-reifiable type`, node);
      }
      node.args.forEach((a) => infer(a, scope));
      return T.result(T.named(ta[0].name));
    }

    const ct = resolveNamed(infer(node.callee, scope), typeEnv);
    const argTypes = node.args.map((a) => infer(a, scope));

    if (ct.t === "any") return ANY;
    if (ct.t !== "fn") return ANY; // not callable — kept quiet in MVP

    if (argTypes.length !== ct.params.length) {
      diags.error("M301",
        `expected ${ct.params.length} argument(s), got ${argTypes.length}`, node);
    }

    // light generic unification
    const subst = {};
    ct.params.forEach((p, i) => { if (argTypes[i]) unify(p.type, argTypes[i], subst); });

    ct.params.forEach((p, i) => {
      if (!argTypes[i]) return;
      const want = substitute(p.type, subst);
      if (!assignable(argTypes[i], want, typeEnv)) {
        diags.error("M302",
          `argument ${i + 1}: ${show(argTypes[i])} is not assignable to ${show(want)}`, node.args[i]);
      }
    });

    return substitute(ct.ret, subst);
  }

  function inferBinary(node, scope) {
    const l = infer(node.left, scope);
    const r = infer(node.right, scope);
    const op = node.op;
    if ("+-*/%".includes(op) && op.length === 1) {
      if (!isNumish(l)) diags.error("M410", `left of '${op}' is ${show(l)}, expected num`, node.left);
      if (!isNumish(r)) diags.error("M410", `right of '${op}' is ${show(r)}, expected num`, node.right);
      return NUM;
    }
    if (["==", "!=", "<", ">", "<=", ">="].includes(op)) return BOOL;
    if (op === "&&" || op === "||") return BOOL;
    if (op === "??") {
      const left = stripOpt(l);
      return join(left, r, typeEnv);
    }
    return ANY;
  }

  // ---- tiny unification for MVP generics ----
  function unify(param, arg, subst) {
    if (!param || !arg) return;
    if (param.t === "var") { subst[param.name] = subst[param.name] ?? arg; return; }
    if (param.t === "array" && arg.t === "array") unify(param.element, arg.element, subst);
    if (param.t === "opt" && arg.t === "opt") unify(param.inner, arg.inner, subst);
  }
  function substitute(type, subst) {
    if (!type || typeof type !== "object") return type;
    switch (type.t) {
      case "var": return subst[type.name] ?? type;
      case "opt": return T.opt(substitute(type.inner, subst));
      case "array": return T.array(substitute(type.element, subst));
      case "union": return T.union(type.options.map((o) => substitute(o, subst)));
      case "result": return T.result(substitute(type.inner, subst));
      default: return type;
    }
  }

  function isNumish(t) {
    const r = resolveNamed(t, typeEnv);
    return r.t === "num" || r.t === "any" || r.t === "unknown";
  }
  function stripOpt(t) { return t.t === "opt" ? t.inner : t; }

  function isReifiable(type, seen) {
    if (!type || typeof type !== "object") return false;
    switch (type.t) {
      case "str": case "num": case "bool": case "nil": return true;
      case "any": case "unknown": case "never": case "var": case "fn": case "result": return false;
      case "opt": return isReifiable(type.inner, seen);
      case "array": return isReifiable(type.element, seen);
      case "union": return type.options.every((option) => isReifiable(option, seen));
      case "object": return type.fields.every((field) => isReifiable(field.type, seen));
      case "named": {
        if (type.args?.length || !typeEnv.has(type.name) || seen.has(type.name)) return false;
        seen.add(type.name);
        const value = isReifiable(typeEnv.get(type.name), seen);
        seen.delete(type.name);
        return value;
      }
      default: return false;
    }
  }
}

class Scope {
  constructor(seed) { this.vars = new Map(); this.seed = seed; } // seed: Map
  get(name) { return this.vars.has(name) ? this.vars.get(name) : this.seed.get(name); }
  hasOwn(name) { return this.vars.has(name); }
  set(name, type) { this.vars.set(name, type); }
}
