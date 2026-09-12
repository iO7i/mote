use "./domain" as domain
use "./policy" as policy

pub fn summarize(e:{id:str,amount:num,fee:num?,kind:str})->{net:num,direction:str,accepted:bool}={
  net:domain.net(e),
  direction:domain.isCredit(e)?"in":"out",
  accepted:policy.accept(e),
}
