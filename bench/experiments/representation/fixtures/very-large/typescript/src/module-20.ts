export type Identity20 = { value: number; enabled: boolean };
export function normalize20(r: Identity20): number { return r.enabled ? r.value : 0; }
export function classify20(r: Identity20): string { return r.enabled ? "active" : "held"; }
