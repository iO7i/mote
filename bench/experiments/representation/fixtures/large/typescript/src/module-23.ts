export type Settlement23 = { value: number; enabled: boolean };
export function normalize23(r: Settlement23): number { return r.enabled ? r.value : 0; }
export function classify23(r: Settlement23): string { return r.enabled ? "active" : "held"; }
