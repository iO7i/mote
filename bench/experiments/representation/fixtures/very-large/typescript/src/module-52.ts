export type Risk52 = { value: number; enabled: boolean };
export function normalize52(r: Risk52): number { return r.enabled ? r.value : 0; }
export function classify52(r: Risk52): string { return r.enabled ? "active" : "held"; }
