type Pricing51={value:num,enabled:bool}
pub fn normalize51(r:Pricing51)->num=r.enabled?r.value:0
pub fn classify51(r:Pricing51)->str=r.enabled?"active":"held"
