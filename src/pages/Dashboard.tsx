import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Users, ArrowRight, Loader2, Trash2, UserPlus, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/lib/database.types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { useAuth } from '@/hooks/useAuth'

export function Dashboard() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [newClientName, setNewClientName] = useState('')
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [accessModalClient, setAccessModalClient] = useState<Client | null>(null)
  const [linkUserId, setLinkUserId] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSuccess, setLinkSuccess] = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)
  const fetchedForProfile = useRef<string | null>(null)

  useEffect(() => {
    if (profile === undefined) return
    if (!profile) {
      setLoading(false)
      fetchedForProfile.current = null
      return
    }
    if (profile.role === 'client' && profile.client_id) {
      navigate(`/client/${profile.client_id}`, { replace: true })
      return
    }
    if (fetchedForProfile.current === profile.id) return
    fetchedForProfile.current = profile.id
    fetchClients()
  }, [profile])

  async function fetchClients() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
      setClients(data ?? [])
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  async function createClient() {
    if (!newClientName.trim()) return
    setCreating(true)
    const { data } = await supabase
      .from('clients')
      .insert({ name: newClientName.trim() } as object)
      .select()
      .single() as { data: Client | null }
    if (data) {
      setClients((prev) => [data, ...prev])
      setNewClientName('')
      setDialogOpen(false)
    }
    setCreating(false)
  }

  async function deleteClient(id: string) {
    if (!confirm('Deletar este cliente e todos os seus dados?')) return
    await supabase.from('clients').delete().eq('id', id)
    setClients((prev) => prev.filter((c) => c.id !== id))
  }

  const supabaseProjectRef =
    typeof import.meta.env.VITE_SUPABASE_URL === 'string'
      ? new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
      : ''
  const authUsersUrl =
    supabaseProjectRef && supabaseProjectRef !== 'undefined'
      ? `https://supabase.com/dashboard/project/${supabaseProjectRef}/auth/users`
      : 'https://supabase.com/dashboard'

  function getVincularSql(client: Client) {
    return `UPDATE profiles SET role = 'client', client_id = '${client.id}', full_name = '${(client.name || '').replace(/'/g, "''")}' WHERE id = 'COLE_O_UID_AQUI';`
  }

  async function copySql(client: Client) {
    await navigator.clipboard.writeText(getVincularSql(client))
    setSqlCopied(true)
    setTimeout(() => setSqlCopied(false), 2000)
  }

  async function vincularAgora() {
    if (!accessModalClient) return
    const uid = linkUserId.trim()
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uid || !uuidRegex.test(uid)) {
      setLinkError('Cole um User UID válido (formato UUID).')
      return
    }
    setLinkError(null)
    setLinking(true)
    const { error } = await supabase.rpc('vincular_perfil_ao_cliente', {
      p_user_id: uid,
      p_client_id: accessModalClient.id,
      p_full_name: accessModalClient.name,
    })
    setLinking(false)
    if (error) {
      setLinkError(error.message || 'Erro ao vincular.')
      return
    }
    setLinkSuccess(true)
    setLinkUserId('')
    setTimeout(() => {
      setLinkSuccess(false)
      setAccessModalClient(null)
    }, 1500)
  }

  function closeAccessModal() {
    setAccessModalClient(null)
    setLinkUserId('')
    setLinkError(null)
    setLinkSuccess(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Users className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Leitor Bef/Aft</h1>
              <p className="text-xs text-muted-foreground">Painel Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{profile?.full_name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Clientes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{clients.length} cliente(s) cadastrado(s)</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="Nome do cliente"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createClient()}
                  autoFocus
                />
                <Button
                  onClick={createClient}
                  disabled={creating || !newClientName.trim()}
                  className="w-full"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum cliente ainda.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo cliente" para começar.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client, i) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative rounded-xl border border-border bg-background p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setAccessModalClient(client)}
                      title="Conceder acesso"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteClient(client.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => navigate(`/client/${client.id}`)}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Conceder acesso */}
      <Dialog open={!!accessModalClient} onOpenChange={(open) => !open && closeAccessModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conceder acesso ao cliente</DialogTitle>
          </DialogHeader>
          {accessModalClient && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Para <strong>{accessModalClient.name}</strong> poder entrar na plataforma, faça o seguinte:
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium">1. Criar o usuário no Supabase</p>
                <p className="text-xs text-muted-foreground">
                  Crie um usuário (e-mail e senha) em Authentication. Depois copie o <strong>User UID</strong>.
                </p>
                {authUsersUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={authUsersUrl} target="_blank" rel="noreferrer">
                      Abrir Supabase → Auth / Users
                    </a>
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">2. Vincular o perfil ao cliente</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Opção A — Cole o SQL no SQL Editor do Supabase (substitua <code className="bg-muted px-1 rounded">COLE_O_UID_AQUI</code> pelo User UID):
                </p>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {getVincularSql(accessModalClient)}
                </pre>
                <Button variant="outline" size="sm" onClick={() => copySql(accessModalClient)}>
                  {sqlCopied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {sqlCopied ? 'Copiado' : 'Copiar SQL'}
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Opção B — Cole o User UID abaixo e clique em Vincular agora (não precisa abrir o SQL Editor):
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="User UID (ex.: 040388e9-2e89-446c-a0c6-a7d8ef08fa57)"
                    value={linkUserId}
                    onChange={(e) => setLinkUserId(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button size="sm" onClick={vincularAgora} disabled={linking}>
                    {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Vincular agora'}
                  </Button>
                </div>
                {linkError && (
                  <p className="text-xs text-destructive">{linkError}</p>
                )}
                {linkSuccess && (
                  <p className="text-xs text-green-600">Perfil vinculado. O cliente já pode fazer login.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
