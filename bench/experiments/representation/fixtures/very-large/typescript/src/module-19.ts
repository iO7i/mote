export type Limits19 = { value: number; enabled: boolean };
export function normalize19(r: Limits19): number { return r.enabled ? r.value : 0; }
export function classify19(r: Limits19): string { return r.enabled ? "active" : "held"; }
