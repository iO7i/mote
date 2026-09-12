export type Limits49 = { value: number; enabled: boolean };
export function normalize49(r: Limits49): number { return r.enabled ? r.value : 0; }
export function classify49(r: Limits49): string { return r.enabled ? "active" : "held"; }
