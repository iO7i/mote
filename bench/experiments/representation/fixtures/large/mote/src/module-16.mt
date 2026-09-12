type Reporting16={value:num,enabled:bool}
pub fn normalize16(r:Reporting16)->num=r.enabled?r.value:0
pub fn classify16(r:Reporting16)->str=r.enabled?"active":"held"
