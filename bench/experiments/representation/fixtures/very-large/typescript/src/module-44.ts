export type Reconciliation44 = { value: number; enabled: boolean };
export function normalize44(r: Reconciliation44): number { return r.enabled ? r.value : 0; }
export function classify44(r: Reconciliation44): string { return r.enabled ? "active" : "held"; }
