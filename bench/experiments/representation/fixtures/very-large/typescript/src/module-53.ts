export type Settlement53 = { value: number; enabled: boolean };
export function normalize53(r: Settlement53): number { return r.enabled ? r.value : 0; }
export function classify53(r: Settlement53): string { return r.enabled ? "active" : "held"; }
