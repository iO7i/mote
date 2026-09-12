type Webhook55={value:num,enabled:bool}
pub fn normalize55(r:Webhook55)->num=r.enabled?r.value:0
pub fn classify55(r:Webhook55)->str=r.enabled?"active":"held"
