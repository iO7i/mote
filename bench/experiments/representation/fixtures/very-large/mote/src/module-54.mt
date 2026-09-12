type Reconciliation54={value:num,enabled:bool}
pub fn normalize54(r:Reconciliation54)->num=r.enabled?r.value:0
pub fn classify54(r:Reconciliation54)->str=r.enabled?"active":"held"
