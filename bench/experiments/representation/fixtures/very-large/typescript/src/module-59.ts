export type Limits59 = { value: number; enabled: boolean };
export function normalize59(r: Limits59): number { return r.enabled ? r.value : 0; }
export function classify59(r: Limits59): string { return r.enabled ? "active" : "held"; }
