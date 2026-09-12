type Identity50={value:num,enabled:bool}
pub fn normalize50(r:Identity50)->num=r.enabled?r.value:0
pub fn classify50(r:Identity50)->str=r.enabled?"active":"held"
