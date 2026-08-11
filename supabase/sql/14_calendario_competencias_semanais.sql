create table if not exists public.calendario_competencias_semanais (
  id uuid primary key default gen_random_uuid(),
  ano smallint not null,
  mes smallint not null check (mes between 1 and 12),
  numero_semana smallint not null check (numero_semana between 1 and 5),
  data_inicio date not null,
  data_fim date not null,
  quinzena smallint not null check (quinzena in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendario_semana_datas_validas check (data_fim >= data_inicio),
  constraint calendario_semana_competencia_unica unique (ano, mes, numero_semana)
);

create index if not exists idx_calendario_semanas_quinzena
  on public.calendario_competencias_semanais (ano, mes, quinzena);

alter table public.calendario_competencias_semanais enable row level security;

drop policy if exists "autenticados_leem" on public.calendario_competencias_semanais;
drop policy if exists "autenticados_inserem" on public.calendario_competencias_semanais;
drop policy if exists "autenticados_atualizam" on public.calendario_competencias_semanais;

create policy "autenticados_leem"
  on public.calendario_competencias_semanais
  for select to authenticated
  using (true);

create policy "autenticados_inserem"
  on public.calendario_competencias_semanais
  for insert to authenticated
  with check (auth.uid() is not null);

create policy "autenticados_atualizam"
  on public.calendario_competencias_semanais
  for update to authenticated
  using (true)
  with check (auth.uid() is not null);

drop trigger if exists trg_updated_at on public.calendario_competencias_semanais;
create trigger trg_updated_at
  before update on public.calendario_competencias_semanais
  for each row execute function public.set_updated_at();
