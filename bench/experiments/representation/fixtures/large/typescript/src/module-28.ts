export type Routing28 = { value: number; enabled: boolean };
export function normalize28(r: Routing28): number { return r.enabled ? r.value : 0; }
export function classify28(r: Routing28): string { return r.enabled ? "active" : "held"; }
