type Limits19={value:num,enabled:bool}
pub fn normalize19(r:Limits19)->num=r.enabled?r.value:0
pub fn classify19(r:Limits19)->str=r.enabled?"active":"held"
