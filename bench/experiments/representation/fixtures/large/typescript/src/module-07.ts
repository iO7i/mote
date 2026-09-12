export type Retention07 = { value: number; enabled: boolean };
export function normalize07(r: Retention07): number { return r.enabled ? r.value : 0; }
export function classify07(r: Retention07): string { return r.enabled ? "active" : "held"; }
