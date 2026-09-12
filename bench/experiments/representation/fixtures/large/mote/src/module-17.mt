type Retention17={value:num,enabled:bool}
pub fn normalize17(r:Retention17)->num=r.enabled?r.value:0
pub fn classify17(r:Retention17)->str=r.enabled?"active":"held"
