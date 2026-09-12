type Risk32={value:num,enabled:bool}
pub fn normalize32(r:Risk32)->num=r.enabled?r.value:0
pub fn classify32(r:Risk32)->str=r.enabled?"active":"held"
