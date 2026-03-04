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
2. **Vincular o perfil** de duas formas:
   - **Opção A:** Copiar o SQL exibido no modal, colar no SQL Editor do Supabase (substituir `COLE_O_UID_AQUI` pelo User UID) e executar.
   - **Opção B:** Colar o User UID no campo do modal e clicar em **Vincular agora** (é necessário ter rodado o `supabase-schema.sql`, que inclui a função `vincular_perfil_ao_cliente`).

## Estrutura

```
/login          → Autenticação
/dashboard      → Admin: lista de clientes
/client/:id     → Pastas/páginas/seções do cliente
/section/:id    → Visualizador com slider + chat + notas
```

## Funcionalidades

- **Slider Antes/Depois** — arraste a linha central para comparar os textos
- **Chat em tempo real** — conversa geral e comentários por seção (via Supabase Realtime)
- **Menções com @** — no chat e nos comentários, digite `@` para marcar outro usuário do mesmo cliente; as menções são salvas para notificações
- **E-mail diário de menções** — opcional: uma Edge Function pode enviar um resumo por e-mail (até 1 por dia) para quem foi marcado; ver [docs/email-mentions.md](docs/email-mentions.md)
- **Aprovação por seção** — o cliente pode aprovar (verde), aprovar com observações (amarelo) ou reprovar (vermelho) cada seção
- **Notas de otimização** — editor rico (TipTap) para registrar o que foi feito
- **Multi-cliente** — cada cliente acessa apenas seus próprios conteúdos
- **Papéis admin/cliente** — admin cria e edita; cliente visualiza, comenta e aprova
