export type Reconciliation14 = { value: number; enabled: boolean };
export function normalize14(r: Reconciliation14): number { return r.enabled ? r.value : 0; }
export function classify14(r: Reconciliation14): string { return r.enabled ? "active" : "held"; }
