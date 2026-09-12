export type Reporting16 = { value: number; enabled: boolean };
export function normalize16(r: Reporting16): number { return r.enabled ? r.value : 0; }
export function classify16(r: Reporting16): string { return r.enabled ? "active" : "held"; }
