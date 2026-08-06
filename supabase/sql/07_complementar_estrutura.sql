alter table if exists public.custos add column if not exists competencia date;
alter table if exists public.vales_extravios add column if not exists pagamento_motoboy_id uuid references public.pagamentos_motoboys(id);
alter table if exists public.fechamentos add column if not exists lucro_bruto numeric(14,2) not null default 0;
alter table if exists public.fechamentos add column if not exists reaberto_por uuid references auth.users(id);
alter table if exists public.fechamentos add column if not exists reaberto_em timestamptz;
alter table if exists public.fechamentos add column if not exists motivo_reabertura text;

