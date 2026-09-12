export type Routing38 = { value: number; enabled: boolean };
export function normalize38(r: Routing38): number { return r.enabled ? r.value : 0; }
export function classify38(r: Routing38): string { return r.enabled ? "active" : "held"; }
