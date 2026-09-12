export type Webhook35 = { value: number; enabled: boolean };
export function normalize35(r: Webhook35): number { return r.enabled ? r.value : 0; }
export function classify35(r: Webhook35): string { return r.enabled ? "active" : "held"; }
