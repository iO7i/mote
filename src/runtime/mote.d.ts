export interface ValidationErrorDetail {
  path: string;
  expected: string;
  got: string;
}

export interface ValidationResult<T = unknown> {
  ok: true;
  value: T;
  error?: undefined;
}

export interface ValidationFailure {
  ok: false;
  error: ValidationErrorDetail;
  value?: undefined;
}

export type Result<T> = ValidationResult<T> | ValidationFailure;
export type Schema = Record<string, unknown>;
export type Registry = Record<string, Schema>;

export class MoteValidationError extends Error {
  readonly detail: ValidationErrorDetail;
  constructor(detail: ValidationErrorDetail);
}

export function validate<T = unknown>(value: unknown, schema: Schema, registry?: Registry, path?: string): Result<T>;
export function json<T = unknown>(raw: string, registry: Registry, typeName: string): Result<T>;
export function env<T = unknown>(name: string, registry: Registry, typeName: string): Result<T>;
export function check<T = unknown>(value: unknown, registry: Registry, typeName: string): Result<T>;
export function unwrap<T>(result: Result<T>): T;
