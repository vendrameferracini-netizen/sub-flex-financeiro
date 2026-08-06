insert into public.configuracoes(chave,valor) values('nome_empresa','Sub Flex'),('preferencias','{}') on conflict(chave) do nothing;
