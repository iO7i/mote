type Entry={id:str,amount:num,fee:num?,kind:str}

pub fn decode(raw:str)->Entry=json<Entry>(raw)?
pub fn net(e:Entry)->num=e.amount-(e.fee??0)
pub fn isCredit(e:Entry)->bool=e.kind=="credit"
pub fn signed(e:Entry)->num=isCredit(e)?net(e):-net(e)
pub fn valid(e:Entry)->bool=e.id!=""&&e.amount>=0&&(e.fee??0)>=0&&(e.kind=="credit"||e.kind=="debit")
