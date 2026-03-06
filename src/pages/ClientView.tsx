import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DndContext } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ArrowRightLeft, Copy, GripVertical, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
type EditTarget = { type: 'folder' | 'page' | 'section'; id: string; name: string }

function SortableSectionRow({
  section,
  isAdmin,
  onNavigate,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
}: {
  section: Section
  isAdmin: boolean
  onNavigate: () => void
  onRename: (e: React.MouseEvent) => void
  onDuplicate: (e: React.MouseEvent) => void
  onMove: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 group/item rounded-md hover:bg-accent/50 ${isDragging ? 'opacity-50 z-10' : ''}`}
    >
      {isAdmin && (
        <button
          type="button"
          className="touch-none p-1 rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onNavigate}
        className="flex-1 min-w-0 rounded-md px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
      >
        <span className="truncate">{section.name}</span>
        <ArrowLeft className="h-3 w-3 rotate-180 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 ml-1" />
      </button>
      {isAdmin && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover/item:opacity-100 shrink-0"
            onClick={onRename}
            title="Renomear"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover/item:opacity-100 shrink-0"
            onClick={onDuplicate}
            title="Duplicar seção"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover/item:opacity-100 shrink-0"
            onClick={onMove}
            title="Mover seção"
          >
            <ArrowRightLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive opacity-0 group-hover/item:opacity-100 shrink-0"
            onClick={onDelete}
            title="Deletar"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  )
}

export function ClientView() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const [client, setClient] = useState<Client | null>(null)
  const [folders, setFolders] = useState<FolderWithPages[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogType, setDialogType] = useState<DialogType>(null)
  const [dialogParentId, setDialogParentId] = useState<string>('')
  const [inputName, setInputName] = useState('')
  const [sectionTypeChoice, setSectionTypeChoice] = useState<'content' | 'serp_preview'>('content')
  const [creating, setCreating] = useState(false)

  const [editingItem, setEditingItem] = useState<EditTarget | null>(null)
  const [savingRename, setSavingRename] = useState(false)
  const [duplicateSection, setDuplicateSection] = useState<Section | null>(null)
  const [duplicateTargetPageId, setDuplicateTargetPageId] = useState<string>('')
  const [duplicating, setDuplicating] = useState(false)
  const [moveSection, setMoveSection] = useState<Section | null>(null)
  const [moveTargetPageId, setMoveTargetPageId] = useState<string>('')
  const [moving, setMoving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const isAdmin = profile?.role === 'admin'

  function filterFoldersBySearch(
    data: FolderWithPages[],
    query: string
  ): FolderWithPages[] {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data
      .map((folder) => {
        const folderMatch = folder.name.toLowerCase().includes(q)
        const pages = folder.pages
          .map((page) => {
            const pageMatch = page.name.toLowerCase().includes(q)
            const sections = page.sections.filter((s) =>
              s.name.toLowerCase().includes(q)
            )
            if (pageMatch || sections.length > 0) {
              return {
                ...page,
                sections: pageMatch ? page.sections : sections,
              }
            }
            return null
          })
          .filter((p): p is Page & { sections: Section[] } => p !== null)
        if (folderMatch || pages.length > 0) {
          return { ...folder, pages }
        }
        return null
      })
      .filter((f): f is FolderWithPages => f !== null)
  }
  const displayedFolders = filterFoldersBySearch(folders, searchQuery)

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
    setEditingItem(null)
    setInputName('')
    setSectionTypeChoice('content')
  }

  function openRename(type: EditTarget['type'], id: string, name: string) {
    setEditingItem({ type, id, name })
    setInputName(name)
    setDialogType(null)
  }

  function closeEditDialog() {
    setEditingItem(null)
    setInputName('')
  }

  async function handleRename() {
    if (!editingItem || !inputName.trim()) return
    setSavingRename(true)
    const table = editingItem.type === 'folder' ? 'folders' : editingItem.type === 'page' ? 'pages' : 'sections'
    const { error } = await supabase.from(table).update({ name: inputName.trim() }).eq('id', editingItem.id) as { error: unknown }
    if (!error) {
      setFolders((prev) =>
        prev.map((f) => {
          if (editingItem.type === 'folder' && f.id === editingItem.id) return { ...f, name: inputName.trim() }
          if (editingItem.type === 'page') {
            return { ...f, pages: f.pages.map((p) => (p.id === editingItem.id ? { ...p, name: inputName.trim() } : p)) }
          }
          if (editingItem.type === 'section') {
            return {
              ...f,
              pages: f.pages.map((p) => ({
                ...p,
                sections: p.sections.map((s) => (s.id === editingItem.id ? { ...s, name: inputName.trim() } : s)),
              })),
            }
          }
          return f
        })
      )
      closeEditDialog()
    }
    setSavingRename(false)
  }

  async function handleDeletePage(pageId: string) {
    if (!confirm('Deletar esta página e todas as seções?')) return
    const { error } = await supabase.from('pages').delete().eq('id', pageId) as { error: unknown }
    if (!error) {
      setFolders((prev) =>
        prev.map((f) => ({ ...f, pages: f.pages.filter((p) => p.id !== pageId) }))
      )
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm('Deletar esta seção?')) return
    const { error } = await supabase.from('sections').delete().eq('id', sectionId) as { error: unknown }
    if (!error) {
      setFolders((prev) =>
        prev.map((f) => ({
          ...f,
          pages: f.pages.map((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== sectionId) })),
        }))
      )
    }
  }

  async function handleDuplicateSection() {
    if (!duplicateSection || !duplicateTargetPageId) return
    const targetPage = folders.flatMap((f) => f.pages).find((p) => p.id === duplicateTargetPageId)
    if (!targetPage) return
    setDuplicating(true)
    const { data } = await supabase
      .from('sections')
      .insert({
        page_id: duplicateTargetPageId,
        name: `${duplicateSection.name} (cópia)`,
        content_before: duplicateSection.content_before ?? '',
        content_after: duplicateSection.content_after ?? '',
        defense_note: duplicateSection.defense_note ?? '',
        section_type: duplicateSection.section_type ?? 'content',
        meta_title: duplicateSection.meta_title ?? '',
        meta_description: duplicateSection.meta_description ?? '',
        meta_url: duplicateSection.meta_url ?? '',
        order: targetPage.sections.length,
      } as object)
      .select()
      .single() as { data: Section | null }
    setDuplicating(false)
    setDuplicateSection(null)
    setDuplicateTargetPageId('')
    if (data) {
      setFolders((prev) =>
        prev.map((f) => ({
          ...f,
          pages: f.pages.map((p) =>
            p.id === duplicateTargetPageId ? { ...p, sections: [...p.sections, data] } : p
          ),
        }))
      )
    }
  }

  async function openDuplicateModal(section: Section) {
    const { data: fullSection } = await supabase
      .from('sections')
      .select('*')
      .eq('id', section.id)
      .single() as { data: Section | null }
    setDuplicateSection(fullSection ?? section)
    setDuplicateTargetPageId('')
  }

  async function handleMoveSection() {
    if (!moveSection || !moveTargetPageId) return
    if (moveTargetPageId === moveSection.page_id) {
      setMoveSection(null)
      setMoveTargetPageId('')
      return
    }
    const targetPage = folders.flatMap((f) => f.pages).find((p) => p.id === moveTargetPageId)
    const sourcePage = folders.flatMap((f) => f.pages).find((p) => p.id === moveSection.page_id)
    if (!targetPage || !sourcePage) return
    setMoving(true)
    const { error } = await supabase
      .from('sections')
      .update({ page_id: moveTargetPageId, order: targetPage.sections.length } as object)
      .eq('id', moveSection.id) as { error: unknown }
    if (!error) {
      const sourceSections = sourcePage.sections.filter((s) => s.id !== moveSection.id)
      for (let i = 0; i < sourceSections.length; i++) {
        await supabase.from('sections').update({ order: i } as object).eq('id', sourceSections[i].id)
      }
      setFolders((prev) =>
        prev.map((f) => ({
          ...f,
          pages: f.pages.map((p) => {
            if (p.id === moveSection.page_id) {
              return { ...p, sections: p.sections.filter((s) => s.id !== moveSection.id).map((s, i) => ({ ...s, order: i })) }
            }
            if (p.id === moveTargetPageId) {
              return { ...p, sections: [...p.sections, { ...moveSection, page_id: moveTargetPageId, order: p.sections.length }] }
            }
            return p
          }),
        }))
      )
    }
    setMoving(false)
    setMoveSection(null)
    setMoveTargetPageId('')
  }

  async function handleSectionReorder(pageId: string, activeId: string, overId: string | null) {
    if (!overId || activeId === overId) return
    const page = folders.flatMap((f) => f.pages).find((p) => p.id === pageId)
    if (!page) return
    const sorted = [...page.sections].sort((a, b) => a.order - b.order)
    const oldIndex = sorted.findIndex((s) => s.id === activeId)
    const newIndex = sorted.findIndex((s) => s.id === overId)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...sorted]
    const [removed] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, removed)
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('sections').update({ order: i } as object).eq('id', reordered[i].id)
    }
    const sectionsWithNewOrder = reordered.map((s, i) => ({ ...s, order: i }))
    setFolders((prev) =>
      prev.map((f) => ({
        ...f,
        pages: f.pages.map((p) =>
          p.id === pageId ? { ...p, sections: sectionsWithNewOrder } : p
        ),
      }))
    )
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
          section_type: sectionTypeChoice,
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
        clientId={clientId ?? undefined}
        userId={user?.id}
      />

      {/* Main area */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold">{client?.name}</h1>
            <p className="text-xs text-muted-foreground">{folders.length} pasta(s)</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar pasta, página ou seção"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
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
          ) : displayedFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">Nenhum resultado para &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            <div className="space-y-6">
              {displayedFolders.map((folder, fi) => (
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
                          className="h-7 w-7"
                          onClick={() => openRename('folder', folder.id, folder.name)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
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
                          <div className="flex items-center gap-0.5">
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
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => { e.stopPropagation(); openRename('page', page.id, page.name) }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id) }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="p-2 space-y-1">
                          {(() => {
                            const sortedSections = [...page.sections].sort((a, b) => a.order - b.order)
                            if (sortedSections.length === 0) {
                              return <p className="px-3 py-2 text-xs text-muted-foreground italic">Nenhuma seção.</p>
                            }
                            const sectionIds = sortedSections.map((s) => s.id)
                            return (
                              <DndContext
                                onDragEnd={(event: DragEndEvent) => {
                                  handleSectionReorder(page.id, String(event.active.id), event.over ? String(event.over.id) : null)
                                }}
                              >
                                <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                                  {sortedSections.map((section) => (
                                    <SortableSectionRow
                                      key={section.id}
                                      section={section}
                                      isAdmin={!!isAdmin}
                                      onNavigate={() => navigate(`/section/${section.id}`)}
                                      onRename={(e) => { e.stopPropagation(); openRename('section', section.id, section.name) }}
                                      onDuplicate={(e) => { e.stopPropagation(); openDuplicateModal(section) }}
                                      onMove={(e) => { e.stopPropagation(); setMoveSection(section); setMoveTargetPageId('') }}
                                      onDelete={(e) => { e.stopPropagation(); handleDeleteSection(section.id) }}
                                    />
                                  ))}
                                </SortableContext>
                              </DndContext>
                            )
                          })()}
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
                'Ex: Hero, Benefícios, Preview SERP...'
              }
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            {dialogType === 'section' && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Tipo de seção</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSectionTypeChoice('content')}
                    className={`rounded-lg border p-3 text-left text-xs transition-all ${sectionTypeChoice === 'content' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}
                  >
                    <p className="font-semibold mb-0.5">Conteúdo</p>
                    <p className="text-muted-foreground text-[10px] leading-tight">Slider Antes/Depois para textos, headlines, CTAs etc.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSectionTypeChoice('serp_preview')}
                    className={`rounded-lg border p-3 text-left text-xs transition-all ${sectionTypeChoice === 'serp_preview' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}
                  >
                    <p className="font-semibold mb-0.5">Preview SERP</p>
                    <p className="text-muted-foreground text-[10px] leading-tight">Meta Title e Description com preview visual do Google.</p>
                  </button>
                </div>
              </div>
            )}
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

      {/* Move Section Dialog */}
      <Dialog open={moveSection !== null} onOpenChange={(o) => !o && setMoveSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover seção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {moveSection && (
              <>
                <p className="text-sm text-muted-foreground">
                  Mover &quot;{moveSection.name}&quot; para qual página?
                </p>
                <select
                  value={moveTargetPageId}
                  onChange={(e) => setMoveTargetPageId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione a página de destino</option>
                  {folders.flatMap((f) =>
                    f.pages
                      .filter((p) => p.id !== moveSection.page_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {f.name} → {p.name}
                        </option>
                      ))
                  )}
                </select>
                <Button
                  onClick={handleMoveSection}
                  disabled={moving || !moveTargetPageId}
                  className="w-full"
                >
                  {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mover'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Section Dialog */}
      <Dialog open={duplicateSection !== null} onOpenChange={(o) => !o && setDuplicateSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar seção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {duplicateSection && (
              <>
                <p className="text-sm text-muted-foreground">
                  Copiar &quot;{duplicateSection.name}&quot; (conteúdo, defesa e meta tags) para qual página?
                </p>
                <select
                  value={duplicateTargetPageId}
                  onChange={(e) => setDuplicateTargetPageId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione a página de destino</option>
                  {folders.flatMap((f) =>
                    f.pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {f.name} → {p.name}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  onClick={handleDuplicateSection}
                  disabled={duplicating || !duplicateTargetPageId}
                  className="w-full"
                >
                  {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Duplicar'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={editingItem !== null} onOpenChange={(o) => !o && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem?.type === 'folder' && 'Renomear pasta'}
              {editingItem?.type === 'page' && 'Renomear página'}
              {editingItem?.type === 'section' && 'Renomear seção'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Nome"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
            <Button
              onClick={handleRename}
              disabled={savingRename || !inputName.trim()}
              className="w-full"
            >
              {savingRename ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
