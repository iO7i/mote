export type Webhook15 = { value: number; enabled: boolean };
export function normalize15(r: Webhook15): number { return r.enabled ? r.value : 0; }
export function classify15(r: Webhook15): string { return r.enabled ? "active" : "held"; }
