# Leitor Bef/Aft

Plataforma web para comparar textos otimizados com slider antes/depois, chat em tempo real e notas de copywriting.

## Setup

### 1. Configurar Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute o conteúdo do arquivo `supabase-schema.sql`
3. Se o banco já existia antes (aprovação e menções @), execute também o bloco de migração comentado no final do `supabase-schema.sql` (ALTER TABLE para `approval_status`, `mention_ids`, etc.)
4. Copie a **Project URL** e a **anon key** em **Settings > API**

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

### 3. Instalar e rodar

```bash
npm install
npm run dev
```

### 4. Criar o primeiro usuário admin

1. No Supabase Dashboard, vá em **Authentication > Users** e crie um usuário
2. No **SQL Editor**, execute:
   ```sql
   UPDATE profiles SET role = 'admin', full_name = 'Seu Nome' WHERE id = 'SEU_USER_ID';
   ```

### 5. Conceder acesso a um cliente

No dashboard admin, em cada cliente há o botão **Conceder acesso** (ícone de usuário com +). Ao clicar:

1. **Criar o usuário** no Supabase (Authentication > Users) e copiar o **User UID**.
2. (Opcional) Informar o **Nome de exibição** — é o nome que aparece no chat e nas menções (@). Se não preencher, usa o nome do cliente.
3. **Vincular o perfil** de duas formas:
   - **Opção A:** Copiar o SQL exibido no modal, colar no SQL Editor do Supabase (substituir `COLE_O_UID_AQUI` pelo User UID e, se quiser, o nome entre aspas por outro) e executar.
   - **Opção B:** Colar o User UID no campo do modal e clicar em **Vincular agora** (é necessário ter rodado o `supabase-schema.sql`, que inclui a função `vincular_perfil_ao_cliente`).

### Quando o usuário aparece em `profiles`

- **Vincular agora (modal):** a função RPC cria ou atualiza a linha em `profiles` na hora. O usuário já aparece na tabela mesmo antes do primeiro login.
- **SQL (Opção A):** o snippet usa `INSERT ... ON CONFLICT`, então também cria a linha se não existir. Basta substituir `COLE_O_UID_AQUI` pelo User UID e executar — não é preciso o usuário ter logado antes.

Se o usuário for criado só no Auth e ninguém vincular (nem RPC nem SQL), a linha em `profiles` só é criada no **primeiro login** (o app cria com role `client` e sem `client_id` até alguém vincular).

### Nome de exibição (para @ no chat)

O **nome de exibição** vem da coluna `full_name` da tabela `profiles`. Ele é usado nas menções (@) no chat e na sidebar.

- **Quando é definido:** ao fazer o primeiro login (usa nome do Auth ou e-mail); ou quando o admin vincula o perfil ao cliente (nome do cliente ou o campo "Nome de exibição" no modal).
- **Editar manualmente:** no Supabase, vá em **Table Editor → profiles**, localize a linha do usuário (coluna `id` = User UID) e altere a coluna `full_name`. Ou no **SQL Editor**:
  ```sql
  UPDATE profiles SET full_name = 'Nome que aparece no chat' WHERE id = 'UUID_DO_USUARIO';
  ```

## Estrutura

```
/login          → Autenticação
/dashboard      → Admin: lista de clientes
/client/:id     → Pastas/páginas/seções do cliente
/section/:id    → Visualizador com slider + chat + notas
```

## Deploy e domínio

- **Vercel:** o projeto usa `vercel.json` com rewrites para SPA (evita 404 ao dar F5). Configure as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel da Vercel.
- **Domínio próprio (ex.: leitor.scripty.com.br):** no projeto Vercel, vá em **Settings → Domains**, adicione `leitor.scripty.com.br`. A Vercel mostra o que configurar no DNS (geralmente um CNAME `leitor` apontando para `cname.vercel-dns.com`). No provedor do domínio (onde está scripty.com.br), crie um registro CNAME com nome `leitor` e valor indicado pela Vercel.
- **Não indexar:** a aplicação já envia `<meta name="robots" content="noindex, nofollow">` no `index.html`, então mecanismos de busca não devem indexar nem seguir links da página. Uso interno / ferramenta privada.

## Funcionalidades

- **Slider Antes/Depois** — arraste a linha central para comparar os textos
- **Chat em tempo real** — conversa geral e comentários por seção (via Supabase Realtime)
- **Menções com @** — no chat e nos comentários, digite `@` para marcar outro usuário do mesmo cliente; as menções são salvas para notificações
- **E-mail diário de menções** — opcional: uma Edge Function pode enviar um resumo por e-mail (até 1 por dia) para quem foi marcado; ver [docs/email-mentions.md](docs/email-mentions.md)
- **Aprovação por seção** — o cliente pode aprovar (verde), aprovar com observações (amarelo) ou reprovar (vermelho) cada seção
- **Notas de otimização** — editor rico (TipTap) para registrar o que foi feito
- **Importar Markdown (.md)** — na edição de uma seção (Texto Antes / Depois), use **Importar .md** para colar conteúdo ou selecionar um arquivo; opção de converter Markdown para HTML para exibir títulos, listas e negrito no slider
- **Multi-cliente** — cada cliente acessa apenas seus próprios conteúdos
- **Papéis admin/cliente** — admin cria e edita; cliente visualiza, comenta e aprova
