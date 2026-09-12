export type Reporting36 = { value: number; enabled: boolean };
export function normalize36(r: Reporting36): number { return r.enabled ? r.value : 0; }
export function classify36(r: Reporting36): string { return r.enabled ? "active" : "held"; }
