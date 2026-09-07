This API route handler authenticates the caller before touching the request
body. `handle` first checks the bearer token against the shared secret; if it
does not match it returns a `401` response and never parses the body. On a valid
token it parses and runtime-validates the body against `Req` — untrusted input,
so we cannot trust the parsed object's type — then returns a `200` response with
the charged amount and an optional note that defaults to an empty string. A
malformed body (for example a non-numeric `amount`) fails with an error naming
the exact JSON path.

```mote
type Req={userId:str,amount:num,note:str?}
type Res={status:num,userId:str,charged:num,note:str}

fn authed(token:str,secret:str)->bool=token==secret

fn denied()->Res={status:401,userId:"",charged:0,note:"unauthorized"}

fn respond(r:Req)->Res=
  {status:200,userId:r.userId,charged:r.amount,note:r.note??""}

pub fn handle(token:str,secret:str,raw:str)->Res=
  authed(token,secret)?respond(json<Req>(raw)?):denied()
```
