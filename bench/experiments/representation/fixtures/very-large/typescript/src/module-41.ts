export type Pricing41 = { value: number; enabled: boolean };
export function normalize41(r: Pricing41): number { return r.enabled ? r.value : 0; }
export function classify41(r: Pricing41): string { return r.enabled ? "active" : "held"; }
