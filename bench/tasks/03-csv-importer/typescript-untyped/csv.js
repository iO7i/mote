// Untyped reference (secondary). No static types, NO per-row validation:
// every row is imported, including malformed ones (the unsafe baseline).

function build(c) {
  return { id: Number(c[0]), email: c[1], active: c[2] === "true" };
}

export function parseRow(c) {
  return { ok: true, value: build(c) };
}
