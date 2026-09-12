export type Identity10 = { value: number; enabled: boolean };
export function normalize10(r: Identity10): number { return r.enabled ? r.value : 0; }
export function classify10(r: Identity10): string { return r.enabled ? "active" : "held"; }
