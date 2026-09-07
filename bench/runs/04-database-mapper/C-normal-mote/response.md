This maps a validated database row to a domain `User` and handles pagination.
`load` parses and runtime-validates the row against `Row` (nullable
`deleted_at`), then `mapUser` sets `active` when `deleted_at` is null. Invalid
rows — a non-numeric `id` or a null `name` — fail with the exact JSON path.
`page` computes `pages` and `offset` from the total, page size, and page number.

```mote
type Row={id:num,name:str,deleted_at:str|nil}
type User={id:num,name:str,active:bool}
type Page={page:num,pages:num,offset:num}

pub fn mapUser(r:Row)->User=
  {id:r.id,name:r.name,active:r.deleted_at==nil}

pub fn page(total:num,size:num,n:num)->Page=
  {page:n,pages:Math.ceil(total/size),offset:n*size}

pub fn load(raw:str)->User=mapUser(json<Row>(raw)?)
```
