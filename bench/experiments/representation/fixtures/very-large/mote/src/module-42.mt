type Risk42={value:num,enabled:bool}
pub fn normalize42(r:Risk42)->num=r.enabled?r.value:0
pub fn classify42(r:Risk42)->str=r.enabled?"active":"held"
