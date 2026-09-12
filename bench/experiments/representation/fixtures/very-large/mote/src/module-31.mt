type Pricing31={value:num,enabled:bool}
pub fn normalize31(r:Pricing31)->num=r.enabled?r.value:0
pub fn classify31(r:Pricing31)->str=r.enabled?"active":"held"
