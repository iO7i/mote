type Limits59={value:num,enabled:bool}
pub fn normalize59(r:Limits59)->num=r.enabled?r.value:0
pub fn classify59(r:Limits59)->str=r.enabled?"active":"held"
