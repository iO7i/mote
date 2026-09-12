type Settlement03={value:num,enabled:bool}
pub fn normalize03(r:Settlement03)->num=r.enabled?r.value:0
pub fn classify03(r:Settlement03)->str=r.enabled?"active":"held"
