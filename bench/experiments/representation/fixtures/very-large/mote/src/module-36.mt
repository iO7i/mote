type Reporting36={value:num,enabled:bool}
pub fn normalize36(r:Reporting36)->num=r.enabled?r.value:0
pub fn classify36(r:Reporting36)->str=r.enabled?"active":"held"
