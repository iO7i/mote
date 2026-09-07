type Job={id:str,userId:str,amount:num,key:str}
type Outcome={status:str,jobId:str,detail:str}

fn retryable(code:str)->bool=code=="timeout"||code=="503"

fn classify(j:Job,code:str)->Outcome=
  {status:retryable(code)?"retry":"failed",jobId:j.id,detail:code}

fn settle(j:Job,r:any)->Outcome=
  r.ok?{status:"ok",jobId:j.id,detail:"charged"}:classify(j,r.error)

async fn attempt(j:Job,write:any)->Outcome=
  settle(j,await write(j))

async fn run(j:Job,store:any,write:any)->Outcome=
  store.seen(j.key)?{status:"duplicate",jobId:j.id,detail:"idempotent skip"}:attempt(j,write)

pub async fn process(raw:str,store:any,write:any)->Outcome=
  run(json<Job>(raw)?,store,write)
