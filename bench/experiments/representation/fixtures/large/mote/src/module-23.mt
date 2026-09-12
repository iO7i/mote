type Settlement23={value:num,enabled:bool}
pub fn normalize23(r:Settlement23)->num=r.enabled?r.value:0
pub fn classify23(r:Settlement23)->str=r.enabled?"active":"held"
