// Benchmark helpers: split a response into prose vs code, and compute
// the separated savings metrics defined in the benchmark spec.

// Split markdown into { prose, code } by fenced code blocks (``` ... ```).
// Code fences are removed from prose; their bodies are concatenated as code.
export function splitResponse(md) {
  const lines = md.split("\n");
  const prose = [];
  const code = [];
  let inFence = false;
  for (const ln of lines) {
    if (/^\s*```/.test(ln)) { inFence = !inFence; continue; }
    (inFence ? code : prose).push(ln);
  }
  return { prose: prose.join("\n").trim(), code: code.join("\n").trim() };
}

const pct = (x) => Math.round(x * 1000) / 10; // one decimal place, as a percentage

// saving = 1 - part/whole, guarded against divide-by-zero.
export function saving(part, whole) {
  if (!whole) return null;
  return pct(1 - part / whole);
}

// Given per-variant token totals, compute the spec's comparison matrix.
// variants: { A, B, C, D } each = { prose, code, total }
export function comparisons(v) {
  return {
    mote_code_saving: saving(v.C.code, v.A.code),      // Mote vs TS code only
    tarse_prose_saving: saving(v.B.prose, v.A.prose),  // Tarse vs normal prose only
    whole_output: {
      B_vs_A: saving(v.B.total, v.A.total),            // prose-only effect
      C_vs_A: saving(v.C.total, v.A.total),            // code-only effect
      D_vs_A: saving(v.D.total, v.A.total),            // combined
      D_vs_B: saving(v.D.total, v.B.total),            // Mote's add'l value given Tarse
      D_vs_C: saving(v.D.total, v.C.total),            // Tarse's add'l value given Mote
    },
  };
}

export const VARIANTS = {
  A: { dir: "A-normal-ts", label: "A: Normal + TS", prose: "normal", code: "ts" },
  B: { dir: "B-tarse-ts", label: "B: Tarse + TS", prose: "tarse", code: "ts" },
  C: { dir: "C-normal-mote", label: "C: Normal + Mote", prose: "normal", code: "mote" },
  D: { dir: "D-tarse-mote", label: "D: Tarse + Mote", prose: "tarse", code: "mote" },
};
