export type Webhook25 = { value: number; enabled: boolean };
export function normalize25(r: Webhook25): number { return r.enabled ? r.value : 0; }
export function classify25(r: Webhook25): string { return r.enabled ? "active" : "held"; }
