type Identity20={value:num,enabled:bool}
pub fn normalize20(r:Identity20)->num=r.enabled?r.value:0
pub fn classify20(r:Identity20)->str=r.enabled?"active":"held"
