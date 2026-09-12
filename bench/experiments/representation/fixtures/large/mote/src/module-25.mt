type Webhook25={value:num,enabled:bool}
pub fn normalize25(r:Webhook25)->num=r.enabled?r.value:0
pub fn classify25(r:Webhook25)->str=r.enabled?"active":"held"
