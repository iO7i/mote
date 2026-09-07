// Mote diagnostic codes, collector, and `explain` table.
// Every diagnostic carries a stable code (Mxxx) and a source location.

export const CODES = {
  M001: {
    title: "Syntax error",
    explain: "The source could not be parsed. Check the token noted in the message.",
  },
  M101: {
    title: "Unknown identifier",
    explain: "A name was used that is not declared in any enclosing scope.\n" +
      "hint: check spelling, or declare it with 'let' / 'fn' / 'use ... as'.",
  },
  M102: {
    title: "Duplicate declaration",
    explain: "A name was declared twice in the same scope.\n" +
      "hint: rename one of the declarations.",
  },
  M110: {
    title: "Unknown named type",
    explain: "A type reference points to a 'type' that was never declared.\n" +
      "hint: declare it with 'type Name = ...' or fix the name.",
  },
  M201: {
    title: "Nullable access without handling",
    explain: "A member was accessed on an optional ('T?') value.\n" +
      "hint: use '??', a conditional 'cond?yes:no', or a match before member access.",
  },
  M202: {
    title: "Invalid member access",
    explain: "A member was accessed on a value that is not an object, or the\n" +
      "property does not exist on the value's type.",
  },
  M203: {
    title: "Missing object property",
    explain: "An object literal is missing a property required by the expected type.",
  },
  M301: {
    title: "Wrong argument count",
    explain: "A function was called with the wrong number of arguments.",
  },
  M302: {
    title: "Wrong argument type",
    explain: "An argument's type is not assignable to the parameter's type.",
  },
  M310: {
    title: "Invalid generic use",
    explain: "A generic function or builtin was used with the wrong number or\n" +
      "kind of type arguments (e.g. json<T> requires one named type).",
  },
  M401: {
    title: "Invalid return type",
    explain: "A function body's type is not assignable to its declared return type.",
  },
  M402: {
    title: "Invalid union assignment",
    explain: "A value is not assignable to any member of the target union type.",
  },
  M410: {
    title: "Arithmetic on non-number",
    explain: "An arithmetic operator ('+ - * / %') was applied to a non-'num' value.",
  },
  M420: {
    title: "Missing annotation on public API",
    explain: "In strict mode, exported ('pub') functions must annotate every\n" +
      "parameter and the return type so a stable '.d.ts' can be emitted.",
  },
  M501: {
    title: "Invalid unwrap / validation use",
    explain: "The '?' unwrap operator was applied to a non-Result value, or\n" +
      "json<T>()/env<T>() was used without a named type argument.",
  },
  M901: {
    title: "Runtime schema validation failure",
    explain: "At runtime, external data failed validation against its Mote type.\n" +
      "The message includes a JSON path such as '$.data.order.money.subtotal'.",
  },
};

export class Diagnostics {
  constructor(file = "<input>") {
    this.file = file;
    this.items = [];
  }

  error(code, message, node) {
    this.items.push({ severity: "error", code, message, ...loc(node), file: this.file });
  }

  warn(code, message, node) {
    this.items.push({ severity: "warning", code, message, ...loc(node), file: this.file });
  }

  get errors() { return this.items.filter((d) => d.severity === "error"); }
  get hasErrors() { return this.errors.length > 0; }

  format() {
    return this.items.map((d) => formatOne(d, this.file)).join("\n");
  }
}

function loc(node) {
  if (node && typeof node.line === "number") return { line: node.line, col: node.col };
  return { line: 0, col: 0 };
}

function formatOne(d, file) {
  const where = d.line ? `${file}:${d.line}:${d.col}` : file;
  const sev = d.severity === "error" ? "error" : "warning";
  return `${where}: ${sev} ${d.code}: ${d.message}`;
}

export function explain(code) {
  const c = CODES[code];
  if (!c) return `unknown diagnostic code: ${code}`;
  return `${code}: ${c.title}\n\n${c.explain}`;
}
