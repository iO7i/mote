export type Reporting46 = { value: number; enabled: boolean };
export function normalize46(r: Reporting46): number { return r.enabled ? r.value : 0; }
export function classify46(r: Reporting46): string { return r.enabled ? "active" : "held"; }
