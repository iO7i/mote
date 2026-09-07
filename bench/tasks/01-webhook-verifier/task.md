# Task 01 — Webhook Verifier

Implement a handler that accepts a raw JSON webhook body for an e-commerce
order event and returns a structured reply.

## Required behavior

`handle(raw: string)` must:

1. Parse the raw JSON.
2. Validate it against the `Event` shape **at runtime** (untrusted input):
   - `type: str`
   - `data.order.id: str`
   - `data.order.money.{subtotal,shipping,discount,tax}: num`
   - `data.order.money.currency: str?` (optional)
3. On invalid input, fail with an error whose message includes the failing path
   (e.g. `$.data.order.money.subtotal expected num, got str`).
4. On valid input, return:
   ```json
   { "ok": <type == "order.created">, "orderId": <id>,
     "amount": subtotal + shipping - discount + tax,
     "currency": <currency ?? "SAR"> }
   ```

## Fairness

- The primary comparison is **Mote (typed + runtime validation)** vs
  **strict TypeScript + equivalent runtime validation**.
- `typescript-untyped/` is a *secondary* reference only.
- All variants run the SAME tests in `tests/behavior.test.mjs` against the SAME
  fixtures in `fixtures/`.
