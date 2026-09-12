type Webhook35={value:num,enabled:bool}
pub fn normalize35(r:Webhook35)->num=r.enabled?r.value:0
pub fn classify35(r:Webhook35)->str=r.enabled?"active":"held"
