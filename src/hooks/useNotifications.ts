import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { ChatMessage, SectionComment } from '@/lib/database.types'

export interface NotificationItem {
  sourceType: 'chat_message' | 'section_comment' | 'section_approval'
  sourceId: string
  sectionId: string
  body: string
  createdAt: string
  senderName?: string
}

export function useNotifications(
  clientId: string | null,
  userId: string | null,
  isAdmin: boolean = false
) {
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
    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }
    if (!isAdmin && !clientId) {
      setItems([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      const promises: Promise<unknown>[] = []
      if (isAdmin) {
        promises.push(
          supabase.from('approval_notifications').select('id, section_id, section_name, client_name, approval_type, approval_status, created_at').order('created_at', { ascending: false }),
          supabase.from('approval_notification_reads').select('notification_id').eq('user_id', userId!)
        )
      }
      if (clientId) {
        promises.push(
          supabase.from('chat_messages').select('id, body, created_at, client_id').eq('client_id', clientId!).contains('mention_ids', [userId!]),
          supabase.from('section_comments').select('id, section_id, body, created_at').contains('mention_ids', [userId!]),
          supabase.from('mention_reads').select('source_type, source_id').eq('user_id', userId!)
        )
      }
      const results = await Promise.all(promises)
      if (cancelled) return

      const notifItems: NotificationItem[] = []

      if (isAdmin) {
        const approvalRes = results[0] as { data?: { id: string; section_id: string; section_name: string | null; client_name: string | null; approval_type: string; approval_status: string; created_at: string }[] }
        const readsRes = results[1] as { data?: { notification_id: string }[] }
        const readIds = new Set((readsRes.data ?? []).map((r) => r.notification_id))
        for (const n of approvalRes.data ?? []) {
          if (readIds.has(n.id)) continue
          const typeLabel = n.approval_type === 'meta' ? 'Meta tags' : 'Conteúdo'
          const statusLabel = n.approval_status === 'approved' ? 'aprovou' : n.approval_status === 'approved_with_observations' ? 'aprovou com observações' : 'reprovou'
          notifItems.push({
            sourceType: 'section_approval',
            sourceId: n.id,
            sectionId: n.section_id,
            body: `${n.client_name ?? 'Cliente'} ${statusLabel} ${typeLabel}: ${n.section_name ?? 'Seção'}`,
            createdAt: n.created_at,
          })
        }
      }

      if (clientId) {
        const chatRes = results[isAdmin ? 2 : 0] as { data?: { id: string; body: string; created_at: string }[] }
        const commentsRes = results[isAdmin ? 3 : 1] as { data?: { id: string; section_id: string; body: string; created_at: string }[] }
        const readsRes = results[isAdmin ? 4 : 2] as { data?: { source_type: string; source_id: string }[] }
        const readSet = new Set((readsRes.data ?? []).map((r) => `${r.source_type}:${r.source_id}`))
        const firstSection = await fetchFirstSectionOfClient(clientId)
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
      }

      notifItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setItems(notifItems)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [clientId, userId, isAdmin, fetchFirstSectionOfClient])

  const markAsRead = useCallback(
    async (sourceType: 'chat_message' | 'section_comment' | 'section_approval', sourceId: string, sectionId: string) => {
      if (!userId) return
      if (sourceType === 'section_approval') {
        await supabase.from('approval_notification_reads').upsert(
          { user_id: userId, notification_id: sourceId } as object,
          { onConflict: 'user_id,notification_id', ignoreDuplicates: true }
        )
      } else {
        await supabase.from('mention_reads').upsert(
          {
            user_id: userId,
            source_type: sourceType,
            source_id: sourceId,
            section_id: sectionId,
          } as object,
          { onConflict: 'user_id,source_type,source_id', ignoreDuplicates: true }
        )
      }
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
