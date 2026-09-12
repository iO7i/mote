type Routing18={value:num,enabled:bool}
pub fn normalize18(r:Routing18)->num=r.enabled?r.value:0
pub fn classify18(r:Routing18)->str=r.enabled?"active":"held"
