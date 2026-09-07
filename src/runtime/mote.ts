// Mote runtime (strict TypeScript twin of mote.mjs).
// Emitted next to compiled output so generated code and validators pass tsc --strict.

export type Schema =
  | { k: "any" | "unknown" | "str" | "num" | "bool" | "nil" }
  | { k: "opt"; inner: Schema }
  | { k: "ref"; name: string }
  | { k: "array"; element: Schema }
  | { k: "union"; options: Schema[] }
  | { k: "object"; fields: { name: string; optional: boolean; schema: Schema }[] };

export type Registry = Record<string, Schema>;

// The generated runtime intentionally has no @types/node dependency. Node
// supplies this global at execution time; other hosts simply report env values
// as absent through the guarded access below.
declare const process: { env: Record<string, string | undefined> } | undefined;

export interface ValidationDetail {
  path: string;
  expected: string;
  got: string;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ValidationDetail };

export class MoteValidationError extends Error {
  readonly moteValidation = true;
  readonly detail: ValidationDetail;
  constructor(detail: ValidationDetail) {
    super(`${detail.path} expected ${detail.expected}, got ${detail.got}`);
    this.name = "MoteValidationError";
    this.detail = detail;
  }
}

function typeName(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return Number.isNaN(v) ? "nan" : "num";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "array";
  return "object";
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = (path: string, expected: string, got: string): Result<never> =>
  ({ ok: false, error: { path, expected, got } });

export function validate(value: unknown, schema: Schema, registry: Registry, path = "$"): Result<unknown> {
  return validateInner(value, schema, registry, path, new Set(), 0);
}

function validateInner(
  value: unknown, schema: Schema, registry: Registry, path: string, refs: Set<string>, depth: number,
): Result<unknown> {
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
      const target = registry[schema.name];
      if (!target) return err(path, schema.name, "unknown schema");
      if (refs.has(schema.name)) return err(path, schema.name, "cyclic schema");
      refs.add(schema.name);
      const result = validateInner(value, target, registry, path, refs, depth + 1);
      refs.delete(schema.name);
      return result;
    }
    case "array": {
      if (!Array.isArray(value)) return err(path, "array", typeName(value));
      for (let i = 0; i < value.length; i++) {
        const r = validateInner(value[i], schema.element, registry, `${path}[${i}]`, refs, depth + 1);
        if (!r.ok) return r;
      }
      return ok(value);
    }
    case "union": {
      for (const opt of schema.options) {
        const r = validateInner(value, opt, registry, path, refs, depth + 1);
        if (r.ok) return r;
      }
      return err(path, schema.options.map(describe).join("|"), typeName(value));
    }
    case "object": {
      if (typeName(value) !== "object") return err(path, "object", typeName(value));
      const obj = value as Record<string, unknown>;
      for (const f of schema.fields) {
        const has = Object.prototype.hasOwnProperty.call(obj, f.name);
        if (!has) {
          if (f.optional) continue;
          return err(`${path}.${f.name}`, `${describe(f.schema)} (required)`, "nil");
        }
        const r = validateInner(obj[f.name], f.schema, registry, `${path}.${f.name}`, refs, depth + 1);
        if (!r.ok) return r;
      }
      return ok(value);
    }
  }
}

function describe(schema: Schema): string {
  switch (schema.k) {
    case "ref": return schema.name;
    case "array": return `[${describe(schema.element)}]`;
    case "opt": return `${describe(schema.inner)}?`;
    case "object": return "object";
    case "union": return schema.options.map(describe).join("|");
    default: return schema.k;
  }
}

export function json<T>(raw: string, registry: Registry, name: string): Result<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: { path: "$", expected: "valid JSON", got: String((e as Error).message) } };
  }
  return validate(parsed, { k: "ref", name }, registry, "$") as Result<T>;
}

export function check<T>(value: unknown, registry: Registry, name: string): Result<T> {
  return validate(value, { k: "ref", name }, registry, "$") as Result<T>;
}

export function env<T>(name: string, registry: Registry, typeName_: string): Result<T> {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  return validate(raw, { k: "ref", name: typeName_ }, registry, `$env.${name}`) as Result<T>;
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new MoteValidationError(result.error);
}
