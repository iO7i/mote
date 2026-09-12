export type Risk02 = { value: number; enabled: boolean };
export function normalize02(r: Risk02): number { return r.enabled ? r.value : 0; }
export function classify02(r: Risk02): string { return r.enabled ? "active" : "held"; }
