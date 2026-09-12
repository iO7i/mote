export type Retention57 = { value: number; enabled: boolean };
export function normalize57(r: Retention57): number { return r.enabled ? r.value : 0; }
export function classify57(r: Retention57): string { return r.enabled ? "active" : "held"; }
