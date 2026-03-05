import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ChatMessage, SectionComment } from '@/lib/database.types'

export interface NotificationItem {
  sourceType: 'chat_message' | 'section_comment'
  sourceId: string
  sectionId: string
  body: string
  createdAt: string
  senderName?: string
}

export function useNotifications(clientId: string | null, userId: string | null) {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFirstSectionOfClient = useCallback(async (cId: string): Promise<string | null> => {
    const { data: firstFolder } = await supabase
      .from('folders')
      .select('id')
      .eq('client_id', cId)
      .order('order', { ascending: true })
      .limit(1)
      .single()
    if (!firstFolder) return null

    const { data: firstPage } = await supabase
      .from('pages')
      .select('id')
      .eq('folder_id', (firstFolder as { id: string }).id)
      .order('order', { ascending: true })
      .limit(1)
      .single()
    if (!firstPage) return null

    const { data: firstSection } = await supabase
      .from('sections')
      .select('id')
      .eq('page_id', (firstPage as { id: string }).id)
      .order('order', { ascending: true })
      .limit(1)
      .single()
    return (firstSection as { id: string } | null)?.id ?? null
  }, [])

  useEffect(() => {
    if (!clientId || !userId) {
      setItems([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      const [chatRes, commentsRes, readsRes] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id, body, created_at, client_id')
          .eq('client_id', clientId!)
          .contains('mention_ids', [userId!]),
        supabase
          .from('section_comments')
          .select('id, section_id, body, created_at')
          .contains('mention_ids', [userId!]),
        supabase
          .from('mention_reads')
          .select('source_type, source_id')
          .eq('user_id', userId!),
      ])

      if (cancelled) return

      const readSet = new Set<string>()
      for (const r of readsRes.data ?? []) {
        readSet.add(`${r.source_type}:${r.source_id}`)
      }

      const firstSection = await fetchFirstSectionOfClient(clientId!)

      const notifItems: NotificationItem[] = []

      for (const msg of (chatRes.data ?? []) as ChatMessage[]) {
        if (readSet.has(`chat_message:${msg.id}`)) continue
        if (firstSection) {
          notifItems.push({
            sourceType: 'chat_message',
            sourceId: msg.id,
            sectionId: firstSection,
            body: msg.body,
            createdAt: msg.created_at,
          })
        }
      }

      for (const cmt of (commentsRes.data ?? []) as SectionComment[]) {
        if (readSet.has(`section_comment:${cmt.id}`)) continue
        notifItems.push({
          sourceType: 'section_comment',
          sourceId: cmt.id,
          sectionId: cmt.section_id,
          body: cmt.body,
          createdAt: cmt.created_at,
        })
      }

      notifItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setItems(notifItems)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [clientId, userId, fetchFirstSectionOfClient])

  const markAsRead = useCallback(
    async (sourceType: 'chat_message' | 'section_comment', sourceId: string, sectionId: string) => {
      if (!userId) return
      await supabase.from('mention_reads').upsert(
        {
          user_id: userId,
          source_type: sourceType,
          source_id: sourceId,
          section_id: sectionId,
        } as object,
        { onConflict: 'user_id,source_type,source_id', ignoreDuplicates: true }
      )
      setItems((prev) => prev.filter((i) => !(i.sourceType === sourceType && i.sourceId === sourceId)))
      navigate(`/section/${sectionId}`)
    },
    [userId, navigate]
  )

  return {
    count: items.length,
    items,
    loading,
    markAsRead,
  }
}
