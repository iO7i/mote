type Settlement13={value:num,enabled:bool}
pub fn normalize13(r:Settlement13)->num=r.enabled?r.value:0
pub fn classify13(r:Settlement13)->str=r.enabled?"active":"held"
