create or replace function public.remover_motoboy_sem_historico(p_motoboy_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.pagamentos_motoboys where motoboy_id = p_motoboy_id)
     or exists (select 1 from public.vales_extravios where motoboy_id = p_motoboy_id) then
    return false;
  end if;

  delete from public.motoboys where id = p_motoboy_id;
  return found;
end;
$$;

revoke all on function public.remover_motoboy_sem_historico(uuid) from public;
grant execute on function public.remover_motoboy_sem_historico(uuid) to authenticated;
