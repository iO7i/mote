# Controlled experiment surfaces

These directories define reproducible experimental inputs; they are not model
results. Every experiment records its corpus/source hashes, visible context,
target edit surface, semantic-case count, budgets, and exclusion rules.

- `representation/` contains paired Mote/TypeScript repositories at four
  context scales with cross-module maintenance tasks.
- `context-pressure.json` defines the pre-registered budget frontier.
- `familiarity.json` defines cold, warm, few-shot, and TypeScript-control
  conditions and the required break-even analysis.
- `ablations.mjs` materializes sound source/prompt variants and marks
  type-light cases as not applicable when removing annotations would change the
  type boundary.

No agent or provider is invoked by these local design/measurement commands.
