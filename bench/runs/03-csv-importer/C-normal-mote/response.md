This CSV importer validates each row as it is parsed. `parseRow` coerces the
three cells into a typed `Row` — `id` via `Number`, `active` via a `"true"`
check — and then runtime-validates the result. A row with a non-numeric `id` is
reported as an error with its JSON path (`$.id`) instead of being imported. The
caller iterates the rows and aggregates a report of imported counts and per-row
errors.

```mote
type Row={id:num,email:str,active:bool}

fn build(c:[str])->Row=
  {id:Number(c[0]),email:c[1],active:c[2]=="true"}

pub fn parseRow(c:[str])->Result<Row>=check<Row>(build(c))
```
