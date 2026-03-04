import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  AlignLeft,
  LogOut,
  Plus,
  User,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import type { FolderWithPages } from '@/lib/database.types'

interface SidebarProps {
  clientName: string
  folders: FolderWithPages[]
  profile: { full_name: string | null; role: string } | null
  onSignOut: () => void
  onAddFolder?: () => void
  onAddPage?: (folderId: string) => void
  onAddSection?: (pageId: string) => void
}

interface FolderItemProps {
  folder: FolderWithPages
  activeSectionId: string | undefined
  onAddPage?: (folderId: string) => void
  onAddSection?: (pageId: string) => void
  isAdmin: boolean
}

function FolderItem({ folder, activeSectionId, onAddPage, onAddSection, isAdmin }: FolderItemProps) {
  const [open, setOpen] = useState(true)
  const navigate = useNavigate()

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors group"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
        )}
        <Folder className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
        <span className="truncate">{folder.name}</span>
        {isAdmin && onAddPage && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddPage(folder.id) }}
            className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:text-sidebar-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-4"
          >
            {folder.pages.map((page) => (
              <div key={page.id} className="mb-0.5">
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-sidebar-foreground/70 group">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
                  <span className="truncate font-medium">{page.name}</span>
                  {isAdmin && onAddSection && (
                    <button
                      onClick={() => onAddSection(page.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:text-sidebar-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="pl-4">
                  {page.sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => navigate(`/section/${section.id}`)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors',
                        activeSectionId === section.id && 'bg-sidebar-accent text-sidebar-foreground font-medium'
                      )}
                    >
                      <AlignLeft className="h-3 w-3 shrink-0" />
                      <span className="truncate text-left">{section.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Sidebar({
  clientName,
  folders,
  profile,
  onSignOut,
  onAddFolder,
  onAddPage,
  onAddSection,
}: SidebarProps) {
  const { sectionId } = useParams()
  const isAdmin = profile?.role === 'admin'

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
          <AlignLeft className="h-4 w-4 text-sidebar-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Leitor Bef/Aft</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{clientName}</p>
        </div>
      </div>

      {/* Nav tree */}
      <ScrollArea className="flex-1 px-3 py-3">
        {isAdmin && onAddFolder && (
          <button
            onClick={onAddFolder}
            className="mb-3 flex w-full items-center gap-2 rounded-md border border-dashed border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/50 hover:border-sidebar-foreground/30 hover:text-sidebar-foreground/70 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova pasta
          </button>
        )}
        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            activeSectionId={sectionId}
            onAddPage={onAddPage}
            onAddSection={onAddSection}
            isAdmin={isAdmin}
          />
        ))}
        {folders.length === 0 && (
          <p className="px-2 text-xs text-sidebar-foreground/40 italic">
            Nenhuma pasta ainda.
          </p>
        )}
      </ScrollArea>

      {/* User footer */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{profile?.full_name ?? 'Usuário'}</p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize">{profile?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSignOut}
            className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
