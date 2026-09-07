Webhook verifier, order events.
`handle(raw)`: parse JSON, validate vs `Event` at runtime (untrusted input), return reply.
`total` = `subtotal + shipping - discount + tax`.
Invalid payload → error naming the failing JSON path.
Valid → `{ ok, orderId, amount, currency }`; `currency` defaults `"SAR"`.

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
