type Reporting06={value:num,enabled:bool}
pub fn normalize06(r:Reporting06)->num=r.enabled?r.value:0
pub fn classify06(r:Reporting06)->str=r.enabled?"active":"held"
