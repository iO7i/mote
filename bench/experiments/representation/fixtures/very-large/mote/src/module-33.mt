type Settlement33={value:num,enabled:bool}
pub fn normalize33(r:Settlement33)->num=r.enabled?r.value:0
pub fn classify33(r:Settlement33)->str=r.enabled?"active":"held"
