create unique index if not exists uq_desconto_em_pagamento on public.vales_extravios(id,pagamento_motoboy_id) where pagamento_motoboy_id is not null;
create index if not exists idx_recebimentos_socio on public.recebimentos_transportadoras(recebido_por_socio_id,ano,mes,status);
create index if not exists idx_pagamentos_socio on public.pagamentos_motoboys(pago_por_socio_id,ano,mes,status);
create index if not exists idx_custos_socio on public.custos(pago_por_socio_id,ano,mes,status);

