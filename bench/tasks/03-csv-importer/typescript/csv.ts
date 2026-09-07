// Strict TypeScript + equivalent per-row runtime validation.

export type Row = { id: number; email: string; active: boolean };

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { path: string; expected: string; got: string } };

function kind(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return Number.isNaN(v) ? "nan" : "num";
  if (typeof v === "boolean") return "bool";
  return "object";
}

function build(c: string[]): Row {
  return { id: Number(c[0]), email: c[1], active: c[2] === "true" };
}

export function parseRow(c: string[]): Result<Row> {
  const r = build(c);
  if (typeof r.id !== "number" || Number.isNaN(r.id)) {
    return { ok: false, error: { path: "$.id", expected: "num", got: kind(r.id) } };
  }
  if (typeof r.email !== "string") {
    return { ok: false, error: { path: "$.email", expected: "str", got: kind(r.email) } };
  }
  if (typeof r.active !== "boolean") {
    return { ok: false, error: { path: "$.active", expected: "bool", got: kind(r.active) } };
  }
  return { ok: true, value: r };
}
