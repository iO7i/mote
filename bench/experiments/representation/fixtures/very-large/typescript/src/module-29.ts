export type Limits29 = { value: number; enabled: boolean };
export function normalize29(r: Limits29): number { return r.enabled ? r.value : 0; }
export function classify29(r: Limits29): string { return r.enabled ? "active" : "held"; }
