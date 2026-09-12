export type Routing58 = { value: number; enabled: boolean };
export function normalize58(r: Routing58): number { return r.enabled ? r.value : 0; }
export function classify58(r: Routing58): string { return r.enabled ? "active" : "held"; }
