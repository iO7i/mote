export type Limits09 = { value: number; enabled: boolean };
export function normalize09(r: Limits09): number { return r.enabled ? r.value : 0; }
export function classify09(r: Limits09): string { return r.enabled ? "active" : "held"; }
