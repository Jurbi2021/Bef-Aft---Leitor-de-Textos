import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatMessage, SectionComment } from '@/lib/database.types'

export function useChatMessages(clientId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return

    setLoading(true)
    supabase
      .from('chat_messages')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => {
        setMessages(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`chat:${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `client_id=eq.${clientId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId])

  const sendMessage = useCallback(
    async (body: string, senderId: string, mentionIds: string[] = []) => {
      if (!clientId) return
      await supabase.from('chat_messages').insert({
        client_id: clientId,
        sender_id: senderId,
        body,
        mention_ids: mentionIds,
      } as object)
    },
    [clientId]
  )

  return { messages, loading, sendMessage }
}

export function useSectionComments(sectionId: string | null) {
  const [comments, setComments] = useState<SectionComment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sectionId) return

    setLoading(true)
    supabase
      .from('section_comments')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => {
        setComments(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`comments:${sectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'section_comments',
          filter: `section_id=eq.${sectionId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          setComments((prev) => [...prev, payload.new as SectionComment])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sectionId])

  const sendComment = useCallback(
    async (body: string, senderId: string, mentionIds: string[] = []) => {
      if (!sectionId) return
      await supabase.from('section_comments').insert({
        section_id: sectionId,
        sender_id: senderId,
        body,
        mention_ids: mentionIds,
      } as object)
    },
    [sectionId]
  )

  return { comments, loading, sendComment }
}
