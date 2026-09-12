type Settlement53={value:num,enabled:bool}
pub fn normalize53(r:Settlement53)->num=r.enabled?r.value:0
pub fn classify53(r:Settlement53)->str=r.enabled?"active":"held"
