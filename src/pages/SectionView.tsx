import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Edit2, Check, X, MessageCircle, XCircle, FileUp } from 'lucide-react'
import { marked } from 'marked'
import { supabase } from '@/lib/supabase'
import type { Section, FolderWithPages, Client, Page } from '@/lib/database.types'
import { SliderComparison } from '@/components/SliderComparison/SliderComparison'
import { ChatPanel } from '@/components/ChatPanel/ChatPanel'
import { NotesEditor } from '@/components/NotesEditor/NotesEditor'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
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
  const [importTarget, setImportTarget] = useState<'before' | 'after' | null>(null)
  const [importText, setImportText] = useState('')
  const [importConvertToHtml, setImportConvertToHtml] = useState(true)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Meta tags state
  const [metaTitleDraft, setMetaTitleDraft] = useState('')
  const [metaDescDraft, setMetaDescDraft] = useState('')
  const [metaUrlDraft, setMetaUrlDraft] = useState('')
  const [editingMeta, setEditingMeta] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [approvingMeta, setApprovingMeta] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const isClient = profile?.role === 'client'
  const isSerp = section?.section_type === 'serp_preview'
  const approvalStatus = (section as { approval_status?: string } | null)?.approval_status ?? 'pending'
  const metaApprovalStatus = (section as { meta_approval_status?: string } | null)?.meta_approval_status ?? 'pending'

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
    setMetaTitleDraft(sectionData.meta_title ?? '')
    setMetaDescDraft(sectionData.meta_description ?? '')
    setMetaUrlDraft(sectionData.meta_url ?? '')

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

  async function setMetaApproval(status: 'approved' | 'approved_with_observations' | 'rejected') {
    if (!sectionId) return
    setApprovingMeta(true)
    const { error } = await supabase.rpc('set_meta_approval', { p_section_id: sectionId, p_status: status })
    setApprovingMeta(false)
    if (!error) {
      setSection((prev) => prev ? { ...prev, meta_approval_status: status, meta_approval_by: profile?.id ?? null, meta_approval_at: new Date().toISOString() } : prev)
    }
  }

  async function saveMetaFields() {
    if (!sectionId) return
    setSavingMeta(true)
    await supabase
      .from('sections')
      .update({
        meta_title: metaTitleDraft,
        meta_description: metaDescDraft,
        meta_url: metaUrlDraft,
        updated_at: new Date().toISOString(),
      } as object)
      .eq('id', sectionId)
    setSection((prev) => prev ? { ...prev, meta_title: metaTitleDraft, meta_description: metaDescDraft, meta_url: metaUrlDraft } : prev)
    setSavingMeta(false)
    setEditingMeta(false)
  }

  function openImport(target: 'before' | 'after') {
    setImportTarget(target)
    setImportText('')
    setImportConvertToHtml(true)
  }

  async function applyImport() {
    if (!importTarget) return
    const text = importText.trim()
    if (!text) {
      setImportTarget(null)
      return
    }
    let content: string
    if (importConvertToHtml) {
      const result = marked(text)
      content = typeof result === 'string' ? result : await result
    } else {
      content = text
    }
    if (importTarget === 'before') setBeforeDraft(content)
    else setAfterDraft(content)
    setImportTarget(null)
    setImportText('')
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImportText(String(reader.result ?? ''))
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
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
          {/* Aprovação de conteúdo — só seções normais */}
          {isClient && !isSerp && (
            <div className="flex items-center gap-1" title="Aprovar / Observações / Reprovar">
              <button type="button" onClick={() => setApproval('approved')} disabled={approving} title="Aprovado"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'approved' ? 'bg-green-500/20 ring-2 ring-green-500 text-green-600' : 'text-muted-foreground hover:bg-green-500/10 hover:text-green-600'}`}>
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setApproval('approved_with_observations')} disabled={approving} title="Aprovado com observações"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'approved_with_observations' ? 'bg-amber-500/20 ring-2 ring-amber-500 text-amber-600' : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'}`}>
                <MessageCircle className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setApproval('rejected')} disabled={approving} title="Reprovado"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'rejected' ? 'bg-red-500/20 ring-2 ring-red-500 text-red-600' : 'text-muted-foreground hover:bg-red-500/10 hover:text-red-600'}`}>
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}
          {isAdmin && !isSerp && (
            <div className="flex items-center gap-2">
              <ContentEditButton label="Editar Antes" editing={editingBefore}
                onToggle={() => { if (editingBefore) saveContent('content_before', beforeDraft); setEditingBefore(!editingBefore) }}
                onCancel={() => { setBeforeDraft(section.content_before); setEditingBefore(false) }}
              />
              <ContentEditButton label="Editar Depois" editing={editingAfter}
                onToggle={() => { if (editingAfter) saveContent('content_after', afterDraft); setEditingAfter(!editingAfter) }}
                onCancel={() => { setAfterDraft(section.content_after); setEditingAfter(false) }}
              />
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden flex-col">
          {isSerp ? (
            /* ── SERP PREVIEW layout ── */
            <SerpView
              metaTitle={section.meta_title ?? ''}
              metaDescription={section.meta_description ?? ''}
              metaUrl={section.meta_url ?? ''}
              metaTitleDraft={metaTitleDraft}
              metaDescDraft={metaDescDraft}
              metaUrlDraft={metaUrlDraft}
              setMetaTitleDraft={setMetaTitleDraft}
              setMetaDescDraft={setMetaDescDraft}
              setMetaUrlDraft={setMetaUrlDraft}
              editing={editingMeta}
              saving={savingMeta}
              approvalStatus={metaApprovalStatus}
              approvingMeta={approvingMeta}
              isAdmin={isAdmin}
              isClient={isClient}
              onEdit={() => setEditingMeta(true)}
              onCancel={() => { setMetaTitleDraft(section.meta_title ?? ''); setMetaDescDraft(section.meta_description ?? ''); setMetaUrlDraft(section.meta_url ?? ''); setEditingMeta(false) }}
              onSave={saveMetaFields}
              onApprove={setMetaApproval}
            />
          ) : (
            /* ── CONTENT (slider) layout ── */
            <>
              <div className="flex-1 overflow-hidden p-4">
                {(editingBefore || editingAfter) && isAdmin ? (
                  <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-muted-foreground">Texto Antes</label>
                        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => openImport('before')}>
                          <FileUp className="h-3 w-3" /> Importar .md
                        </Button>
                      </div>
                      <textarea className="flex-1 rounded-lg border border-border bg-background p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                        value={beforeDraft} onChange={(e) => setBeforeDraft(e.target.value)} placeholder="Cole o texto original aqui..." disabled={!editingBefore} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-muted-foreground">Texto Depois</label>
                        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => openImport('after')}>
                          <FileUp className="h-3 w-3" /> Importar .md
                        </Button>
                      </div>
                      <textarea className="flex-1 rounded-lg border border-border bg-background p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                        value={afterDraft} onChange={(e) => setAfterDraft(e.target.value)} placeholder="Cole o texto otimizado aqui..." disabled={!editingAfter} />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="slider" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
                    <SliderComparison contentBefore={section.content_before} contentAfter={section.content_after} />
                  </motion.div>
                )}
              </div>

              {/* Notes editor — bottom panel */}
              <NotesEditor value={section.defense_note} onSave={saveDefenseNote} readOnly={!isAdmin} />
            </>
          )}
        </div>
      </div>

      {/* Chat — right column */}
      <ChatPanel
        clientId={client?.id ?? ''}
        sectionId={section.id}
        currentUserId={profile?.id ?? ''}
        currentUserName={profile?.full_name ?? null}
      />

      {/* Modal Importar .md */}
      <Dialog open={importTarget !== null} onOpenChange={(open) => !open && setImportTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Markdown</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 flex flex-col min-h-0">
            <p className="text-sm text-muted-foreground">
              Importar para: <strong>{importTarget === 'before' ? 'Texto Antes' : 'Texto Depois'}</strong>
            </p>
            <textarea
              className="min-h-[140px] rounded-lg border border-border bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Cole o conteúdo em markdown aqui ou use o botão para selecionar um arquivo .md"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <input
                ref={importFileRef}
                type="file"
                accept=".md,text/markdown,text/plain"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => importFileRef.current?.click()}>
                <FileUp className="h-3.5 w-3.5 mr-1.5" /> Selecionar arquivo .md
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={importConvertToHtml}
                onChange={(e) => setImportConvertToHtml(e.target.checked)}
                className="rounded border-border"
              />
              Converter Markdown para HTML (títulos, listas, negrito etc. aparecem formatados no slider)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setImportTarget(null)}>Cancelar</Button>
              <Button size="sm" onClick={applyImport} disabled={!importText.trim()}>Aplicar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SerpView — layout completo para seções do tipo serp_preview
// ---------------------------------------------------------------------------

const META_TITLE_MAX = 60
const META_DESC_MAX = 160

const metaApprovalStyle = {
  approved: 'bg-green-500/10 text-green-600 ring-1 ring-green-500',
  approved_with_observations: 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500',
  rejected: 'bg-red-500/10 text-red-600 ring-1 ring-red-500',
  pending: 'bg-muted text-muted-foreground',
}

const metaApprovalLabel = {
  approved: 'Aprovado',
  approved_with_observations: 'Aprovado c/ observações',
  rejected: 'Reprovado',
  pending: 'Aguardando aprovação',
}

interface SerpViewProps {
  metaTitle: string
  metaDescription: string
  metaUrl: string
  metaTitleDraft: string
  metaDescDraft: string
  metaUrlDraft: string
  setMetaTitleDraft: (v: string) => void
  setMetaDescDraft: (v: string) => void
  setMetaUrlDraft: (v: string) => void
  editing: boolean
  saving: boolean
  approvalStatus: string
  approvingMeta: boolean
  isAdmin: boolean
  isClient: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onApprove: (status: 'approved' | 'approved_with_observations' | 'rejected') => void
}

function SerpView({
  metaTitle, metaDescription, metaUrl,
  metaTitleDraft, metaDescDraft, metaUrlDraft,
  setMetaTitleDraft, setMetaDescDraft, setMetaUrlDraft,
  editing, saving, approvalStatus, approvingMeta,
  isAdmin, isClient,
  onEdit, onCancel, onSave, onApprove,
}: SerpViewProps) {
  const displayTitle = editing ? metaTitleDraft : metaTitle
  const displayDesc = editing ? metaDescDraft : metaDescription
  const displayUrl = editing ? metaUrlDraft : metaUrl

  const titleTruncated = displayTitle.length > META_TITLE_MAX
    ? displayTitle.slice(0, META_TITLE_MAX) + '…'
    : displayTitle || 'Título da página'

  const descTruncated = displayDesc.length > META_DESC_MAX
    ? displayDesc.slice(0, META_DESC_MAX) + '…'
    : displayDesc || 'Descrição da página que aparece nos resultados de busca do Google...'

  const urlDisplay = displayUrl || 'www.exemplo.com.br › pagina'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Área principal: preview + edição */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Preview visual estilo Google */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Preview SERP</p>
          <div className="rounded-xl border border-border bg-background p-5 max-w-[600px]">
            {/* Favicon + URL */}
            <div className="flex items-center gap-2 mb-1">
              <div className="h-4 w-4 rounded-sm bg-muted flex items-center justify-center text-[8px] text-muted-foreground">G</div>
              <div className="min-w-0">
                <p className="text-xs text-foreground/70 truncate">{urlDisplay}</p>
              </div>
            </div>
            {/* Title */}
            <p className={`text-[17px] leading-snug font-normal text-[#1a0dab] mb-1 ${titleTruncated.endsWith('…') ? 'opacity-100' : ''}`}>
              {titleTruncated}
            </p>
            {/* Description */}
            <p className="text-sm text-[#4d5156] leading-relaxed">
              {descTruncated}
            </p>
            {/* Indicadores de tamanho */}
            <div className="mt-3 flex gap-4 border-t border-border/40 pt-2">
              <span className={`text-[10px] ${(editing ? metaTitleDraft : metaTitle).length > META_TITLE_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                Title: {(editing ? metaTitleDraft : metaTitle).length}/{META_TITLE_MAX} chars
              </span>
              <span className={`text-[10px] ${(editing ? metaDescDraft : metaDescription).length > META_DESC_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                Description: {(editing ? metaDescDraft : metaDescription).length}/{META_DESC_MAX} chars
              </span>
            </div>
          </div>
        </div>

        {/* Campos de edição — admin */}
        {isAdmin && editing && (
          <div className="space-y-4 max-w-[600px]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <Input
                value={metaUrlDraft}
                onChange={(e) => setMetaUrlDraft(e.target.value)}
                placeholder="www.exemplo.com.br › pagina"
                className="text-sm h-8 font-mono"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Meta Title</label>
                <span className={`text-[10px] ${metaTitleDraft.length > META_TITLE_MAX ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {metaTitleDraft.length}/{META_TITLE_MAX}
                </span>
              </div>
              <Input
                value={metaTitleDraft}
                onChange={(e) => setMetaTitleDraft(e.target.value)}
                placeholder="Título que aparece nos resultados de busca..."
                className="text-sm h-8"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Meta Description</label>
                <span className={`text-[10px] ${metaDescDraft.length > META_DESC_MAX ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {metaDescDraft.length}/{META_DESC_MAX}
                </span>
              </div>
              <textarea
                value={metaDescDraft}
                onChange={(e) => setMetaDescDraft(e.target.value)}
                placeholder="Descrição que aparece nos resultados de busca..."
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Campos em modo leitura — admin (sem editar) */}
        {isAdmin && !editing && (metaTitle || metaDescription || metaUrl) && (
          <div className="space-y-2 max-w-[600px]">
            {metaUrl && <p className="text-xs text-muted-foreground"><span className="font-medium">URL:</span> {metaUrl}</p>}
            {!metaTitle && !metaDescription && !metaUrl && (
              <p className="text-xs text-muted-foreground italic">Nenhum conteúdo definido. Clique em Editar para adicionar.</p>
            )}
          </div>
        )}

        {isAdmin && !editing && !metaTitle && !metaDescription && !metaUrl && (
          <p className="text-xs text-muted-foreground italic max-w-[600px]">Nenhum conteúdo definido. Clique em Editar para adicionar.</p>
        )}
      </div>

      {/* Barra inferior: status de aprovação + ações */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${metaApprovalStyle[approvalStatus as keyof typeof metaApprovalStyle] ?? metaApprovalStyle.pending}`}>
            {metaApprovalLabel[approvalStatus as keyof typeof metaApprovalLabel] ?? 'Aguardando aprovação'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Aprovação — cliente */}
          {isClient && (
            <>
              <button type="button" onClick={() => onApprove('approved')} disabled={approvingMeta} title="Aprovado"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'approved' ? 'bg-green-500/20 ring-2 ring-green-500 text-green-600' : 'text-muted-foreground hover:bg-green-500/10 hover:text-green-600'}`}>
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onApprove('approved_with_observations')} disabled={approvingMeta} title="Aprovado com observações"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'approved_with_observations' ? 'bg-amber-500/20 ring-2 ring-amber-500 text-amber-600' : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'}`}>
                <MessageCircle className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onApprove('rejected')} disabled={approvingMeta} title="Reprovado"
                className={`rounded-full p-1.5 transition-all ${approvalStatus === 'rejected' ? 'bg-red-500/20 ring-2 ring-red-500 text-red-600' : 'text-muted-foreground hover:bg-red-500/10 hover:text-red-600'}`}>
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {/* Edição — admin */}
          {isAdmin && (
            editing ? (
              <div className="flex items-center gap-1 ml-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onCancel}>
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={onSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" /> Salvar</>}
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs ml-1" onClick={onEdit}>
                <Edit2 className="h-3.5 w-3.5" /> Editar
              </Button>
            )
          )}
        </div>
      </div>
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
