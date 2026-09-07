Here is a webhook verifier for order events. The `handle` function parses the
raw JSON body, validates it against the expected `Event` shape at runtime —
webhook payloads are untrusted input, so we cannot trust the parsed object's
type. It then returns a structured reply. The `total` helper sums the money
fields: subtotal plus shipping, minus discount, plus tax. If the payload is
malformed (for example a non-numeric `subtotal`), validation fails with an error
that names the exact JSON path, so the caller can see precisely what went wrong.
Valid payloads produce an object with `ok`, `orderId`, `amount`, and `currency`,
defaulting `currency` to `SAR` when it is absent.

```ts
export type Money = {
  subtotal: number;
  shipping: number;
  discount: number;
  tax: number;
  currency?: string;
};
export type Order = { id: string; money: Money };
export type Event = { type: string; data: { order: Order } };
export type Reply = { ok: boolean; orderId: string; amount: number; currency: string };

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
function parseEvent(raw: string): Event {
  const root: unknown = JSON.parse(raw);
  if (!isObject(root)) throw new ValidationError("$ expected object, got " + kind(root));
  const data = root["data"];
  if (!isObject(data)) throw new ValidationError("$.data expected object, got " + kind(data));
  const order = data["order"];
  if (!isObject(order)) throw new ValidationError("$.data.order expected object, got " + kind(order));
  const money = order["money"];
  if (!isObject(money)) throw new ValidationError("$.data.order.money expected object, got " + kind(money));
  const c = money["currency"];
  return {
    type: str(root["type"], "$.type"),
    data: { order: { id: str(order["id"], "$.data.order.id"), money: {
      subtotal: num(money["subtotal"], "$.data.order.money.subtotal"),
      shipping: num(money["shipping"], "$.data.order.money.shipping"),
      discount: num(money["discount"], "$.data.order.money.discount"),
      tax: num(money["tax"], "$.data.order.money.tax"),
      currency: c === undefined ? undefined : str(c, "$.data.order.money.currency"),
    } } },
  };
}
export function total(e: Event): number {
  const m = e.data.order.money;
  return m.subtotal + m.shipping - m.discount + m.tax;
}
export function handle(raw: string): Reply {
  const e = parseEvent(raw);
  return {
    ok: e.type === "order.created",
    orderId: e.data.order.id,
    amount: total(e),
    currency: e.data.order.money.currency ?? "SAR",
  };
}
```
