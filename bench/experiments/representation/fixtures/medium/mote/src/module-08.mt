type Routing08={value:num,enabled:bool}
pub fn normalize08(r:Routing08)->num=r.enabled?r.value:0
pub fn classify08(r:Routing08)->str=r.enabled?"active":"held"
