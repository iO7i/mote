# Representation-stress repositories

`generate.mjs` creates four paired repositories for each language: small,
medium, large, and very-large. They contain the same domain graph and
maintenance task contracts, with the target module and relevant-context map
declared separately from distractor modules. The generator is deterministic and
does not run an agent.

The experiment measures effective semantic density rather than raw source
length alone: relevant source tokens, total visible tokens, target edit surface,
semantic cases, compiler-feedback opportunities, generated output, and adapter
overhead are retained as separate fields.

Run:

```sh
node bench/experiments/representation/generate.mjs
node bench/experiments/representation/measure.mjs
```

The resulting measurement is `DESIGN_MEASUREMENT`, not a capability result.
