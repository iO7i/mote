type Reconciliation14={value:num,enabled:bool}
pub fn normalize14(r:Reconciliation14)->num=r.enabled?r.value:0
pub fn classify14(r:Reconciliation14)->str=r.enabled?"active":"held"
