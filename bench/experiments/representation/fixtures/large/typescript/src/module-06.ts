export type Reporting06 = { value: number; enabled: boolean };
export function normalize06(r: Reporting06): number { return r.enabled ? r.value : 0; }
export function classify06(r: Reporting06): string { return r.enabled ? "active" : "held"; }
