export type Retention27 = { value: number; enabled: boolean };
export function normalize27(r: Retention27): number { return r.enabled ? r.value : 0; }
export function classify27(r: Retention27): string { return r.enabled ? "active" : "held"; }
