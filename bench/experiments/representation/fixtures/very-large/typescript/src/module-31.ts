export type Pricing31 = { value: number; enabled: boolean };
export function normalize31(r: Pricing31): number { return r.enabled ? r.value : 0; }
export function classify31(r: Pricing31): string { return r.enabled ? "active" : "held"; }
