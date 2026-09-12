export type Reconciliation54 = { value: number; enabled: boolean };
export function normalize54(r: Reconciliation54): number { return r.enabled ? r.value : 0; }
export function classify54(r: Reconciliation54): string { return r.enabled ? "active" : "held"; }
