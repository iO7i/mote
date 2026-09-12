export type Webhook45 = { value: number; enabled: boolean };
export function normalize45(r: Webhook45): number { return r.enabled ? r.value : 0; }
export function classify45(r: Webhook45): string { return r.enabled ? "active" : "held"; }
