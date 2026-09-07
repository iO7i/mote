// Mote v0.1 lexer — source text -> token stream.
// Whitespace (including newlines) is insignificant; statement boundaries are
// resolved structurally by the parser, so both compact single-line and
// multiline-continuation styles lex the same way.

const KEYWORDS = new Set([
  "use", "as", "pub", "fn", "let", "mut",
  "type", "match", "case", "true", "false", "nil",
  "async", "await",
]);

const TWO_CHAR_OPS = ["==", "!=", "<=", ">=", "&&", "||", "??", "->"];
const SINGLE_CHAR_OPS = "(){}[],:;.?=<>+-*/%!|";

function isIdStart(c) { return /[A-Za-z_$]/.test(c); }
function isIdPart(c) { return /[A-Za-z0-9_$]/.test(c); }
function isDigit(c) { return c >= "0" && c <= "9"; }

export function lexError(msg, line, col, file) {
  const e = new Error(`${file}:${line}:${col}: lex error: ${msg}`);
  e.mote = { phase: "lex", line, col, file };
  return e;
}

export function lex(src, file = "<input>") {
  const tokens = [];
  let i = 0, line = 1, col = 1;
  const n = src.length;

  const push = (type, value, l, c) => tokens.push({ type, value, line: l, col: c });

  while (i < n) {
    const c = src[i];

    // whitespace
    if (c === " " || c === "\t" || c === "\r") { i++; col++; continue; }
    if (c === "\n") { i++; line++; col = 1; continue; }

    // line comment
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }

    const startLine = line, startCol = col;

    // string literal (single or double quoted) — content preserved verbatim
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let buf = quote;
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\") { buf += src[j] + (src[j + 1] ?? ""); j += 2; continue; }
        if (src[j] === "\n") line++;
        buf += src[j];
        j++;
      }
      if (j >= n) throw lexError("unterminated string", startLine, startCol, file);
      buf += quote;
      j++;
      col += j - i;
      i = j;
      push("str", buf, startLine, startCol);
      continue;
    }

    // number literal
    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (j < n && isDigit(src[j])) j++;
      if (src[j] === ".") { j++; while (j < n && isDigit(src[j])) j++; }
      if (src[j] === "e" || src[j] === "E") {
        j++;
        if (src[j] === "+" || src[j] === "-") j++;
        while (j < n && isDigit(src[j])) j++;
      }
      const raw = src.slice(i, j);
      col += j - i;
      i = j;
      push("num", raw, startLine, startCol);
      continue;
    }

    // identifier or keyword
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < n && isIdPart(src[j])) j++;
      const word = src.slice(i, j);
      col += j - i;
      i = j;
      push(KEYWORDS.has(word) ? word : "ident", word, startLine, startCol);
      continue;
    }

    // operators / punctuation
    const two = src.substr(i, 2);
    if (TWO_CHAR_OPS.includes(two)) {
      push("op", two, startLine, startCol);
      i += 2; col += 2;
      continue;
    }
    if (SINGLE_CHAR_OPS.includes(c)) {
      push("op", c, startLine, startCol);
      i++; col++;
      continue;
    }

    throw lexError(`unexpected character ${JSON.stringify(c)}`, startLine, startCol, file);
  }

  push("eof", null, line, col);
  return tokens;
}
