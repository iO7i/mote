type Routing48={value:num,enabled:bool}
pub fn normalize48(r:Routing48)->num=r.enabled?r.value:0
pub fn classify48(r:Routing48)->str=r.enabled?"active":"held"
