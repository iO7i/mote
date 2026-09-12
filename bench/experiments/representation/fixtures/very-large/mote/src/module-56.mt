type Reporting56={value:num,enabled:bool}
pub fn normalize56(r:Reporting56)->num=r.enabled?r.value:0
pub fn classify56(r:Reporting56)->str=r.enabled?"active":"held"
