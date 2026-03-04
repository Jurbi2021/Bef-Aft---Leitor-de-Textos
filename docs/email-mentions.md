# E-mail diário de menções (@)

Quando alguém é marcado com **@** no chat ou nos comentários da seção, você pode enviar **um e-mail por dia** resumindo as menções (em vez de um e-mail por mensagem).

## Visão geral

1. **Supabase Edge Function** lê mensagens/comentários com `mention_ids` do dia e agrupa por usuário mencionado.
2. Um **cron externo** (ex.: uma vez por dia) chama a URL da função.
3. A função usa **Resend** (ou SendGrid etc.) para enviar um e-mail por usuário com o resumo.

## 1. Criar a Edge Function no Supabase

No seu projeto Supabase, crie uma função (Dashboard → Edge Functions ou via CLI):

**Nome:** `send-mention-notifications`

**Código (Deno):**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://seu-app.vercel.app"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } })
  const auth = req.headers.get("Authorization")
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  const today = new Date().toISOString().slice(0, 10)
  const { data: chatRows } = await supabase.from("chat_messages").select("id, body, sender_id, created_at, mention_ids").gte("created_at", `${today}T00:00:00Z`)
  const { data: commentRows } = await supabase.from("section_comments").select("id, body, sender_id, created_at, mention_ids").gte("created_at", `${today}T00:00:00Z`)

  const byUser: Record<string, { email: string; items: string[] }> = {}
  for (const row of [...(chatRows ?? []), ...(commentRows ?? [])]) {
    const ids = (row.mention_ids as string[]) ?? []
    for (const uid of ids) {
      if (!byUser[uid]) {
        const { data: u } = await supabase.auth.admin.getUserById(uid)
        byUser[uid] = { email: u?.user?.email ?? "", items: [] }
      }
      byUser[uid].items.push(`[${row.created_at}] ${(row.body as string).slice(0, 120)}...`)
    }
  }

  if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500 })

  for (const [userId, { email, items }] of Object.entries(byUser)) {
    if (!email || items.length === 0) continue
    const body = items.map((i) => `<li>${i}</li>`).join("")
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Leitor Bef/Aft <notificacoes@seu-dominio.com>",
        to: [email],
        subject: `Você foi marcado em ${items.length} mensagem(ns) hoje`,
        html: `<p>Resumo das menções:</p><ul>${body}</ul><p><a href="${SITE_URL}">Abrir o app</a></p>`,
      }),
    })
  }

  return new Response(JSON.stringify({ ok: true, usersNotified: Object.keys(byUser).length }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
})
```

**Variáveis de ambiente da função (Supabase Dashboard → Edge Functions → send-mention-notifications → Settings):**

- `RESEND_API_KEY` — chave da API do [Resend](https://resend.com) (crie uma e verifique o domínio de envio).
- `SITE_URL` — URL do seu app (ex.: `https://seu-projeto.vercel.app`).
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` — o Supabase costuma injetar automaticamente; se não, copie do projeto.

## 2. Agendar a chamada (1x por dia)

Use um serviço de cron que chame a URL da função **uma vez por dia** (ex.: 9h):

- **[cron-job.org](https://cron-job.org)** (grátis): crie um job, URL = `https://SEU_PROJECT_REF.supabase.co/functions/v1/send-mention-notifications`, método POST, header `Authorization: Bearer SEU_ANON_KEY` (ou um token que você criar).
- **Vercel Cron**: se o app estiver na Vercel, pode usar `vercel.json` com `crons` apontando para um endpoint que chame a Edge Function.

Exemplo para cron-job.org:

- URL: `https://suwfxthouaurxhthkljl.supabase.co/functions/v1/send-mention-notifications`
- Schedule: Daily, 9:00
- Request headers: `Authorization: Bearer SEU_ANON_KEY`

Assim, cada usuário que foi marcado com @ durante o dia recebe **no máximo um e-mail por dia** com o resumo das menções.
