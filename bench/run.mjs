#!/usr/bin/env node
// Mote × Tarse benchmark runner.
// Measures prose vs code tokens per variant (A/B/C/D), verifies compile + tests,
// computes separated savings, and writes results.json + REPORT.md.
//
// Numbers are reproducible from the committed run files, but are HEURISTIC token
// estimates (UNVERIFIED) unless a real tokenizer adapter is installed, and MANUAL
// (not provider-verified). Never quote them as a global "token saving".

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { compile } from "../src/compile.mjs";
import { loadAdapters, primary } from "./tokenizers.mjs";
import { splitResponse, comparisons, saving, VARIANTS } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASKS = join(HERE, "tasks");
const RUNS = join(HERE, "runs");
const TSC = resolve(HERE, "../node_modules/typescript/bin/tsc"); // cross-platform node entry

const adapters = await loadAdapters();
const head = primary(adapters);
// Shared validator runtime is imported once, not inlined per call site. Measure
// it so the code-token win can't be hidden by a huge runtime blob.
const runtimeTsTokens = head.count(readFileSync(resolve(HERE, "../src/runtime/mote.ts"), "utf8"));

function oneFile(dir, ext) {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((x) => x.endsWith(ext));
  return f ? join(dir, f) : null;
}

function moteCompiles(taskDir) {
  const f = oneFile(join(taskDir, "mote"), ".mt");
  if (!f) return "N/A";
  try {
    const r = compile(readFileSync(f, "utf8"), { file: f, emitTypes: true });
    return r.diagnostics.hasErrors ? "FAIL" : "Pass";
  } catch { return "FAIL"; }
}

function tsCompiles(taskDir) {
  const f = oneFile(join(taskDir, "typescript"), ".ts");
  if (!f) return "N/A";
  if (!existsSync(TSC)) return "UNVERIFIED";
  const res = spawnSync(process.execPath, [TSC, "--strict", "--noEmit", "--skipLibCheck",
    "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler",
    "--types", "node", f], { encoding: "utf8" });
  return res.status === 0 ? "Pass" : "FAIL";
}

function nodeTest(taskDir, name) {
  const f = join(taskDir, "tests", name);
  if (!existsSync(f)) return "N/A";
  const res = spawnSync(process.execPath, [f], { encoding: "utf8" });
  return res.status === 0 ? "Pass" : "FAIL";
}
const behaviorTests = (d) => nodeTest(d, "behavior.test.mjs");
const mutationTests = (d) => nodeTest(d, "mutation.test.mjs");

// Code representation sizes (headline adapter): Mote source vs the TypeScript it
// generates, vs the hand-written strict-TS reference. Runtime is amortized once.
function codeSizes(taskDir) {
  const mf = oneFile(join(taskDir, "mote"), ".mt");
  const tf = oneFile(join(taskDir, "typescript"), ".ts");
  const out = { runtime_shared_tokens: runtimeTsTokens };
  if (mf) {
    const src = readFileSync(mf, "utf8");
    out.mote_source_tokens = head.count(src);
    try { out.generated_ts_tokens = head.count(compile(src, { file: mf, emitTypes: true }).code); }
    catch { out.generated_ts_tokens = null; }
  }
  if (tf) out.ts_source_tokens = head.count(readFileSync(tf, "utf8"));
  if (out.mote_source_tokens && out.ts_source_tokens) {
    const m = out.mote_source_tokens, t = out.ts_source_tokens, rt = runtimeTsTokens;
    // Amortized (per module, N large): Mote source vs strict-TS source.
    out.mote_vs_ts_source_saving = saving(m, t);
    // Cold-start (1 module): Mote pays the FULL shared runtime up front.
    out.cold_start = { mote: m + rt, ts: t, saving: saving(m + rt, t) };
    // Amortized project total at N modules (runtime shared once for Mote).
    const at = (N) => ({ N, mote: N * m + rt, ts: N * t, saving: saving(N * m + rt, N * t) });
    out.amortized = [at(1), at(5), at(10)];
    // Modules of json<T>/check<T> after which Mote's TOTAL beats strict TS
    // when the runtime is VENDORED into the repo (worst case).
    out.break_even_modules = t > m ? Math.floor(rt / (t - m)) + 1 : null;
    // Dependency view: once mote-runtime is an installed npm package, its source
    // is in node_modules and does NOT count against per-module context (same as
    // zod). Only the ~6-token import line is per file — so Mote wins even at N=1.
    const IMPORT_LINE = head.count(`import * as $mote from "@mote/runtime";`);
    out.dependency_view = { mote: m + IMPORT_LINE, ts: t, saving: saving(m + IMPORT_LINE, t) };
  }
  return out;
}

function measureVariant(runDir) {
  const md = readFileSync(join(runDir, "response.md"), "utf8");
  const { prose, code } = splitResponse(md);
  const perAdapter = {};
  for (const a of adapters) {
    const p = a.count(prose), c = a.count(code);
    perAdapter[a.name] = { prose: p, code: c, total: p + c };
  }
  return { perAdapter };
}

function tokensFor(variantMeasure, adapterName) {
  return variantMeasure.perAdapter[adapterName];
}

function runTask(taskName) {
  const taskDir = join(TASKS, taskName);
  const runDir = join(RUNS, taskName);
  const status = {
    mote: moteCompiles(taskDir),
    ts: tsCompiles(taskDir),
    tests: behaviorTests(taskDir),
    mutation: mutationTests(taskDir),
  };
  const sizes = codeSizes(taskDir);

  const measures = {};
  for (const [key, v] of Object.entries(VARIANTS)) {
    const dir = join(runDir, v.dir);
    if (!existsSync(join(dir, "response.md"))) continue;
    measures[key] = measureVariant(dir);
  }

  // per-adapter comparison matrix + headline numbers
  const byAdapter = {};
  for (const a of adapters) {
    const v = {};
    for (const k of Object.keys(measures)) v[k] = tokensFor(measures[k], a.name);
    if (v.A && v.B && v.C && v.D) byAdapter[a.name] = { tokens: v, ...comparisons(v) };
  }

  return { task: taskName, status, sizes, adapters: byAdapter, measures };
}

function median(nums) {
  const xs = nums.filter((n) => typeof n === "number").sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : Math.round(((xs[mid - 1] + xs[mid]) / 2) * 10) / 10;
}

function tasksWithRuns() {
  if (!existsSync(RUNS)) return [];
  return readdirSync(RUNS).filter((d) => statSync(join(RUNS, d)).isDirectory());
}

// ---- run everything ----
const tasks = tasksWithRuns().map(runTask);
const medians = {
  mote_code_saving: median(tasks.map((t) => t.adapters[head.name]?.mote_code_saving)),
  combined_D_vs_A: median(tasks.map((t) => t.adapters[head.name]?.whole_output.D_vs_A)),
  mote_vs_ts_source_saving: median(tasks.map((t) => t.sizes?.mote_vs_ts_source_saving)),
};
// Per-tokenizer medians (report per family, never one blended number).
const perTokenizer = adapters.map((a) => ({
  name: a.name,
  status: a.status,
  code_saving_median: median(tasks.map((t) => t.adapters[a.name]?.mote_code_saving)),
  combined_median: median(tasks.map((t) => t.adapters[a.name]?.whole_output.D_vs_A)),
}));
const verifiedFamilies = adapters.filter((a) => a.status === "VERIFIED").length;
const results = {
  generatedFrom: "committed bench/runs files",
  mode: "manual",
  headlineAdapter: { name: head.name, version: head.version, status: head.status },
  adapters: adapters.map((a) => ({ name: a.name, version: a.version, status: a.status })),
  runtimeSharedTokens: runtimeTsTokens,
  tasksMeasured: tasks.length,
  medians,
  perTokenizer,
  publicThreshold: {
    required: { tasks: 5, tokenizerFamilies: 3, sharedNegativeTests: true, reportMedian: true, productionWorkflowRuns: true },
    met: { tasks: tasks.length, tokenizerFamilies: verifiedFamilies, productionWorkflowRuns: false },
    mechanicalGate: tasks.length >= 5 && verifiedFamilies >= 3,
    ready: false, // held: all runs are manual — no production-workflow data yet
  },
  tasks,
};

writeFileSync(join(HERE, "results.json"), JSON.stringify(results, null, 2) + "\n");
writeFileSync(join(HERE, "REPORT.md"), renderReport(results));
console.log(`wrote bench/results.json and bench/REPORT.md`);
console.log(`headline adapter: ${head.name} [${head.status}]`);
for (const t of results.tasks) {
  const ha = t.adapters[head.name];
  if (ha) console.log(`  ${t.task}: D vs A = ${ha.whole_output.D_vs_A}%  (compile mote=${t.status.mote} ts=${t.status.ts}, tests=${t.status.tests})`);
}

// ---- report rendering ----
function renderReport(r) {
  const a = r.headlineAdapter;
  const L = [];
  L.push(`# Mote × Tarse Benchmark Report`);
  L.push("");
  L.push(`- Run mode: **${r.mode}** (not provider-verified)`);
  L.push(`- Headline tokenizer: **${a.name}** (${a.version}) — status **${a.status}**`);
  L.push(`- Adapters measured: ${r.adapters.map((x) => `${x.name} [${x.status}]`).join(", ")}`);
  L.push("");

  for (const t of r.tasks) {
    const ha = t.adapters[a.name];
    L.push(`## ${t.task}`);
    L.push("");
    L.push(`Compile: Mote **${t.status.mote}**, strict TS **${t.status.ts}** · Behavior tests: **${t.status.tests}** · Mutation tests: **${t.status.mutation}**`);
    L.push("");
    if (t.sizes?.mote_source_tokens) {
      const s = t.sizes;
      L.push(`Code representation (${a.name}):`);
      L.push("```txt");
      L.push(`Mote source:              ${s.mote_source_tokens} tokens`);
      L.push(`Generated TypeScript:     ${s.generated_ts_tokens} tokens  (what Mote expands to, per file)`);
      L.push(`Hand-written strict TS:   ${s.ts_source_tokens} tokens`);
      L.push(`Shared runtime (once):    ${s.runtime_shared_tokens} tokens  (mote-runtime.ts, one-time, shared by all json<T>/check<T> users)`);
      L.push("");
      L.push(`Fairness accounting (cold-start vs amortized):`);
      L.push(`  Per-module (N large):   Mote ${s.mote_source_tokens} vs strict-TS ${s.ts_source_tokens}  -> ${s.mote_vs_ts_source_saving}% fewer`);
      L.push(`  Cold-start (1 module):  Mote ${s.cold_start.mote} (src+runtime) vs strict-TS ${s.cold_start.ts}  -> ${s.cold_start.saving}%  ${s.cold_start.saving < 0 ? "(Mote LOSES on a single tiny module)" : ""}`);
      for (const a of s.amortized) L.push(`  Project total @ N=${a.N}:${a.N < 10 ? "  " : " "}Mote ${a.mote} vs strict-TS ${a.ts}  -> ${a.saving}%`);
      L.push(`  Break-even (vendored):  Mote's total beats strict TS from ~${s.break_even_modules} validated module(s) onward`);
      L.push(`  Dependency view (N=1):  Mote ${s.dependency_view.mote} (src+import) vs strict-TS ${s.dependency_view.ts}  -> ${s.dependency_view.saving}%  (runtime installed as @mote/runtime, not counted per module)`);
      L.push("```");
      L.push("");
    }
    if (!ha) { L.push("_Incomplete variant set (need A–D)._\n"); continue; }
    L.push(`| Variant | Prose | Code | Total | Compile | Tests | Saving vs A |`);
    L.push(`| --- | ---: | ---: | ---: | --- | --- | ---: |`);
    for (const [key, v] of Object.entries(VARIANTS)) {
      const tk = ha.tokens[key];
      if (!tk) continue;
      const comp = v.code === "mote" ? t.status.mote : t.status.ts;
      const sv = key === "A" ? "—" : `${saving(tk.total, ha.tokens.A.total)}%`;
      L.push(`| ${v.label} | ${tk.prose} | ${tk.code} | ${tk.total} | ${comp} | ${t.status.tests} | ${sv} |`);
    }
    L.push("");
    L.push("Breakdown (separated — do NOT add these together):");
    L.push("```txt");
    L.push(`Mote code saving        (C code vs A code): ${ha.mote_code_saving}%`);
    L.push(`Tarse prose saving      (B prose vs A prose): ${ha.tarse_prose_saving}%`);
    L.push(`Prose-only whole-output (B vs A): ${ha.whole_output.B_vs_A}%`);
    L.push(`Code-only whole-output  (C vs A): ${ha.whole_output.C_vs_A}%`);
    L.push(`Combined whole-output   (D vs A): ${ha.whole_output.D_vs_A}%`);
    L.push(`Mote value given Tarse  (D vs B): ${ha.whole_output.D_vs_B}%`);
    L.push(`Tarse value given Mote  (D vs C): ${ha.whole_output.D_vs_C}%`);
    L.push(`System/skill overhead:  not measured in manual mode`);
    L.push(`Net saving after overhead: = combined (overhead unmeasured)`);
    L.push("```");
    L.push("");
  }

  L.push(`## Medians across ${r.tasksMeasured} measured task(s)`);
  L.push("");
  L.push("```txt");
  L.push(`Median Mote code saving (C vs A):        ${r.medians.mote_code_saving}%`);
  L.push(`Median Mote-vs-strict-TS source saving:  ${r.medians.mote_vs_ts_source_saving}%`);
  L.push(`Median combined whole-output (D vs A):   ${r.medians.combined_D_vs_A}%`);
  L.push("```");
  L.push("");
  L.push(`### Per-tokenizer medians (reported per family, never blended)`);
  L.push("");
  L.push(`| Tokenizer | Status | Median Mote code saving (C vs A) | Median combined (D vs A) |`);
  L.push(`| --- | --- | ---: | ---: |`);
  for (const p of r.perTokenizer) {
    L.push(`| ${p.name} | ${p.status} | ${p.code_saving_median}% | ${p.combined_median}% |`);
  }
  L.push("");
  const pt = r.publicThreshold;
  L.push(`Mechanical gate: **${pt.mechanicalGate ? "MET" : "NOT MET"}** — ${pt.met.tasks}/5 tasks, ${pt.met.tokenizerFamilies}/3 VERIFIED tokenizer families, shared behavioral + mutation tests.`);
  L.push("");
  L.push(`Public headline: **HELD** — every run here is **manual** (representative prose, not production-workflow sessions). Do NOT publish a sweeping "X% fewer tokens" claim until production-workflow runs on real production modules are collected and reported separately. These 5 small synthetic tasks are enough to *continue*, not to make a broad claim.`);
  L.push("");

  L.push(`## Honesty safeguards`);
  L.push("");
  L.push(`- This run was **manual**, not provider-verified.`);
  L.push(`- Tokenizer: **${a.name}** ${a.version}, status **${a.status}**. Heuristic adapters are NOT tokenizer-accurate.`);
  L.push(`- Code behavior is verified by \`tests/behavior.test.mjs\` for Mote and the untyped reference; strict TS is compile-verified via \`tsc\`.`);
  L.push(`- Tarse/Prose *instruction overhead* (system-prompt cost) is NOT included here.`);
  L.push(`- Reasoning/thinking tokens were NOT available and NOT measured.`);
  L.push(`- Output-token reduction does **not** by itself prove better workflow performance.`);
  L.push(`- Mote and Tarse savings act on different token pools and must be reported separately.`);
  L.push(`- **Fairness — full source, not just the core:** the strict-TS baseline uses compact hand-written validation (NOT verbose Zod) and includes its complete parse/validate code. On a single tiny module Mote can LOSE once its ~${r.runtimeSharedTokens}-token shared runtime is counted (see cold-start); it wins only from the break-even module count onward.`);
  L.push(`- **Fairness assumption:** strict-TS generic helpers (isObject/kind/num/str, a few dozen tokens) are counted per-file, not amortized. Sharing them would slightly raise Mote's break-even — the amortized medians are therefore mildly optimistic for Mote and are labelled per-module, not whole-project.`);
  L.push("");
  return L.join("\n") + "\n";
}
