type Risk02={value:num,enabled:bool}
pub fn normalize02(r:Risk02)->num=r.enabled?r.value:0
pub fn classify02(r:Risk02)->str=r.enabled?"active":"held"
