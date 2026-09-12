type Retention07={value:num,enabled:bool}
pub fn normalize07(r:Retention07)->num=r.enabled?r.value:0
pub fn classify07(r:Retention07)->str=r.enabled?"active":"held"
