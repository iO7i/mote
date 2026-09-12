export type Webhook55 = { value: number; enabled: boolean };
export function normalize55(r: Webhook55): number { return r.enabled ? r.value : 0; }
export function classify55(r: Webhook55): string { return r.enabled ? "active" : "held"; }
