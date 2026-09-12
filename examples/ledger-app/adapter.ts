import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { decode as decodeLegacy, type Entry as LegacyEntry } from "./generated/core.js";
import { decode, type Entry } from "./generated/domain.js";
import { summarize as summarizeMote } from "./generated/summary.js";
import { accept, acceptedNet } from "./generated/policy.js";
import { defaultCurrency, maximumEntries } from "./generated/config.js";

export type LedgerRecord = Entry & { currency?: string };
export type ApiResponse = { status: 200 | 422; body: unknown };

export function summarize(raw: string): { direction: string; net: number } {
  const entry: LegacyEntry = decodeLegacy(raw);
  return { direction: entry.kind === "credit" ? "in" : "out", net: entry.amount - (entry.fee ?? 0) };
}

export function audit(raw: string): { accepted: boolean; signedNet: number; currency: string } {
  const entry: Entry = decode(raw);
  return { accepted: accept(entry), signedNet: acceptedNet(entry), currency: defaultCurrency() };
}

export function api(raw: string): ApiResponse {
  try {
    const entry: Entry = decode(raw);
    const result = summarizeMote(entry);
    return { status: 200, body: { net: result.net, direction: result.direction, ...audit(raw) } };
  } catch (error) {
    return { status: 422, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export function appendRecord(file: string, raw: string): number {
  const entry = decode(raw);
  if (!accept(entry)) throw new Error("invalid ledger entry");
  const records = readRecords(file);
  if (records.length >= maximumEntries()) throw new Error("ledger capacity exceeded");
  records.push({ ...entry, currency: defaultCurrency() });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(records, null, 2) + "\n");
  return records.length;
}

export function readRecords(file: string): LedgerRecord[] {
  if (!existsSync(file)) return [];
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(value)) throw new Error("ledger store must contain an array");
  return value.map((item) => decode(JSON.stringify(item)) as LedgerRecord);
}
