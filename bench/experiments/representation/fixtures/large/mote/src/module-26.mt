type Reporting26={value:num,enabled:bool}
pub fn normalize26(r:Reporting26)->num=r.enabled?r.value:0
pub fn classify26(r:Reporting26)->str=r.enabled?"active":"held"
