type Identity00={value:num,enabled:bool}
pub fn normalize00(r:Identity00)->num=r.enabled?r.value:0
pub fn classify00(r:Identity00)->str=r.enabled?"active":"held"
