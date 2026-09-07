// Mote type representation and operations.
// Types are small tagged objects. Named references are kept lazy (not expanded)
// so the emitter can print `Money` instead of an inlined object literal.

export const PRIMS = new Set(["str", "num", "bool", "nil", "unknown", "any", "never"]);

export const T = {
  prim: (name) => ({ t: name }),
  named: (name, args = []) => ({ t: "named", name, args }),
  opt: (inner) => (inner.t === "opt" ? inner : { t: "opt", inner }),
  union: (options) => ({ t: "union", options }),
  array: (element) => ({ t: "array", element }),
  object: (fields) => ({ t: "object", fields }), // fields: [{name, type, optional}]
  fn: (params, ret, typeParams = []) => ({ t: "fn", params, ret, typeParams }),
  result: (inner) => ({ t: "result", inner }),
  var: (name) => ({ t: "var", name }),
};

export const STR = T.prim("str");
export const NUM = T.prim("num");
export const BOOL = T.prim("bool");
export const NIL = T.prim("nil");
export const UNKNOWN = T.prim("unknown");
export const ANY = T.prim("any");
export const NEVER = T.prim("never");

// Resolve a syntax-level type expression (from the parser) into a Type.
// `typeVars` is a set of in-scope generic parameter names.
export function resolveTypeExpr(node, typeVars = new Set()) {
  switch (node.kind) {
    case "TName": {
      const n = node.name;
      if (PRIMS.has(n)) return T.prim(n);
      if (typeVars.has(n)) return T.var(n);
      if (n === "Result" && node.args) return T.result(resolveTypeExpr(node.args[0], typeVars));
      const args = (node.args ?? []).map((a) => resolveTypeExpr(a, typeVars));
      return T.named(n, args);
    }
    case "TOptional":
      return T.opt(resolveTypeExpr(node.inner, typeVars));
    case "TUnion":
      return T.union(node.options.map((o) => resolveTypeExpr(o, typeVars)));
    case "TArray":
      return T.array(resolveTypeExpr(node.element, typeVars));
    case "TObject":
      return T.object(node.fields.map((f) => ({
        name: f.name,
        optional: f.optional,
        type: f.optional ? resolveTypeExpr(f.type.inner, typeVars) : resolveTypeExpr(f.type, typeVars),
      })));
    default:
      throw new Error(`cannot resolve type node '${node.kind}'`);
  }
}

// A type environment maps declared type names -> Type (their definition body).
export function resolveNamed(type, env) {
  let seen = 0;
  while (type && type.t === "named") {
    const def = env.get(type.name);
    if (!def) return type; // unknown named — caller reports M110
    type = def;
    if (++seen > 1000) break;
  }
  return type;
}

// Human-readable type string for diagnostics.
export function show(type) {
  if (!type) return "unknown";
  switch (type.t) {
    case "opt": return `${show(type.inner)}?`;
    case "union": return type.options.map(show).join("|");
    case "array": return `[${show(type.element)}]`;
    case "named": return type.args?.length ? `${type.name}<${type.args.map(show).join(",")}>` : type.name;
    case "object": {
      const fs = type.fields.map((f) => `${f.name}:${show(f.type)}${f.optional ? "?" : ""}`);
      return `{${fs.join(",")}}`;
    }
    case "result": return `Result<${show(type.inner)}>`;
    case "fn": return `fn(${type.params.map((p) => show(p.type ?? UNKNOWN)).join(",")})->${show(type.ret)}`;
    case "var": return type.name;
    default: return type.t;
  }
}

// Structural assignability: is `sub` assignable to `sup`?
export function assignable(sub, sup, env) {
  sub = resolveNamed(sub, env);
  sup = resolveNamed(sup, env);
  if (!sub || !sup) return true;

  if (sup.t === "any" || sub.t === "any") return true;
  if (sup.t === "unknown") return true;         // everything -> unknown
  if (sub.t === "never") return true;
  if (sub.t === "unknown") return sup.t === "unknown";

  // optional target accepts nil and the inner type
  if (sup.t === "opt") {
    if (sub.t === "nil") return true;
    if (sub.t === "opt") return assignable(sub.inner, sup.inner, env);
    return assignable(sub, sup.inner, env);
  }
  if (sub.t === "opt") {
    // T? -> U only if U also optional/unknown (handled above) — otherwise unsafe
    return false;
  }

  if (sub.t === "union") return sub.options.every((o) => assignable(o, sup, env));
  if (sup.t === "union") return sup.options.some((o) => assignable(sub, o, env));

  if (sub.t === "var" || sup.t === "var") return true; // pragmatic for MVP generics

  if (sub.t !== sup.t) return false;

  switch (sub.t) {
    case "str": case "num": case "bool": case "nil": return true;
    case "array": return assignable(sub.element, sup.element, env);
    case "result": return assignable(sub.inner, sup.inner, env);
    case "object": {
      for (const sf of sup.fields) {
        const subf = sub.fields.find((f) => f.name === sf.name);
        if (!subf) { if (sf.optional) continue; return false; }
        if (!assignable(subf.type, sf.type, env)) return false;
      }
      return true;
    }
    case "fn": {
      if (sub.params.length !== sup.params.length) return false;
      if (!assignable(sub.ret, sup.ret, env)) return false;
      return true;
    }
    default: return false;
  }
}

// Simple join of two branch types (ternary / ??) — union unless identical.
export function join(a, b, env) {
  if (assignable(a, b, env) && assignable(b, a, env)) return a;
  const flat = [];
  for (const x of [a, b]) {
    if (x.t === "union") flat.push(...x.options);
    else flat.push(x);
  }
  const uniq = [];
  for (const x of flat) if (!uniq.some((y) => sameShallow(x, y))) uniq.push(x);
  return uniq.length === 1 ? uniq[0] : T.union(uniq);
}

function sameShallow(a, b) {
  if (a.t !== b.t) return false;
  if (a.t === "named") return a.name === b.name;
  return show(a) === show(b);
}
