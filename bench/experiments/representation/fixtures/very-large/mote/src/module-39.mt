type Limits39={value:num,enabled:bool}
pub fn normalize39(r:Limits39)->num=r.enabled?r.value:0
pub fn classify39(r:Limits39)->str=r.enabled?"active":"held"
