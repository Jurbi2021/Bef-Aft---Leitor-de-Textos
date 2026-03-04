import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Save, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface NotesEditorProps {
  value: string
  onSave: (content: string) => Promise<void>
  readOnly?: boolean
}

export function NotesEditor({ value, onSave, readOnly = false }: NotesEditorProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Descreva o que foi feito nesta otimização: principais pontos, mudanças de abordagem, justificativas...',
      }),
    ],
    content: value,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'tiptap px-4 py-3 focus:outline-none text-sm leading-relaxed',
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(editor.commands.setContent as any)(value, false)
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
          <div className="flex items-center gap-0.5 ml-0">
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
