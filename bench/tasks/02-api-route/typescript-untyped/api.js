// Untyped reference (secondary). No static types, NO runtime validation.

function authed(token, secret) {
  return token === secret;
}
function denied() {
  return { status: 401, userId: "", charged: 0, note: "unauthorized" };
}
function respond(r) {
  return { status: 200, userId: r.userId, charged: r.amount, note: r.note ?? "" };
}

export function handle(token, secret, raw) {
  return authed(token, secret) ? respond(JSON.parse(raw)) : denied();
}
