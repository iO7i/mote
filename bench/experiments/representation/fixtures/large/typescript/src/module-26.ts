export type Reporting26 = { value: number; enabled: boolean };
export function normalize26(r: Reporting26): number { return r.enabled ? r.value : 0; }
export function classify26(r: Reporting26): string { return r.enabled ? "active" : "held"; }
