type Webhook05={value:num,enabled:bool}
pub fn normalize05(r:Webhook05)->num=r.enabled?r.value:0
pub fn classify05(r:Webhook05)->str=r.enabled?"active":"held"
