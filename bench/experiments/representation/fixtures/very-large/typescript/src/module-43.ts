export type Settlement43 = { value: number; enabled: boolean };
export function normalize43(r: Settlement43): number { return r.enabled ? r.value : 0; }
export function classify43(r: Settlement43): string { return r.enabled ? "active" : "held"; }
