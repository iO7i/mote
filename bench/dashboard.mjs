// Generate a self-contained, evidence-bound research dashboard. All numbers
// are loaded from raw JSON artifacts; with no live records the dashboard shows
// an explicit no-data state instead of rendering a synthetic efficacy chart.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const raw = (name, fallback = {}) => { const file = join(root, "bench", "raw", name); return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback; };
const mutation = raw("compiler-mutation-latest.json");
const fuzz = raw("attack-fuzz-latest.json");
const fake = raw("fake-agent-campaign-latest.json");
const review = raw("pilot-review-latest.json");
const density = raw("semantic-density-latest.json");
const representation = raw("representation-measurement-latest.json");
const liveRecords = loadOptionalLiveRecords();
const data = {
  generatedAt: "2026-09-12",
  evidenceBoundary: liveRecords.length ? "LIVE_DATA_PRESENT" : "NO_LIVE_MODEL_DATA",
  liveRecordCount: liveRecords.length,
  mutation: { generated: mutation.generated ?? 0, valid: mutation.valid ?? 0, killed: mutation.counts?.KILLED ?? 0, equivalent: mutation.counts?.EQUIVALENT ?? 0, survivors: mutation.counts?.SURVIVED ?? 0, invalid: mutation.counts?.INVALID_MUTANT ?? 0, score: mutation.mutationScore ?? null },
  fuzz: { cases: fuzz.stats?.total ?? 0, contained: fuzz.stats?.contained ?? 0, crashes: fuzz.stats?.crashes ?? 0, metamorphicChecks: fuzz.stats?.metamorphicChecks ?? 0, failures: fuzz.stats?.metamorphicFailures ?? 0 },
  pilot: { tasks: review.summary?.accepted ?? 0, equivalence: review.summary?.equivalencePass ?? 0, mutationControls: review.summary?.mutationControlPass ?? 0, familiarityRisk: review.summary?.highFamiliarityRisk ?? 0 },
  fake: { pairedTasks: fake.pairedTasks ?? 0, armRuns: fake.armRuns ?? 0, status: fake.status ?? "NOT RUN" },
  density: summarizeDensity(density.rows ?? []),
  representation: (representation.rows ?? []).map((row) => ({ scale: row.scale, language: row.language, total: row.totalSourceTokens, relevant: row.relevantContextTokens, ratio: row.relevantContextRatio, editFiles: row.editSurfaceFiles })),
};

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mote research console</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#111a30;--ink:#edf3ff;--muted:#91a4c7;--cyan:#57e8ff;--violet:#a78bfa;--green:#61e294;--amber:#ffc857;--red:#ff6b81}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,#1d3158 0,#0b1020 42%);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:44px 28px 72px}h1{font-size:clamp(34px,6vw,68px);letter-spacing:-.06em;margin:0;line-height:.95}h2{font-size:18px;margin:0 0 18px}.lede{max-width:670px;color:var(--muted);font-size:17px;margin:22px 0 30px}.banner{border:1px solid var(--amber);background:#2a2311;color:#ffe8a3;border-radius:16px;padding:16px 18px;margin:0 0 26px;font-weight:650}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:28px}.card,.panel{background:linear-gradient(145deg,#15213b,#0e162a);border:1px solid #263b63;border-radius:18px;box-shadow:0 16px 40px #02051155}.card{padding:20px}.value{font-size:34px;font-weight:800;letter-spacing:-.04em}.label{color:var(--muted);font-size:13px}.panel{padding:22px;margin-bottom:18px}.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:800px){.cols{grid-template-columns:1fr}}.barrow{display:grid;grid-template-columns:130px 1fr 60px;gap:10px;align-items:center;margin:9px 0;color:var(--muted);font-size:13px}.bar{height:10px;border-radius:99px;background:#203253;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--violet));border-radius:inherit}.pill{display:inline-block;padding:5px 9px;border-radius:99px;background:#183d37;color:var(--green);font-size:12px;font-weight:700}.warn{background:#3f2e18;color:var(--amber)}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:9px;border-bottom:1px solid #263653;color:var(--muted)}th{color:var(--ink)}code{color:var(--cyan)}footer{color:var(--muted);font-size:12px;margin-top:30px}
</style></head><body><main>
<div class="banner">${data.evidenceBoundary === "NO_LIVE_MODEL_DATA" ? "NO LIVE MODEL DATA — this console reports compiler, harness, and design evidence only." : "LIVE DATA PRESENT — inspect raw manifests and exclusions before interpreting results."}</div>
<h1>Mote research<br>console</h1><p class="lede">A compact view of compiler robustness, benchmark controls, application ownership, and representation-stress inputs. Every card is derived from committed raw artifacts.</p>
<section class="grid">
${card(data.mutation.generated, "compiler mutants generated")} ${card(data.mutation.score == null ? "—" : pct(data.mutation.score), "valid mutation score")} ${card(data.fuzz.cases, "attack-fuzz cases")} ${card(data.fake.armRuns, "fake-agent arm runs")}
</section>
<div class="cols"><section class="panel"><h2>Compiler robustness</h2>${bar("killed", data.mutation.killed, data.mutation.generated, "cyan")}${bar("equivalent on oracle", data.mutation.equivalent, data.mutation.generated, "violet")}${bar("survived", data.mutation.survivors, data.mutation.generated, "red")}${bar("invalid", data.mutation.invalid, data.mutation.generated, "amber")}<p><span class="pill">${data.fuzz.crashes === 0 ? "0 crashes" : `${data.fuzz.crashes} crashes`}</span> <span class="pill">${data.fuzz.metamorphicChecks} metamorphic checks</span></p></section>
<section class="panel"><h2>Pilot controls</h2>${bar("accepted tasks", data.pilot.tasks, 20)}${bar("reference equivalence", data.pilot.equivalence, 20)}${bar("mutation controls", data.pilot.mutationControls, 20)}${bar("high familiarity risk", data.pilot.familiarityRisk, 20)}<p><span class="pill warn">${data.fake.status}</span> fake provider is harness-only</p></section></div>
<section class="panel"><h2>Relevant-context ratio by scale</h2><table><thead><tr><th>Scale</th><th>Language</th><th>Total tokens</th><th>Relevant tokens</th><th>Ratio</th><th>Edit files</th></tr></thead><tbody>${data.representation.map((row) => `<tr><td>${esc(row.scale)}</td><td>${esc(row.language)}</td><td>${row.total}</td><td>${row.relevant}</td><td>${row.ratio == null ? "—" : pct(row.ratio)}</td><td>${row.editFiles}</td></tr>`).join("") || `<tr><td colspan="6">Generate representation fixtures to populate this design table.</td></tr>`}</tbody></table></section>
<section class="panel"><h2>Evidence boundary</h2><p class="lede">${data.liveRecordCount ? `${data.liveRecordCount} live records are available; paired analysis remains subject to the manifest exclusions.` : "No provider-backed record is eligible for an efficacy claim. The live runner remains blocked pending explicit authorization, credentials, and Docker isolation."}</p><p><span class="pill">${data.density.moteRows} Mote density rows</span> <span class="pill">${data.density.typescriptRows} TypeScript density rows</span></p></section>
<footer>Generated ${data.generatedAt}. Source: bench/raw/*.json. Dashboard numbers are not manually transcribed.</footer></main></body></html>`;
mkdirSync(join(root, "bench", "dashboard"), { recursive: true });
writeFileSync(join(root, "bench", "dashboard", "index.html"), page);
writeFileSync(join(root, "bench", "dashboard", "data.json"), JSON.stringify(data, null, 2) + "\n");
console.log(JSON.stringify({ status: "PASS", output: "bench/dashboard/index.html", evidenceBoundary: data.evidenceBoundary, liveRecordCount: data.liveRecordCount }, null, 2));

function card(value, label) { return `<div class="card"><div class="value">${value}</div><div class="label">${label}</div></div>`; }
function bar(label, value, total, color = "cyan") { const width = total ? Math.min(100, Math.max(0, value / total * 100)) : 0; return `<div class="barrow"><span>${label}</span><div class="bar"><i style="width:${width}%;background:linear-gradient(90deg,var(--${color === "violet" ? "violet" : color === "red" ? "red" : color === "amber" ? "amber" : "cyan"}),var(--violet))"></i></div><b>${value}/${total}</b></div>`; }
function pct(value) { return `${(value * 100).toFixed(1)}%`; }
function esc(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function summarizeDensity(rows) { return { moteRows: rows.filter((row) => row.language === "mote").length, typescriptRows: rows.filter((row) => row.language === "typescript").length }; }
function loadOptionalLiveRecords() { const file = join(root, "bench", "raw", "live-runs.jsonl"); if (!existsSync(file)) return []; return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).filter((row) => row.status === "LIVE RUN"); }
