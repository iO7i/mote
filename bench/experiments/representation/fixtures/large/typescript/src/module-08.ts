export type Routing08 = { value: number; enabled: boolean };
export function normalize08(r: Routing08): number { return r.enabled ? r.value : 0; }
export function classify08(r: Routing08): string { return r.enabled ? "active" : "held"; }
