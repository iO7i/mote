// Bridge from Mote Types to (a) emitted TypeScript type strings and
// (b) runtime schema literals consumed by src/runtime/mote.

const TS_PRIM = {
  str: "string", num: "number", bool: "boolean",
  nil: "null", unknown: "unknown", any: "any", never: "never",
};

// --- TypeScript type text -------------------------------------------------

export function tsType(type) {
  switch (type.t) {
    case "str": case "num": case "bool": case "nil":
    case "unknown": case "any": case "never":
      return TS_PRIM[type.t];
    case "named":
      return type.args?.length ? `${type.name}<${type.args.map(tsType).join(", ")}>` : type.name;
    case "var":
      return type.name;
    case "opt":
      return `${wrapUnionMember(type.inner)} | undefined`;
    case "union":
      return type.options.map(wrapUnionMember).join(" | ");
    case "array":
      return `${wrapArrayElement(type.element)}[]`;
    case "result":
      return `$mote.Result<${tsType(type.inner)}>`;
    case "object":
      return tsObject(type);
    case "fn":
      return `(${type.params.map((p, i) => `a${i}: ${tsType(p.type)}`).join(", ")}) => ${tsType(type.ret)}`;
    default:
      throw new Error(`cannot render TS type '${type.t}'`);
  }
}

function tsObject(type) {
  if (!type.fields.length) return "{}";
  const parts = type.fields.map((f) =>
    `${tsProperty(f.name)}${f.optional ? "?" : ""}: ${tsType(f.type)}`);
  return `{ ${parts.join("; ")} }`;
}

export function tsProperty(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function wrapUnionMember(type) {
  if (type.t === "union" || type.t === "fn") return `(${tsType(type)})`;
  return tsType(type);
}

function wrapArrayElement(type) {
  if (type.t === "union" || type.t === "opt" || type.t === "fn") return `(${tsType(type)})`;
  return tsType(type);
}

// --- runtime schema literal ----------------------------------------------

export function schemaLiteral(type) {
  switch (type.t) {
    case "str": case "num": case "bool": case "nil":
    case "unknown": case "any":
      return `{ k: "${type.t}" }`;
    case "never":
      return `{ k: "union", options: [] }`;
    case "named":
      return `{ k: "ref", name: ${JSON.stringify(type.name)} }`;
    case "var":
      throw new Error("generic type variables cannot be erased into runtime schemas");
    case "opt":
      return `{ k: "opt", inner: ${schemaLiteral(type.inner)} }`;
    case "union":
      return `{ k: "union", options: [${type.options.map(schemaLiteral).join(", ")}] }`;
    case "array":
      return `{ k: "array", element: ${schemaLiteral(type.element)} }`;
    case "object": {
      const fields = type.fields.map((f) =>
        `{ name: ${JSON.stringify(f.name)}, optional: ${!!f.optional}, schema: ${schemaLiteral(f.type)} }`);
      return `{ k: "object", fields: [${fields.join(", ")}] }`;
    }
    case "result":
      return schemaLiteral(type.inner);
    default:
      throw new Error(`cannot render schema for '${type.t}'`);
  }
}
