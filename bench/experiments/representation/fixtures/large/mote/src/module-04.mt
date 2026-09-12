type Reconciliation04={value:num,enabled:bool}
pub fn normalize04(r:Reconciliation04)->num=r.enabled?r.value:0
pub fn classify04(r:Reconciliation04)->str=r.enabled?"active":"held"
