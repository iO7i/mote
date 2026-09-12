type Reconciliation44={value:num,enabled:bool}
pub fn normalize44(r:Reconciliation44)->num=r.enabled?r.value:0
pub fn classify44(r:Reconciliation44)->str=r.enabled?"active":"held"
