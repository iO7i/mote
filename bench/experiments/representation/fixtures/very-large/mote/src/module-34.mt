type Reconciliation34={value:num,enabled:bool}
pub fn normalize34(r:Reconciliation34)->num=r.enabled?r.value:0
pub fn classify34(r:Reconciliation34)->str=r.enabled?"active":"held"
