// Untyped reference (secondary). No static types, NO runtime validation —
// included only to show the unsafe baseline. Do not treat as the primary result.

import * as crypto from "node:crypto";

export function sign(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function valid(body, secret, sig) {
  return crypto.timingSafeEqual(Buffer.from(sign(body, secret)), Buffer.from(sig));
}

export function total(e) {
  const m = e.data.order.money;
  return m.subtotal + m.shipping - m.discount + m.tax;
}

export function handle(raw) {
  const e = JSON.parse(raw);
  return {
    ok: e.type === "order.created",
    orderId: e.data.order.id,
    amount: total(e),
    currency: e.data.order.money.currency ?? "SAR",
  };
}
