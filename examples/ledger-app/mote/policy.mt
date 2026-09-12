use "./domain" as domain

pub fn accept(e:{id:str,amount:num,fee:num?,kind:str})->bool=domain.valid(e)
pub fn acceptedNet(e:{id:str,amount:num,fee:num?,kind:str})->num=accept(e)?domain.signed(e):0
