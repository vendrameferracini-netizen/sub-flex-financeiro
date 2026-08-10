-- Atualiza o cadastro existente da HPJ sem recriar a transportadora ou tocar em lançamentos.
update public.transportadoras
set tipo_pagamento='quinzenal', updated_at=now()
where upper(trim(nome))='HPJ'
  and tipo_pagamento<>'quinzenal';
