// Strict TypeScript + equivalent runtime validation (primary comparison).

import * as crypto from "node:crypto";

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

function num(v: unknown, path: string): number {
  if (typeof v !== "number" || Number.isNaN(v)) {
    throw new ValidationError(`${path} expected num, got ${kind(v)}`);
  }
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string") throw new ValidationError(`${path} expected str, got ${kind(v)}`);
  return v;
}

function kind(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return "num";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "array";
  return "object";
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
  const currencyRaw = money["currency"];
  return {
    type: str(root["type"], "$.type"),
    data: {
      order: {
        id: str(order["id"], "$.data.order.id"),
        money: {
          subtotal: num(money["subtotal"], "$.data.order.money.subtotal"),
          shipping: num(money["shipping"], "$.data.order.money.shipping"),
          discount: num(money["discount"], "$.data.order.money.discount"),
          tax: num(money["tax"], "$.data.order.money.tax"),
          currency: currencyRaw === undefined ? undefined : str(currencyRaw, "$.data.order.money.currency"),
        },
      },
    },
  };
}

export function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function valid(body: string, secret: string, sig: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(sign(body, secret)), Buffer.from(sig));
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
