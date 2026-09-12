type Limits29={value:num,enabled:bool}
pub fn normalize29(r:Limits29)->num=r.enabled?r.value:0
pub fn classify29(r:Limits29)->str=r.enabled?"active":"held"
