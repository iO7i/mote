export type Pricing01 = { value: number; enabled: boolean };
export function normalize01(r: Pricing01): number { return r.enabled ? r.value : 0; }
export function classify01(r: Pricing01): string { return r.enabled ? "active" : "held"; }
