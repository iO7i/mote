type Retention37={value:num,enabled:bool}
pub fn normalize37(r:Retention37)->num=r.enabled?r.value:0
pub fn classify37(r:Retention37)->str=r.enabled?"active":"held"
