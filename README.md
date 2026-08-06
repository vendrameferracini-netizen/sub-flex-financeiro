# Sub Flex Financeiro

Sistema financeiro responsivo construído com Next.js 16, React 19, Vinext e Supabase. A autenticação usa e-mail e senha do Supabase Auth. As planilhas de transportadoras e motoboys carregam dados por período e usam `upsert` para atualizar registros sem duplicidade.

## Instalação local

1. Instale Node.js 22 ou superior e pnpm.
2. Execute `pnpm install`.
3. Copie `.env.example` para `.env.local`.
4. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Execute `pnpm dev`.
6. Valide a produção com `pnpm build`.

Nunca use `service_role` no front-end. `.env` e `.env.local` são ignorados pelo Git.

## Banco Supabase

No SQL Editor, execute os arquivos de `supabase/sql` nesta ordem:

1. `01_estrutura_principal.sql`
2. `02_relacionamentos_indices.sql`
3. `03_seguranca_rls.sql`
4. `04_cadastros_iniciais.sql`
5. `05_funcoes_calculos.sql`
6. `06_migracao_compatibilidade.sql` somente para compatibilizar um banco anterior

Os scripts são idempotentes onde aplicável. As restrições únicas de recebimentos e pagamentos permitem salvar por `upsert` sem criar duplicidades.

## Primeiro usuário

1. No Supabase, abra Authentication → Users.
2. Clique em Add user → Create new user.
3. Informe e-mail e senha, deixando o e-mail confirmado.
4. Use essas credenciais na tela de login do Sub Flex.

## Vercel

1. Envie este projeto para um repositório privado no GitHub.
2. Na Vercel, clique em Add New → Project e importe o repositório.
3. Cadastre as duas variáveis do `.env.example` em Production, Preview e Development.
4. Use `pnpm build` como Build Command.
5. Publique novamente sempre que alterar as variáveis.

## Teste de persistência

1. Entre no sistema.
2. Abra Recebimentos, preencha uma transportadora e clique em Salvar todos.
3. Atualize a página e confirme o mesmo valor.
4. Saia e entre novamente.
5. Repita em outro navegador.
6. Edite o valor e confirme no Table Editor do Supabase que existe apenas uma linha para o mesmo cadastro e período.
7. Repita o teste em Motoboys; depois valide custos, vales, extravios, fechamentos e repasses à medida que esses módulos forem conectados.
