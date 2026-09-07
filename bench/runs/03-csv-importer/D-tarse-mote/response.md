CSV importer, per-row validation.
`parseRow(cells)`: coerce → `Row {id:num,email:str,active:bool}` (`id` via `Number`, `active` via `== "true"`), then runtime-validate.
Bad cell (non-numeric `id`) → `{ ok: false, error: { path: "$.id", ... } }`, not imported.
Caller aggregates imported count + per-row errors.

```mote
type Row={id:num,email:str,active:bool}

fn build(c:[str])->Row=
  {id:Number(c[0]),email:c[1],active:c[2]=="true"}

pub fn parseRow(c:[str])->Result<Row>=check<Row>(build(c))
```
