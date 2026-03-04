import { useEffect, useState, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Save, Check, Heading1, Heading2, Heading3, Pilcrow } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Se o valor for texto puro (sem tags HTML), converte quebras de linha em parágrafos para o TipTap. */
function normalizeInitialContent(value: string): string {
  const t = value?.trim() ?? ''
  if (!t) return ''
  if (t.startsWith('<') && (t.includes('</') || t.includes('/>'))) return value
  return t.split(/\n/).map((line) => `<p>${line ? escapeHtml(line) : '<br>'}</p>`).join('')
}

interface NotesEditorProps {
  value: string
  onSave: (content: string) => Promise<void>
  readOnly?: boolean
}

export function NotesEditor({ value, onSave, readOnly = false }: NotesEditorProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const initialContent = useMemo(() => normalizeInitialContent(value), [value])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Descreva o que foi feito nesta otimização: principais pontos, mudanças de abordagem, justificativas...',
      }),
    ],
    content: initialContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'tiptap px-4 py-3 focus:outline-none text-sm leading-relaxed',
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      const normalized = normalizeInitialContent(value)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(editor.commands.setContent as any)(normalized, false)
    }
  }, [value, editor])

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    await onSave(editor.getHTML())
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!editor) return null

  return (
    <div className="flex flex-col border-t border-border bg-background">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1 border-b border-border/60 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-2">Notas da otimização</span>
          <div className="flex items-center gap-0.5 ml-0 flex-wrap">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                editor.isActive('heading', { level: 1 }) && 'bg-muted text-foreground'
              )}
              title="Título 1"
            >
              <Heading1 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                editor.isActive('heading', { level: 2 }) && 'bg-muted text-foreground'
              )}
              title="Título 2"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                editor.isActive('heading', { level: 3 }) && 'bg-muted text-foreground'
              )}
              title="Título 3"
            >
              <Heading3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                editor.isActive('paragraph') && 'bg-muted text-foreground'
              )}
              title="Parágrafo"
            >
              <Pilcrow className="h-3.5 w-3.5" />
            </button>
            <span className="w-px h-4 bg-border mx-0.5" aria-hidden />
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                editor.isActive('bold') && 'bg-muted text-foreground'
              )}
              title="Negrito"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                editor.isActive('italic') && 'bg-muted text-foreground'
              )}
              title="Itálico"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                editor.isActive('bulletList') && 'bg-muted text-foreground'
              )}
              title="Lista"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                editor.isActive('orderedList') && 'bg-muted text-foreground'
              )}
              title="Lista numerada"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'ml-auto h-7 gap-1.5 text-xs',
              saved && 'bg-green-600 hover:bg-green-600'
            )}
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5" /> Salvo
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
              </>
            )}
          </Button>
        </div>
      )}
      {readOnly && (
        <div className="flex items-center border-b border-border/60 px-4 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">Notas da otimização</span>
        </div>
      )}
      <div className="min-h-[100px] max-h-48 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
