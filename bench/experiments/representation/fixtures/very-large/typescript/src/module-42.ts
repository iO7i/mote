export type Risk42 = { value: number; enabled: boolean };
export function normalize42(r: Risk42): number { return r.enabled ? r.value : 0; }
export function classify42(r: Risk42): string { return r.enabled ? "active" : "held"; }
