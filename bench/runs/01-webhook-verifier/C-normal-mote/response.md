Here is a webhook verifier for order events. The `handle` function parses the
raw JSON body, validates it against the expected `Event` shape at runtime —
webhook payloads are untrusted input, so we cannot trust the parsed object's
type. It then returns a structured reply. The `total` helper sums the money
fields: subtotal plus shipping, minus discount, plus tax. If the payload is
malformed (for example a non-numeric `subtotal`), validation fails with an error
that names the exact JSON path, so the caller can see precisely what went wrong.
Valid payloads produce an object with `ok`, `orderId`, `amount`, and `currency`,
defaulting `currency` to `SAR` when it is absent.

```mote
type Money={subtotal:num,shipping:num,discount:num,tax:num,currency:str?}
type Order={id:str,money:Money}
type Event={type:str,data:{order:Order}}

pub fn total(e:Event)->num=
  e.data.order.money.subtotal+
  e.data.order.money.shipping-
  e.data.order.money.discount+
  e.data.order.money.tax

fn reply(e:Event)->{ok:bool,orderId:str,amount:num,currency:str}=
  {
    ok:e.type=="order.created",
    orderId:e.data.order.id,
    amount:total(e),
    currency:e.data.order.money.currency??"SAR"
  }

pub fn handle(raw:str)->{ok:bool,orderId:str,amount:num,currency:str}=
  reply(json<Event>(raw)?)
```
