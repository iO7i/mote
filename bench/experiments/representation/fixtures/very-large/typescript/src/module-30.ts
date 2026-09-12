export type Identity30 = { value: number; enabled: boolean };
export function normalize30(r: Identity30): number { return r.enabled ? r.value : 0; }
export function classify30(r: Identity30): string { return r.enabled ? "active" : "held"; }
