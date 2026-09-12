type Risk52={value:num,enabled:bool}
pub fn normalize52(r:Risk52)->num=r.enabled?r.value:0
pub fn classify52(r:Risk52)->str=r.enabled?"active":"held"
