type Limits09={value:num,enabled:bool}
pub fn normalize09(r:Limits09)->num=r.enabled?r.value:0
pub fn classify09(r:Limits09)->str=r.enabled?"active":"held"
