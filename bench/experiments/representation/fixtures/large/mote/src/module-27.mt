type Retention27={value:num,enabled:bool}
pub fn normalize27(r:Retention27)->num=r.enabled?r.value:0
pub fn classify27(r:Retention27)->str=r.enabled?"active":"held"
