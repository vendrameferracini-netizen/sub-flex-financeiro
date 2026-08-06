-- Mantém leitura e escrita restritas a usuários autenticados. DELETE continua sem política.
drop policy if exists "autenticados_cancelam_repasses" on public.repasses_socios;
create policy "autenticados_cancelam_repasses" on public.repasses_socios for update to authenticated using(auth.uid() is not null) with check(auth.uid() is not null);

