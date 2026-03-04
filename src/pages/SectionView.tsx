import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Edit2, Check, X, MessageCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Section, FolderWithPages, Client, Page } from '@/lib/database.types'
import { SliderComparison } from '@/components/SliderComparison/SliderComparison'
import { ChatPanel } from '@/components/ChatPanel/ChatPanel'
import { NotesEditor } from '@/components/NotesEditor/NotesEditor'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'

export function SectionView() {
  const { sectionId } = useParams<{ sectionId: string }>()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const [section, setSection] = useState<Section | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [folders, setFolders] = useState<FolderWithPages[]>([])
  const [loading, setLoading] = useState(true)

  const [editingBefore, setEditingBefore] = useState(false)
  const [editingAfter, setEditingAfter] = useState(false)
  const [beforeDraft, setBeforeDraft] = useState('')
  const [afterDraft, setAfterDraft] = useState('')
  const [approving, setApproving] = useState(false)
  const isAdmin = profile?.role === 'admin'
  const isClient = profile?.role === 'client'
  const approvalStatus = (section as { approval_status?: string } | null)?.approval_status ?? 'pending'

  useEffect(() => {
    if (sectionId) loadSection()
  }, [sectionId])

  async function loadSection() {
    setLoading(true)

    const { data: sectionData } = await supabase
      .from('sections')
      .select('*')
      .eq('id', sectionId!)
      .single() as { data: Section | null }

    if (!sectionData) { setLoading(false); return }
    setSection(sectionData)
    setBeforeDraft(sectionData.content_before)
    setAfterDraft(sectionData.content_after)

    const { data: pageData } = await supabase
      .from('pages')
      .select('*')
      .eq('id', sectionData.page_id)
      .single() as { data: Page | null }

    if (!pageData) { setLoading(false); return }

    const { data: folderData } = await supabase
      .from('folders')
      .select('*')
      .eq('id', pageData.folder_id)
      .single() as { data: { id: string; client_id: string; name: string; order: number; created_at: string } | null }

    if (!folderData) { setLoading(false); return }

    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', folderData.client_id)
      .single() as { data: Client | null }

    setClient(clientData)

    const { data: foldersData } = await supabase
      .from('folders')
      .select('*, pages(*, sections(*))')
      .eq('client_id', folderData.client_id)
      .order('order', { ascending: true }) as { data: unknown[] | null }

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

  const saveDefenseNote = useCallback(
    async (content: string) => {
      if (!sectionId) return
      await supabase
        .from('sections')
        .update({ defense_note: content, updated_at: new Date().toISOString() } as object)
        .eq('id', sectionId)
      setSection((prev) => prev ? { ...prev, defense_note: content } : prev)
    },
    [sectionId]
  )

  async function saveContent(field: 'content_before' | 'content_after', value: string) {
    if (!sectionId) return
    await supabase
      .from('sections')
      .update({ [field]: value, updated_at: new Date().toISOString() } as object)
      .eq('id', sectionId)
    setSection((prev) => prev ? { ...prev, [field]: value } : prev)
  }

  async function setApproval(status: 'approved' | 'approved_with_observations' | 'rejected') {
    if (!sectionId) return
    setApproving(true)
    const { error } = await supabase.rpc('set_section_approval', { p_section_id: sectionId, p_status: status })
    setApproving(false)
    if (!error) {
      setSection((prev) => prev ? { ...prev, approval_status: status, approval_by: profile?.id ?? null, approval_at: new Date().toISOString() } : prev)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!section) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Seção não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        clientName={client?.name ?? ''}
        folders={folders}
        profile={profile}
        onSignOut={signOut}
        onAddFolder={undefined}
        onAddPage={undefined}
        onAddSection={undefined}
      />

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/client/${client?.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{client?.name}</p>
            <h1 className="text-sm font-semibold truncate">{section.name}</h1>
          </div>
          {isClient && (
            <div className="flex items-center gap-1" title="Aprovar / Observações / Reprovar">
              <button
                type="button"
                onClick={() => setApproval('approved')}
                disabled={approving}
                title="Aprovado"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'approved' ? 'bg-green-500/20 ring-2 ring-green-500 text-green-600' : 'text-muted-foreground hover:bg-green-500/10 hover:text-green-600'}`}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setApproval('approved_with_observations')}
                disabled={approving}
                title="Aprovado com observações"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'approved_with_observations' ? 'bg-amber-500/20 ring-2 ring-amber-500 text-amber-600' : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'}`}
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setApproval('rejected')}
                disabled={approving}
                title="Reprovado"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'rejected' ? 'bg-red-500/20 ring-2 ring-red-500 text-red-600' : 'text-muted-foreground hover:bg-red-500/10 hover:text-red-600'}`}
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <ContentEditButton
                label="Editar Antes"
                editing={editingBefore}
                onToggle={() => {
                  if (editingBefore) {
                    saveContent('content_before', beforeDraft)
                  }
                  setEditingBefore(!editingBefore)
                }}
                onCancel={() => {
                  setBeforeDraft(section.content_before)
                  setEditingBefore(false)
                }}
              />
              <ContentEditButton
                label="Editar Depois"
                editing={editingAfter}
                onToggle={() => {
                  if (editingAfter) {
                    saveContent('content_after', afterDraft)
                  }
                  setEditingAfter(!editingAfter)
                }}
                onCancel={() => {
                  setAfterDraft(section.content_after)
                  setEditingAfter(false)
                }}
              />
            </div>
          )}
        </header>

        {/* Content: slider + notes */}
        <div className="flex flex-1 overflow-hidden flex-col">
          {/* Slider or edit mode */}
          <div className="flex-1 overflow-hidden p-4">
            {(editingBefore || editingAfter) && isAdmin ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full grid grid-cols-2 gap-4"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Texto Antes</label>
                  <textarea
                    className="flex-1 rounded-lg border border-border bg-background p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                    value={beforeDraft}
                    onChange={(e) => setBeforeDraft(e.target.value)}
                    placeholder="Cole o texto original aqui..."
                    disabled={!editingBefore}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Texto Depois</label>
                  <textarea
                    className="flex-1 rounded-lg border border-border bg-background p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                    value={afterDraft}
                    onChange={(e) => setAfterDraft(e.target.value)}
                    placeholder="Cole o texto otimizado aqui..."
                    disabled={!editingAfter}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="slider"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full"
              >
                <SliderComparison
                  contentBefore={section.content_before}
                  contentAfter={section.content_after}
                />
              </motion.div>
            )}
          </div>

          {/* Notes editor — bottom panel */}
          <NotesEditor
            value={section.defense_note}
            onSave={saveDefenseNote}
            readOnly={!isAdmin}
          />
        </div>
      </div>

      {/* Chat — right column */}
      <ChatPanel
        clientId={client?.id ?? ''}
        sectionId={section.id}
        currentUserId={profile?.id ?? ''}
        currentUserName={profile?.full_name ?? null}
      />
    </div>
  )
}

function ContentEditButton({
  label,
  editing,
  onToggle,
  onCancel,
}: {
  label: string
  editing: boolean
  onToggle: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      {editing && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant={editing ? 'default' : 'outline'}
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={onToggle}
      >
        {editing ? <Check className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
        {editing ? 'Salvar' : label}
      </Button>
    </div>
  )
}

// Inline name editor — kept for potential future use
export function InlineNameEditor({
  name,
  onSave,
}: {
  name: string
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="flex items-center gap-1 group">
        <span className="text-sm font-semibold">{name}</span>
        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 text-sm font-semibold"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(value); setEditing(false) }
          if (e.key === 'Escape') { setValue(name); setEditing(false) }
        }}
      />
      <Button size="icon" className="h-7 w-7" onClick={() => { onSave(value); setEditing(false) }}>
        <Check className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
