type Entry={amount:num,fee:num?,kind:str}

pub fn decode(raw:str)->Entry=json<Entry>(raw)?
pub fn net(e:Entry)->num=e.amount-(e.fee??0)
pub fn direction(e:Entry)->str=e.kind=="credit"?"in":"out"
