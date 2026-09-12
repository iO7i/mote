type Identity40={value:num,enabled:bool}
pub fn normalize40(r:Identity40)->num=r.enabled?r.value:0
pub fn classify40(r:Identity40)->str=r.enabled?"active":"held"
