export type Settlement33 = { value: number; enabled: boolean };
export function normalize33(r: Settlement33): number { return r.enabled ? r.value : 0; }
export function classify33(r: Settlement33): string { return r.enabled ? "active" : "held"; }
