export type Routing48 = { value: number; enabled: boolean };
export function normalize48(r: Routing48): number { return r.enabled ? r.value : 0; }
export function classify48(r: Routing48): string { return r.enabled ? "active" : "held"; }
