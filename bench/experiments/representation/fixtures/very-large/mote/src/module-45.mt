type Webhook45={value:num,enabled:bool}
pub fn normalize45(r:Webhook45)->num=r.enabled?r.value:0
pub fn classify45(r:Webhook45)->str=r.enabled?"active":"held"
