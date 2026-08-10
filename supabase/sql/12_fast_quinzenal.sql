-- Garante a FAST como transportadora ativa quinzenal sem afetar os demais cadastros.
insert into public.transportadoras(nome,tipo_pagamento,ativo)
values ('FAST','quinzenal',true)
on conflict(nome) do update
set tipo_pagamento='quinzenal', ativo=true, updated_at=now();
