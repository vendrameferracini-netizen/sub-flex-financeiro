-- Execute somente se houver uma versão anterior do banco. Operações idempotentes.
alter table if exists public.recebimentos_transportadoras add column if not exists created_by uuid references auth.users(id);
alter table if exists public.pagamentos_motoboys add column if not exists created_by uuid references auth.users(id);
alter table if exists public.custos add column if not exists created_by uuid references auth.users(id);
alter table if exists public.vales_extravios add column if not exists created_by uuid references auth.users(id);
alter table if exists public.repasses_socios add column if not exists created_by uuid references auth.users(id);
update public.recebimentos_transportadoras set valor=round(valor,2) where valor is not null;
update public.pagamentos_motoboys set valor_bruto=round(valor_bruto,2) where valor_bruto is not null;
