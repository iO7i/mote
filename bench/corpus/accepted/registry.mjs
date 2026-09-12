// Private, reproducible pilot fixtures. The live harness materializes only the
// language-specific visibleFiles; references, inputs, and mutants stay here.

const phaseNames = [
  "parse", "typecheck", "generated-typescript", "public-tests", "hidden-tests",
  "boundary-validation", "mutation-tests", "api-existence", "property-invariants", "regression-tests",
];
const phases = Object.freeze({
  mote: phaseNames.map((name) => ({ name, command: ["node", ".benchmark/check.mjs", "--phase", name, "--language", "mote"], budget: 1 })),
  typescript: phaseNames.map((name) => ({ name, command: ["node", ".benchmark/check.mjs", "--phase", name, "--language", "typescript"], budget: 1 })),
});

const starterMt = (signature) => `pub fn solve(${signature}) = 0`;
const starterTs = (signature) => `export function solve(${signature}) { return 0; }`;
const mtRef = (signature, expression, returnType) => `pub fn solve(${signature})->${returnType}=${expression}`;
const tsRef = (signature, expression, returnType) => `export function solve(input: ${signature}): ${returnType} { return ${expression}; }`;

const specs = [
  ["P01", "Normalize paginated records", "typed-transformation", "new-module", "small", "input:{page:num,size:num}", "(input.page-1)*input.size", "num", [{ page: 1, size: 20 }, { page: 3, size: 25 }, { page: 0, size: 10 }], "input.page*input.size", "page-is-one-based"],
  ["P02", "Merge sparse configuration", "typed-transformation", "new-module", "small", "input:{base:num,override:num?}", "input.base+(input.override??0)", "num", [{ base: 4 }, { base: 4, override: 3 }, { base: -2, override: 0 }], "input.base+(input.override??1)", "missing-override-default"],
  ["P03", "Summarize nullable metrics", "typed-transformation", "new-module", "small", "input:{ok:bool,success:num,fallback:num}", "input.ok?input.success:input.fallback", "num", [{ ok: true, success: 9, fallback: 2 }, { ok: false, success: 9, fallback: 2 }, { ok: false, success: -1, fallback: 7 }], "input.ok?input.fallback:input.success", "reversed-branch"],
  ["P04", "Parse versioned JSON envelope", "data-boundary", "new-module", "small", "input:{major:num,minor:num}", "input.major*100+input.minor", "num", [{ major: 1, minor: 0 }, { major: 2, minor: 7 }, { major: 0, minor: 42 }], "input.major*10+input.minor", "minor-scale"],
  ["P05", "Validate webhook payload", "data-boundary", "new-module", "small", "input:{count:num,limit:num}", "input.count<=input.limit", "bool", [{ count: 0, limit: 0 }, { count: 5, limit: 5 }, { count: 6, limit: 5 }], "input.count<input.limit", "exclusive-limit"],
  ["P06", "Serialize import error parts", "parser-serializer", "new-module", "small", "input:{code:num,message:num}", "input.code+input.message", "num", [{ code: 4, message: 2 }, { code: 0, message: 8 }, { code: 99, message: -1 }], "input.message", "drops-code"],
  ["P07", "Route typed request", "api-handler", "new-module", "small", "input:{authenticated:bool,value:num}", "input.authenticated?input.value:401", "num", [{ authenticated: true, value: 200 }, { authenticated: false, value: 200 }, { authenticated: true, value: 0 }], "input.authenticated?input.value:403", "wrong-status"],
  ["P08", "Add authenticated health endpoint", "api-handler", "feature-addition", "medium", "input:{health:num,secret:bool}", "input.secret&&input.health>0", "bool", [{ health: 1, secret: true }, { health: 1, secret: false }, { health: 0, secret: true }], "input.health>0", "ignores-secret"],
  ["P09", "Decode line-oriented events", "parser-serializer", "new-module", "small", "input:{left:num,right:num}", "input.left+input.right", "num", [{ left: 1, right: 2 }, { left: -5, right: 8 }, { left: 0, right: 0 }], "input.left-input.right", "subtracts-events"],
  ["P10", "Round-trip configuration format", "parser-serializer", "new-module", "medium", "input:{x:num,y:num}", "input.x*10+input.y", "num", [{ x: 1, y: 2 }, { x: 9, y: 0 }, { x: -1, y: 4 }], "input.y*10+input.x", "coordinate-order"],
  ["P11", "Track bounded job state", "stateful-module", "new-module", "medium", "input:{running:num,delta:num}", "input.running+input.delta", "num", [{ running: 2, delta: 1 }, { running: 5, delta: -3 }, { running: 0, delta: 0 }], "input.running-input.delta", "state-delta-subtracted"],
  ["P12", "Repair stale cache transition", "stateful-module", "bug-repair", "medium", "input:{cached:num,fresh:num}", "input.cached==0?input.fresh:input.cached", "num", [{ cached: 0, fresh: 8 }, { cached: 3, fresh: 8 }, { cached: -1, fresh: 8 }], "input.fresh", "always-fresh"],
  ["P13", "Read a Node filesystem fixture", "npm-node-interoperability", "integration", "small", "input:{left:num,right:num}", "input.left-input.right", "num", [{ left: 10, right: 4 }, { left: 4, right: 10 }, { left: 0, right: 0 }], "input.right-input.left", "unsigned-difference"],
  ["P14", "Call a typed package adapter", "npm-node-interoperability", "integration", "medium", "input:{a:num,b:num,enabled:bool}", "input.enabled?(input.a+input.b):input.a", "num", [{ a: 2, b: 3, enabled: true }, { a: 2, b: 3, enabled: false }, { a: -1, b: 9, enabled: true }], "input.a+input.b", "adapter-always-enabled"],
  ["P15", "Repair a boundary regression", "bug-repair", "bug-repair", "medium", "input:{value:num,min:num,max:num}", "input.value<input.min?input.min:(input.value>input.max?input.max:input.value)", "num", [{ value: 1, min: 2, max: 5 }, { value: 9, min: 2, max: 5 }, { value: 3, min: 2, max: 5 }, { value: 5, min: 2, max: 5 }], "input.value<input.min?input.min:(input.value>input.max?input.max:input.value+1)", "inclusive-middle-off-by-one"],
  ["P16", "Add a compatible optional field", "feature-addition", "feature-addition", "medium", "input:{count:num,extra:num?}", "input.count+(input.extra??0)", "num", [{ count: 5 }, { count: 5, extra: null }, { count: 5, extra: 2 }], "input.count+(input.extra??-1)", "null-is-not-zero"],
  ["P17", "Refactor duplicated validation", "refactoring", "refactoring", "medium", "input:{a:num,b:num,c:num}", "input.a+input.b+input.c", "num", [{ a: 1, b: 2, c: 3 }, { a: -1, b: 5, c: 0 }, { a: 0, b: 0, c: 0 }], "input.a+input.b", "drops-third-field"],
  ["P18", "Split a multi-file service", "multi-file-maintenance", "refactoring", "large", "input:{base:num,delta:num,enabled:bool}", "input.enabled?(input.base+input.delta):input.base", "num", [{ base: 10, delta: 2, enabled: true }, { base: 10, delta: 2, enabled: false }, { base: -3, delta: -4, enabled: true }], "input.enabled?(input.base-input.delta):input.base", "migration-reverses-delta"],
  ["P19", "Maintain an unfamiliar repository", "long-context", "bug-repair", "large", "input:{first:num,second:num}", "input.first*input.first+input.second", "num", [{ first: 2, second: 3 }, { first: -2, second: 3 }, { first: 0, second: 4 }], "input.first*input.first-input.second", "unsigned-square-regression"],
  ["P20", "Implement a cross-module migration", "long-context", "feature-addition", "large", "input:{a:num,b:num}", "input.a==input.b", "bool", [{ a: 1, b: 1 }, { a: 1, b: 2 }, { a: -1, b: -1 }], "true", "always-true-migration"],
];

function toTsSignature(signature) {
  const body = signature.slice("input:".length);
  return body
    .replace(/(\w+):num\?/g, "$1?: number | null")
    .replaceAll(":num", ":number")
    .replaceAll(":str", ":string")
    .replaceAll(":bool", ":boolean");
}

function makeFixture(spec) {
  const [id, title, stratum, kind, repoScale, signature, expression, returnType, inputs, mutantExpression, mutationName] = spec;
  const tsSignature = toTsSignature(signature);
  const tsExpression = expression.replaceAll("==", "===");
  const tsMutantExpression = mutantExpression.replaceAll("==", "===");
  return Object.freeze({
    id, title, stratum, kind, repoScale, hardNegative: false,
    prompt: `Implement solve(input) for ${title.toLowerCase()}. Preserve the public solve API and handle every boundary case described by the visible types.`,
    visibleFiles: { mote: { "solution.mt": starterMt(signature) }, typescript: { "solution.ts": starterTs(`input: ${tsSignature}`) } },
    referenceSolutions: {
      mote: mtRef(signature, expression, returnType),
      typescript: tsRef(tsSignature, tsExpression, returnType === "num" ? "number" : returnType === "bool" ? "boolean" : "string"),
    },
    inputs,
    mutations: [{ name: mutationName, mote: mtRef(signature, mutantExpression, returnType), typescript: tsRef(tsSignature, tsMutantExpression, returnType === "num" ? "number" : returnType === "bool" ? "boolean" : "string") }],
    phases, verifiedWorkUnits: 1,
    repository: { seed: `${id.toLowerCase()}-seed-2026-09-12`, commit: "fixture-reference-v1", dependencyLockfileHash: "fixture-lock-v1" },
    oracle: { module: "bench/corpus/oracles.mjs", cases: inputs.length, independent: true },
  });
}

export const FIXTURES = Object.freeze(specs.map(makeFixture));
export const FIXTURE_BY_ID = new Map(FIXTURES.map((fixture) => [fixture.id, fixture]));
