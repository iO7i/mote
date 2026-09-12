type Settlement43={value:num,enabled:bool}
pub fn normalize43(r:Settlement43)->num=r.enabled?r.value:0
pub fn classify43(r:Settlement43)->str=r.enabled?"active":"held"
