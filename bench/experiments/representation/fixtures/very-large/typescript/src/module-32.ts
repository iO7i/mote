export type Risk32 = { value: number; enabled: boolean };
export function normalize32(r: Risk32): number { return r.enabled ? r.value : 0; }
export function classify32(r: Risk32): string { return r.enabled ? "active" : "held"; }
