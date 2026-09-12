export type Reconciliation24 = { value: number; enabled: boolean };
export function normalize24(r: Reconciliation24): number { return r.enabled ? r.value : 0; }
export function classify24(r: Reconciliation24): string { return r.enabled ? "active" : "held"; }
