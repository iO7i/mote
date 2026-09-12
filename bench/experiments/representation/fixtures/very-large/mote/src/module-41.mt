type Pricing41={value:num,enabled:bool}
pub fn normalize41(r:Pricing41)->num=r.enabled?r.value:0
pub fn classify41(r:Pricing41)->str=r.enabled?"active":"held"
