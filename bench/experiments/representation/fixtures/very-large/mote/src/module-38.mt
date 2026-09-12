type Routing38={value:num,enabled:bool}
pub fn normalize38(r:Routing38)->num=r.enabled?r.value:0
pub fn classify38(r:Routing38)->str=r.enabled?"active":"held"
