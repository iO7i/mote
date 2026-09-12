export type Retention47 = { value: number; enabled: boolean };
export function normalize47(r: Retention47): number { return r.enabled ? r.value : 0; }
export function classify47(r: Retention47): string { return r.enabled ? "active" : "held"; }
