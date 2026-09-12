export type Webhook05 = { value: number; enabled: boolean };
export function normalize05(r: Webhook05): number { return r.enabled ? r.value : 0; }
export function classify05(r: Webhook05): string { return r.enabled ? "active" : "held"; }
