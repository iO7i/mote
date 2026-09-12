type Risk22={value:num,enabled:bool}
pub fn normalize22(r:Risk22)->num=r.enabled?r.value:0
pub fn classify22(r:Risk22)->str=r.enabled?"active":"held"
