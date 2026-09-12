type Identity30={value:num,enabled:bool}
pub fn normalize30(r:Identity30)->num=r.enabled?r.value:0
pub fn classify30(r:Identity30)->str=r.enabled?"active":"held"
