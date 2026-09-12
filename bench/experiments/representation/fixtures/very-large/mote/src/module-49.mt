type Limits49={value:num,enabled:bool}
pub fn normalize49(r:Limits49)->num=r.enabled?r.value:0
pub fn classify49(r:Limits49)->str=r.enabled?"active":"held"
