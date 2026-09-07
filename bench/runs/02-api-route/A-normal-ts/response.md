This API route handler authenticates the caller before touching the request
body. `handle` first checks the bearer token against the shared secret; if it
does not match it returns a `401` response and never parses the body. On a valid
token it parses and runtime-validates the body against `Req` — untrusted input,
so we cannot trust the parsed object's type — then returns a `200` response with
the charged amount and an optional note that defaults to an empty string. A
malformed body (for example a non-numeric `amount`) fails with an error naming
the exact JSON path.

```ts
export type Req = { userId: string; amount: number; note?: string };
export type Res = { status: number; userId: string; charged: number; note: string };

class ValidationError extends Error {}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function kind(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return "num";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "array";
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
function parseReq(raw: string): Req {
  const root: unknown = JSON.parse(raw);
  if (!isObject(root)) throw new ValidationError("$ expected object, got " + kind(root));
  const note = root["note"];
  return {
    userId: str(root["userId"], "$.userId"),
    amount: num(root["amount"], "$.amount"),
    note: note === undefined ? undefined : str(note, "$.note"),
  };
}
function authed(token: string, secret: string): boolean {
  return token === secret;
}
function denied(): Res {
  return { status: 401, userId: "", charged: 0, note: "unauthorized" };
}
function respond(r: Req): Res {
  return { status: 200, userId: r.userId, charged: r.amount, note: r.note ?? "" };
}
export function handle(token: string, secret: string, raw: string): Res {
  return authed(token, secret) ? respond(parseReq(raw)) : denied();
}
```
