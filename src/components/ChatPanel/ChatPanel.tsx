import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, AlignLeft, PanelRightClose } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { useChatMessages, useSectionComments } from '@/hooks/useRealtime'
import { supabase } from '@/lib/supabase'
import type { ChatMessage, SectionComment } from '@/lib/database.types'

interface ChatPanelProps {
  clientId: string
  sectionId: string
  currentUserId: string
  currentUserName: string | null
}

function parseMentions(body: string): { type: 'text' | 'mention'; value: string }[] {
  const segments: { type: 'text' | 'mention'; value: string }[] = []
  const re = /@(\S+)/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, m.index) })
    }
    segments.push({ type: 'mention', value: m[1] })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', value: body.slice(lastIndex) })
  }
  return segments.length ? segments : [{ type: 'text', value: body }]
}

interface MessageBubbleProps {
  body: string
  senderId: string
  currentUserId: string
  senderName?: string
  createdAt: string
}

function MessageBubble({ body, senderId, currentUserId, senderName, createdAt }: MessageBubbleProps) {
  const isOwn = senderId === currentUserId
  const initials = senderName ? senderName.charAt(0).toUpperCase() : '?'
  const segments = parseMentions(body)

  return (
    <div className={cn('flex gap-2 mb-3', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarFallback className={cn('text-[10px]', isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className={cn('flex flex-col gap-0.5 max-w-[75%]', isOwn ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          )}
        >
          {segments.map((seg, i) =>
            seg.type === 'mention' ? (
              <span
                key={i}
                className={cn(
                  'font-medium px-0.5 rounded',
                  isOwn ? 'bg-white/25' : 'bg-primary/20 text-primary'
                )}
              >
                @{seg.value}
              </span>
            ) : (
              <span key={i}>{seg.value}</span>
            )
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(createdAt), 'HH:mm', { locale: ptBR })}
        </span>
      </div>
    </div>
  )
}

function MessageList({
  messages,
  currentUserId,
  currentUserName,
}: {
  messages: (ChatMessage | SectionComment)[]
  currentUserId: string
  currentUserName: string | null
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <ScrollArea className="flex-1 px-3 py-3">
      {messages.length === 0 && (
        <p className="text-center text-xs text-muted-foreground italic mt-8">
          Nenhuma mensagem ainda. Seja o primeiro!
        </p>
      )}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          body={msg.body}
          senderId={msg.sender_id}
          currentUserId={currentUserId}
          senderName={msg.sender_id === currentUserId ? currentUserName ?? undefined : undefined}
          createdAt={msg.created_at}
        />
      ))}
      <div ref={bottomRef} />
    </ScrollArea>
  )
}

function MessageInput({
  onSend,
  placeholder,
  mentionableUsers,
}: {
  onSend: (body: string, mentionIds: string[]) => void
  placeholder: string
  mentionableUsers: { id: string; full_name: string | null }[]
}) {
  const [value, setValue] = useState('')
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [showMention, setShowMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredUsers = mentionableUsers.filter((u) => {
    const name = (u.full_name || '').toLowerCase()
    return name.includes(mentionQuery.toLowerCase())
  })

  useEffect(() => {
    const lastAt = value.lastIndexOf('@')
    if (lastAt === -1) {
      setShowMention(false)
      return
    }
    const afterAt = value.slice(lastAt + 1)
    if (/\s/.test(afterAt)) {
      setShowMention(false)
      return
    }
    setShowMention(true)
    setMentionQuery(afterAt)
  }, [value])

  function chooseMention(user: { id: string; full_name: string | null }) {
    const name = user.full_name || 'Sem nome'
    const lastAt = value.lastIndexOf('@')
    const before = value.slice(0, lastAt)
    const after = value.slice(lastAt).replace(/@[^\s]*$/, `@${name} `)
    setValue(before + after)
    setMentionIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]))
    setShowMention(false)
    inputRef.current?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed, mentionIds)
    setValue('')
    setMentionIds([])
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col border-t border-border p-3">
      <div className="relative flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="text-sm"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={!value.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {showMention && (
        <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-background py-1 shadow-md">
          {filteredUsers.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum usuário</p>
          ) : (
            filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => chooseMention(u)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{u.full_name || 'Sem nome'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </form>
  )
}

export function ChatPanel({ clientId, sectionId, currentUserId, currentUserName }: ChatPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [mentionableUsers, setMentionableUsers] = useState<{ id: string; full_name: string | null }[]>([])
  const { messages: chatMessages, sendMessage } = useChatMessages(clientId)
  const { comments, sendComment } = useSectionComments(sectionId)

  useEffect(() => {
    if (!clientId) return
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('client_id', clientId)
      .neq('id', currentUserId)
      .then(({ data }: { data: { id: string; full_name: string | null }[] | null }) => setMentionableUsers(data ?? []))
  }, [clientId, currentUserId])

  async function handleSendChat(body: string, mentionIds: string[]) {
    await sendMessage(body, currentUserId, mentionIds)
  }

  async function handleSendComment(body: string, mentionIds: string[]) {
    await sendComment(body, currentUserId, mentionIds)
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex h-full w-10 shrink-0 flex-col items-center justify-center gap-1 border-l border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        title="Abrir chat"
      >
        <span className="flex flex-col text-xs font-semibold tracking-widest select-none">
          {'CHAT'.split('').map((letter) => (
            <span key={letter}>{letter}</span>
            
          ))}
        </span>
        <span className="text-base leading-none" aria-hidden> 💬</span>
      </button>
    )
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Chat</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(false)}
          title="Recolher chat"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <Tabs defaultValue="comments" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-3 pt-2 pb-0">
          <TabsList className="w-full">
            <TabsTrigger value="comments" className="flex-1 gap-1.5 text-xs">
              <AlignLeft className="h-3.5 w-3.5" />
              Seção
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1 gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Geral
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="comments" className="flex flex-1 flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
          <MessageList
            messages={comments}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
          <MessageInput
            onSend={handleSendComment}
            placeholder="Comentário nesta seção... (use @ para marcar)"
            mentionableUsers={mentionableUsers}
          />
        </TabsContent>

        <TabsContent value="chat" className="flex flex-1 flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
          <MessageList
            messages={chatMessages}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
          <MessageInput
            onSend={handleSendChat}
            placeholder="Mensagem geral... (use @ para marcar)"
            mentionableUsers={mentionableUsers}
          />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
