use "node:crypto" as crypto

type Money={
  subtotal:num,
  shipping:num,
  discount:num,
  tax:num,
  currency:str?
}

type Order={
  id:str,
  customer:{id:str,name:str},
  money:Money,
  source:str?
}

type Event={
  type:str,
  data:{order:Order}
}

fn sign(body:str,secret:str)->str=
  crypto.createHmac("sha256",secret).update(body).digest("hex")

pub fn valid(body:str,secret:str,sig:str)->bool=
  crypto.timingSafeEqual(Buffer.from(sign(body,secret)),Buffer.from(sig))

fn total(e:Event)->num=
  e.data.order.money.subtotal+
  e.data.order.money.shipping-
  e.data.order.money.discount+
  e.data.order.money.tax

fn reply(e:Event)={
  ok:e.type=="order.created",
  orderId:e.data.order.id,
  amount:total(e),
  currency:e.data.order.money.currency??"SAR"
}

let raw='{"type":"order.created","data":{"order":{"id":"o_1","customer":{"id":"c_7","name":"Sara"},"money":{"subtotal":129,"shipping":15,"discount":10,"tax":20,"currency":"SAR"}}}}'

let e=json<Event>(raw)?
console.log(reply(e))
