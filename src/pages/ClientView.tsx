import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Client, FolderWithPages, Page, Section } from '@/lib/database.types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/Sidebar/Sidebar'

type DialogType = 'folder' | 'page' | 'section' | null

export function ClientView() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const [client, setClient] = useState<Client | null>(null)
  const [folders, setFolders] = useState<FolderWithPages[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogType, setDialogType] = useState<DialogType>(null)
  const [dialogParentId, setDialogParentId] = useState<string>('')
  const [inputName, setInputName] = useState('')
  const [creating, setCreating] = useState(false)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (clientId) loadData()
  }, [clientId])

  async function loadData() {
    setLoading(true)
    const [{ data: clientData }, { data: foldersData }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId!).single() as Promise<{ data: Client | null }>,
      supabase
        .from('folders')
        .select('*, pages(*, sections(*))')
        .eq('client_id', clientId!)
        .order('order', { ascending: true }) as Promise<{ data: unknown[] | null }>,
    ])
    setClient(clientData)
    if (foldersData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized: FolderWithPages[] = (foldersData as any[]).map((f) => ({
        ...f,
        pages: (f.pages ?? []).map((p: Page & { sections: Section[] }) => ({
          ...p,
          sections: p.sections ?? [],
        })),
      }))
      setFolders(normalized)
    }
    setLoading(false)
  }

  function openDialog(type: DialogType, parentId = '') {
    setDialogType(type)
    setDialogParentId(parentId)
    setInputName('')
  }

  async function handleCreate() {
    if (!inputName.trim() || !clientId) return
    setCreating(true)

    if (dialogType === 'folder') {
      const { data } = await supabase
        .from('folders')
        .insert({ client_id: clientId, name: inputName.trim(), order: folders.length } as object)
        .select()
        .single() as { data: { id: string; client_id: string; name: string; order: number; created_at: string } | null }
      if (data) {
        setFolders((prev) => [...prev, { ...data, pages: [] }])
      }
    } else if (dialogType === 'page') {
      const folder = folders.find((f) => f.id === dialogParentId)
      const { data } = await supabase
        .from('pages')
        .insert({ folder_id: dialogParentId, name: inputName.trim(), order: folder?.pages.length ?? 0 } as object)
        .select()
        .single() as { data: Page | null }
      if (data) {
        setFolders((prev) =>
          prev.map((f) =>
            f.id === dialogParentId
              ? { ...f, pages: [...f.pages, { ...data, sections: [] }] }
              : f
          )
        )
      }
    } else if (dialogType === 'section') {
      const page = folders.flatMap((f) => f.pages).find((p) => p.id === dialogParentId)
      const { data } = await supabase
        .from('sections')
        .insert({
          page_id: dialogParentId,
          name: inputName.trim(),
          order: page?.sections.length ?? 0,
          content_before: '',
          content_after: '',
          defense_note: '',
        } as object)
        .select()
        .single() as { data: Section | null }
      if (data) {
        setFolders((prev) =>
          prev.map((f) => ({
            ...f,
            pages: f.pages.map((p) =>
              p.id === dialogParentId
                ? { ...p, sections: [...p.sections, data] }
                : p
            ),
          }))
        )
      }
    }

    setCreating(false)
    setDialogType(null)
    setInputName('')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        clientName={client?.name ?? ''}
        folders={folders}
        profile={profile}
        onSignOut={signOut}
        onAddFolder={isAdmin ? () => openDialog('folder') : undefined}
        onAddPage={isAdmin ? (folderId) => openDialog('page', folderId) : undefined}
        onAddSection={isAdmin ? (pageId) => openDialog('section', pageId) : undefined}
      />

      {/* Main area */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-sm font-semibold">{client?.name}</h1>
            <p className="text-xs text-muted-foreground">{folders.length} pasta(s)</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma pasta ainda.</p>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => openDialog('folder')}
                >
                  <Plus className="h-3.5 w-3.5" /> Nova pasta
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {folders.map((folder, fi) => (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: fi * 0.05 }}
                  className="rounded-xl border border-border"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="font-semibold text-sm">{folder.name}</h2>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => openDialog('page', folder.id)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Página
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={async () => {
                            if (!confirm('Deletar esta pasta e todos os seus conteúdos?')) return
                            await supabase.from('folders').delete().eq('id', folder.id)
                            setFolders((prev) => prev.filter((f) => f.id !== folder.id))
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {folder.pages.map((page) => (
                      <div key={page.id} className="rounded-lg border border-border/60 bg-muted/20">
                        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
                          <p className="text-sm font-medium">{page.name}</p>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 text-xs"
                              onClick={() => openDialog('section', page.id)}
                            >
                              <Plus className="h-3 w-3" /> Seção
                            </Button>
                          )}
                        </div>
                        <div className="p-2 space-y-1">
                          {page.sections.map((section) => (
                            <button
                              key={section.id}
                              onClick={() => navigate(`/section/${section.id}`)}
                              className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between group"
                            >
                              <span className="truncate">{section.name}</span>
                              <ArrowLeft className="h-3 w-3 rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                          {page.sections.length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground italic">Nenhuma seção.</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {folder.pages.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nenhuma página nesta pasta.</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Dialog */}
      <Dialog open={dialogType !== null} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'folder' && 'Nova pasta'}
              {dialogType === 'page' && 'Nova página'}
              {dialogType === 'section' && 'Nova seção'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder={
                dialogType === 'folder' ? 'Ex: Seguro Viagem' :
                dialogType === 'page' ? 'Ex: Página Principal' :
                'Ex: FAQ - Benefícios'
              }
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !inputName.trim()}
              className="w-full"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
