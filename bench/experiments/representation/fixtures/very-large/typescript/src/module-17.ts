export type Retention17 = { value: number; enabled: boolean };
export function normalize17(r: Retention17): number { return r.enabled ? r.value : 0; }
export function classify17(r: Retention17): string { return r.enabled ? "active" : "held"; }
