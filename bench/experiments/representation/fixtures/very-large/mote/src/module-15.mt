type Webhook15={value:num,enabled:bool}
pub fn normalize15(r:Webhook15)->num=r.enabled?r.value:0
pub fn classify15(r:Webhook15)->str=r.enabled?"active":"held"
