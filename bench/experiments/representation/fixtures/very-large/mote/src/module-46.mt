type Reporting46={value:num,enabled:bool}
pub fn normalize46(r:Reporting46)->num=r.enabled?r.value:0
pub fn classify46(r:Reporting46)->str=r.enabled?"active":"held"
