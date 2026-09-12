export type Retention37 = { value: number; enabled: boolean };
export function normalize37(r: Retention37): number { return r.enabled ? r.value : 0; }
export function classify37(r: Retention37): string { return r.enabled ? "active" : "held"; }
