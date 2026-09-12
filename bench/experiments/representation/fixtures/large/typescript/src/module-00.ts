export type Identity00 = { value: number; enabled: boolean };
export function normalize00(r: Identity00): number { return r.enabled ? r.value : 0; }
export function classify00(r: Identity00): string { return r.enabled ? "active" : "held"; }
