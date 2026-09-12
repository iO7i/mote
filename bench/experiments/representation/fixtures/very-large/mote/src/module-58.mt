type Routing58={value:num,enabled:bool}
pub fn normalize58(r:Routing58)->num=r.enabled?r.value:0
pub fn classify58(r:Routing58)->str=r.enabled?"active":"held"
