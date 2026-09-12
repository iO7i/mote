type Routing28={value:num,enabled:bool}
pub fn normalize28(r:Routing28)->num=r.enabled?r.value:0
pub fn classify28(r:Routing28)->str=r.enabled?"active":"held"
