type Pricing21={value:num,enabled:bool}
pub fn normalize21(r:Pricing21)->num=r.enabled?r.value:0
pub fn classify21(r:Pricing21)->str=r.enabled?"active":"held"
