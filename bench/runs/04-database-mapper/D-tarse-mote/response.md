DB mapper + pagination.
`load(raw)`: validate row vs `Row {id:num,name:str,deleted_at:str|nil}`, map to `User`; `active = deleted_at == nil`.
Bad `id` / null `name` → error with JSON path.
`page(total,size,n)` → `{ page: n, pages: ceil(total/size), offset: n*size }`.

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
