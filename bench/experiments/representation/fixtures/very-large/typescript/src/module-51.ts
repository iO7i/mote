export type Pricing51 = { value: number; enabled: boolean };
export function normalize51(r: Pricing51): number { return r.enabled ? r.value : 0; }
export function classify51(r: Pricing51): string { return r.enabled ? "active" : "held"; }
