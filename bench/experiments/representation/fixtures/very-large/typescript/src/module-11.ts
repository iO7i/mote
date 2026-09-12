export type Pricing11 = { value: number; enabled: boolean };
export function normalize11(r: Pricing11): number { return r.enabled ? r.value : 0; }
export function classify11(r: Pricing11): string { return r.enabled ? "active" : "held"; }
