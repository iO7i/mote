export type Risk22 = { value: number; enabled: boolean };
export function normalize22(r: Risk22): number { return r.enabled ? r.value : 0; }
export function classify22(r: Risk22): string { return r.enabled ? "active" : "held"; }
