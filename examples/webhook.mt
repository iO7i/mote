use "node:crypto" as crypto

fn parse(raw)=JSON.parse(raw)
fn sign(body,secret)=crypto.createHmac("sha256",secret).update(body).digest("hex")
pub fn valid(body,secret,sig)=crypto.timingSafeEqual(sign(body,secret),sig)

fn item(e)=e.data.order
fn money(e)=item(e).money
fn total(e)=money(e).subtotal+money(e).shipping-money(e).discount+money(e).tax
fn currency(e)=money(e).currency?money(e).currency:"SAR"
fn source(e)=item(e).source?item(e).source:"direct"
fn status(e)=e.type=="order.created"?"accepted":"ignored"
fn report(e)={event:e.type,status:status(e),orderId:item(e).id,customer:{id:item(e).customer.id,name:item(e).customer.name},amount:total(e),currency:currency(e),source:source(e)}
fn reply(e)={ok:e.type=="order.created",result:report(e)}

let raw='{"type":"order.created","data":{"order":{"id":"o_1","customer":{"id":"c_7","name":"Sara"},"money":{"subtotal":129,"shipping":15,"discount":10,"tax":20,"currency":"SAR"},"source":"instagram"}}}'
let secret="demo_secret"
let sig=sign(raw,secret)
let e=parse(raw)
console.log(valid(raw,secret,sig)?reply(e):{ok:false,error:"bad signature"})
