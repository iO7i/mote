export type Settlement03 = { value: number; enabled: boolean };
export function normalize03(r: Settlement03): number { return r.enabled ? r.value : 0; }
export function classify03(r: Settlement03): string { return r.enabled ? "active" : "held"; }
