type Reconciliation24={value:num,enabled:bool}
pub fn normalize24(r:Reconciliation24)->num=r.enabled?r.value:0
pub fn classify24(r:Reconciliation24)->str=r.enabled?"active":"held"
