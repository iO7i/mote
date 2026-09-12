export type Reconciliation34 = { value: number; enabled: boolean };
export function normalize34(r: Reconciliation34): number { return r.enabled ? r.value : 0; }
export function classify34(r: Reconciliation34): string { return r.enabled ? "active" : "held"; }
