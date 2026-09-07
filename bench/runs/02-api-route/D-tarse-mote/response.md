API route: auth before validation.
`handle(token, secret, raw)`: reject unless `token == secret` → `401`, body unparsed.
Authed → parse + runtime-validate body vs `Req` (untrusted), return `200` `{ status, userId, charged, note }`.
Bad body → error with JSON path (`$.amount expected num, got str`). Absent `note` → `""`.

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
