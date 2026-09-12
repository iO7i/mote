type Risk12={value:num,enabled:bool}
pub fn normalize12(r:Risk12)->num=r.enabled?r.value:0
pub fn classify12(r:Risk12)->str=r.enabled?"active":"held"
