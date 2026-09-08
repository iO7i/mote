// Mote runtime — schema-driven validation used by generated code.
// This ESM copy is imported directly by `mote run`. A strict-typed `mote.ts`
// twin (same behaviour) is emitted next to compiled output for `tsc`.

export class MoteValidationError extends Error {
  constructor(detail) {
    super(`${detail.path} expected ${detail.expected}, got ${detail.got}`);
    this.name = "MoteValidationError";
    this.moteValidation = true;
    this.detail = detail;
  }
}

function typeName(v) {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return Number.isNaN(v) ? "nan" : "num";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "array";
  return "object";
}

const ok = (value) => ({ ok: true, value });
const err = (path, expected, got) => ({ ok: false, error: { path, expected, got } });

// Validate `value` against a schema descriptor. `registry` resolves { k:"ref" }.
export function validate(value, schema, registry, path = "$") {
  return validateInner(value, schema, registry, path, new Set(), 0);
}

function validateInner(value, schema, registry, path, refs, depth) {
  if (!schema || typeof schema.k !== "string") return err(path, "valid schema", "invalid schema");
  if (depth > 128) return err(path, "acyclic schema (max depth 128)", "schema depth exceeded");
  switch (schema.k) {
    case "any":
    case "unknown":
      return ok(value);
    case "str":
      return typeof value === "string" ? ok(value) : err(path, "str", typeName(value));
    case "num":
      return typeof value === "number" && Number.isFinite(value)
        ? ok(value) : err(path, "num", typeName(value));
    case "bool":
      return typeof value === "boolean" ? ok(value) : err(path, "bool", typeName(value));
    case "nil":
      return value === null ? ok(value) : err(path, "nil", typeName(value));
    case "opt":
      return validateInner(value, schema.inner, registry, path, refs, depth + 1);
    case "ref": {
      const target = registry && typeof registry === "object" ? registry[schema.name] : null;
      if (!target) return err(path, schema.name, "unknown schema");
      if (refs.has(schema.name)) return err(path, schema.name, "cyclic schema");
      refs.add(schema.name);
      const result = validateInner(value, target, registry, path, refs, depth + 1);
      refs.delete(schema.name);
      return result;
    }
    case "array": {
      if (!schema.element) return err(path, "valid array schema", "invalid schema");
      if (!Array.isArray(value)) return err(path, "array", typeName(value));
      for (let i = 0; i < value.length; i++) {
        const r = validateInner(value[i], schema.element, registry, `${path}[${i}]`, refs, depth + 1);
        if (!r.ok) return r;
      }
      return ok(value);
    }
    case "union": {
      if (!Array.isArray(schema.options)) return err(path, "valid union schema", "invalid schema");
      for (const opt of schema.options) {
        const r = validateInner(value, opt, registry, path, refs, depth + 1);
        if (r.ok) return r;
      }
      return err(path, schema.options.map(describe).join("|"), typeName(value));
    }
    case "object": {
      if (!Array.isArray(schema.fields)) return err(path, "valid object schema", "invalid schema");
      if (typeName(value) !== "object") return err(path, "object", typeName(value));
      for (const f of schema.fields) {
        const has = Object.prototype.hasOwnProperty.call(value, f.name);
        if (!has) {
          if (f.optional) continue;
          return err(`${path}.${f.name}`, `${describe(f.schema)} (required)`, "nil");
        }
        const r = validateInner(value[f.name], f.schema, registry, `${path}.${f.name}`, refs, depth + 1);
        if (!r.ok) return r;
      }
      return ok(value);
    }
    default:
      return err(path, "known schema", `unknown schema kind '${schema.k}'`);
  }
}

function describe(schema) {
  switch (schema.k) {
    case "ref": return schema.name;
    case "array": return `[${describe(schema.element)}]`;
    case "opt": return `${describe(schema.inner)}?`;
    case "object": return "object";
    case "union": return schema.options.map(describe).join("|");
    default: return schema.k;
  }
}

// Parse + validate untrusted JSON. Returns a Result<T> — never throws on bad data.
export function json(raw, registry, name) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: { path: "$", expected: "valid JSON", got: String(e.message) } };
  }
  return validate(parsed, { k: "ref", name }, registry, "$");
}

// Validate an already-parsed in-memory value against a named type (CSV/DB rows).
export function check(value, registry, name) {
  return validate(value, { k: "ref", name }, registry, "$");
}

// Validate an environment variable's raw string against a named type.
export function env(name, registry, typeName_) {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  return validate(raw, { k: "ref", name: typeName_ }, registry, `$env.${name}`);
}

// Unwrap a Result<T>: return the value, or throw a MoteValidationError.
export function unwrap(result) {
  if (result.ok) return result.value;
  throw new MoteValidationError(result.error);
}
