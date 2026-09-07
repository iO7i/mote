type Row={id:num,email:str,active:bool}

fn build(c:[str])->Row=
  {id:Number(c[0]),email:c[1],active:c[2]=="true"}

pub fn parseRow(c:[str])->Result<Row>=check<Row>(build(c))
