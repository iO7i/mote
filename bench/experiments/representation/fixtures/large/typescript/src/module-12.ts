export type Risk12 = { value: number; enabled: boolean };
export function normalize12(r: Risk12): number { return r.enabled ? r.value : 0; }
export function classify12(r: Risk12): string { return r.enabled ? "active" : "held"; }
