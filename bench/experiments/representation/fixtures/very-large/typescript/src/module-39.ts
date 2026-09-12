export type Limits39 = { value: number; enabled: boolean };
export function normalize39(r: Limits39): number { return r.enabled ? r.value : 0; }
export function classify39(r: Limits39): string { return r.enabled ? "active" : "held"; }
