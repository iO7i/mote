export interface MoteDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  file: string;
  span: { line: number; column: number };
}

export interface DiagnosticEnvelope {
  schemaVersion: number;
  compiler: { name: string; version: string; diagnosticsVersion: number };
  ok: boolean;
  diagnostics: MoteDiagnostic[];
  file?: string;
  internal?: boolean;
}

export interface CheckResult {
  ok: boolean;
  diagnostics: MoteDiagnostic[];
  envelope: DiagnosticEnvelope;
}

export interface DiagnosticCollection {
  items: MoteDiagnostic[];
  errors: MoteDiagnostic[];
  hasErrors: boolean;
  format(): string;
}

export interface CompileResult {
  code: string;
  program: unknown | null;
  diagnostics: DiagnosticCollection;
  envelope: DiagnosticEnvelope;
  needsRuntime: boolean;
  typeDecls: unknown[];
  declarations(): string;
  sourceMap(generatedFile?: string): string;
  positionMap(): Array<{
    generated: { line: number; column: number };
    source: { line: number; column: number };
  }>;
}

export const COMPILER: Readonly<{
  name: string;
  version: string;
  diagnosticsVersion: number;
}>;

export function compileSource(source: string, options?: {
  file?: string;
  strict?: boolean;
  emitTypes?: boolean;
  runtimeImport?: string;
  resolveImport?: (module: string) => string | null;
}): CompileResult;

export function checkSource(source: string, options?: {
  file?: string;
  strict?: boolean;
}): CheckResult;

export function diagnosticEnvelope(diagnostics: {
  hasErrors: boolean;
  items: unknown[];
}, extra?: Record<string, unknown>): DiagnosticEnvelope;
