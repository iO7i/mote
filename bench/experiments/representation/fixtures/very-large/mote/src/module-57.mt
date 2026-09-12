type Retention57={value:num,enabled:bool}
pub fn normalize57(r:Retention57)->num=r.enabled?r.value:0
pub fn classify57(r:Retention57)->str=r.enabled?"active":"held"
