type Identity10={value:num,enabled:bool}
pub fn normalize10(r:Identity10)->num=r.enabled?r.value:0
pub fn classify10(r:Identity10)->str=r.enabled?"active":"held"
