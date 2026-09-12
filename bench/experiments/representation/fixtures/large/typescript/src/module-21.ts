export type Pricing21 = { value: number; enabled: boolean };
export function normalize21(r: Pricing21): number { return r.enabled ? r.value : 0; }
export function classify21(r: Pricing21): string { return r.enabled ? "active" : "held"; }
