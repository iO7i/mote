// Untyped reference (secondary). No static types, NO runtime validation.

export function mapUser(r) {
  return { id: r.id, name: r.name, active: r.deleted_at === null };
}

export function page(total, size, n) {
  return { page: n, pages: Math.ceil(total / size), offset: n * size };
}

export function load(raw) {
  return mapUser(JSON.parse(raw));
}
