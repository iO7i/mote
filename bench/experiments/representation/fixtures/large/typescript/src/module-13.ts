export type Settlement13 = { value: number; enabled: boolean };
export function normalize13(r: Settlement13): number { return r.enabled ? r.value : 0; }
export function classify13(r: Settlement13): string { return r.enabled ? "active" : "held"; }
