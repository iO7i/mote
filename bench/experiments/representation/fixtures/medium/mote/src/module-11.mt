type Pricing11={value:num,enabled:bool}
pub fn normalize11(r:Pricing11)->num=r.enabled?r.value:0
pub fn classify11(r:Pricing11)->str=r.enabled?"active":"held"
