export type Reporting56 = { value: number; enabled: boolean };
export function normalize56(r: Reporting56): number { return r.enabled ? r.value : 0; }
export function classify56(r: Reporting56): string { return r.enabled ? "active" : "held"; }
