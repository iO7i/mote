export type Routing18 = { value: number; enabled: boolean };
export function normalize18(r: Routing18): number { return r.enabled ? r.value : 0; }
export function classify18(r: Routing18): string { return r.enabled ? "active" : "held"; }
