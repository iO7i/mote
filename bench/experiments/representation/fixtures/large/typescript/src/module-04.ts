export type Reconciliation04 = { value: number; enabled: boolean };
export function normalize04(r: Reconciliation04): number { return r.enabled ? r.value : 0; }
export function classify04(r: Reconciliation04): string { return r.enabled ? "active" : "held"; }
