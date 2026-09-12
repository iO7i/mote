export type Identity40 = { value: number; enabled: boolean };
export function normalize40(r: Identity40): number { return r.enabled ? r.value : 0; }
export function classify40(r: Identity40): string { return r.enabled ? "active" : "held"; }
