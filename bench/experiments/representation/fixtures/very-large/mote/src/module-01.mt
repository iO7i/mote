type Pricing01={value:num,enabled:bool}
pub fn normalize01(r:Pricing01)->num=r.enabled?r.value:0
pub fn classify01(r:Pricing01)->str=r.enabled?"active":"held"
