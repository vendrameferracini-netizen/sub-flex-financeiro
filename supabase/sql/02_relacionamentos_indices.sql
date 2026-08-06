create unique index if not exists uq_recebimento_periodo on public.recebimentos_transportadoras(transportadora_id,tipo_periodo,numero_periodo,mes,ano);
create unique index if not exists uq_pagamento_periodo on public.pagamentos_motoboys(motoboy_id,tipo_periodo,numero_periodo,mes,ano);
create unique index if not exists uq_fechamento_periodo on public.fechamentos(tipo_periodo,numero_periodo,mes,ano);
create index if not exists idx_vales_motoboy_status on public.vales_extravios(motoboy_id,status,mes_desconto,ano_desconto);
create index if not exists idx_custos_periodo on public.custos(ano,mes,status);
create index if not exists idx_repasses_fechamento on public.repasses_socios(fechamento_id,status);
alter table public.fechamentos drop constraint if exists percentuais_total_100;
alter table public.fechamentos add constraint percentuais_total_100 check(round(percentual_caio+percentual_jose,2)=100.00);
alter table public.repasses_socios drop constraint if exists socios_repasses_diferentes;
alter table public.repasses_socios add constraint socios_repasses_diferentes check(socio_pagador_id<>socio_recebedor_id);

