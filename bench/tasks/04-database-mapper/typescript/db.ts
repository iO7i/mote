// Strict TypeScript + equivalent runtime validation, nullable column mapping,
// and pagination.

export type Row = { id: number; name: string; deleted_at: string | null };
export type User = { id: number; name: string; active: boolean };
export type Page = { page: number; pages: number; offset: number };

class ValidationError extends Error {}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function kind(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return Number.isNaN(v) ? "nan" : "num";
  if (typeof v === "boolean") return "bool";
  return "object";
}
function num(v: unknown, path: string): number {
  if (typeof v !== "number" || Number.isNaN(v)) throw new ValidationError(`${path} expected num, got ${kind(v)}`);
  return v;
}
function str(v: unknown, path: string): string {
  if (typeof v !== "string") throw new ValidationError(`${path} expected str, got ${kind(v)}`);
  return v;
}
function parseRow(raw: string): Row {
  const root: unknown = JSON.parse(raw);
  if (!isObject(root)) throw new ValidationError("$ expected object, got " + kind(root));
  const d = root["deleted_at"];
  return {
    id: num(root["id"], "$.id"),
    name: str(root["name"], "$.name"),
    deleted_at: d === null || d === undefined ? null : str(d, "$.deleted_at"),
  };
}

export function mapUser(r: Row): User {
  return { id: r.id, name: r.name, active: r.deleted_at === null };
}

export function page(total: number, size: number, n: number): Page {
  return { page: n, pages: Math.ceil(total / size), offset: n * size };
}

export function load(raw: string): User {
  return mapUser(parseRow(raw));
}
