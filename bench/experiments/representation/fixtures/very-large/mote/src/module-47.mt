type Retention47={value:num,enabled:bool}
pub fn normalize47(r:Retention47)->num=r.enabled?r.value:0
pub fn classify47(r:Retention47)->str=r.enabled?"active":"held"
