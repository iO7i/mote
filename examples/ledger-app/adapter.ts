import { decode, direction, net, type Entry } from "./generated/core.js";

export function summarize(raw: string): { direction: string; net: number } {
  const entry: Entry = decode(raw);
  return { direction: direction(entry), net: net(entry) };
}
