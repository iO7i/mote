export type Identity50 = { value: number; enabled: boolean };
export function normalize50(r: Identity50): number { return r.enabled ? r.value : 0; }
export function classify50(r: Identity50): string { return r.enabled ? "active" : "held"; }
