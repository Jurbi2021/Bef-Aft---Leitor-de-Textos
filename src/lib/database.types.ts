export type Role = 'admin' | 'client'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: Role
          client_id: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          role?: Role
          client_id?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          role?: Role
          client_id?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      folders: {
        Row: {
          id: string
          client_id: string
          name: string
          order: number
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          order?: number
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          order?: number
          created_at?: string
        }
      }
      pages: {
        Row: {
          id: string
          folder_id: string
          name: string
          order: number
          created_at: string
        }
        Insert: {
          id?: string
          folder_id: string
          name: string
          order?: number
          created_at?: string
        }
        Update: {
          id?: string
          folder_id?: string
          name?: string
          order?: number
          created_at?: string
        }
      }
      sections: {
        Row: {
          id: string
          page_id: string
          name: string
          content_before: string
          content_after: string
          defense_note: string
          order: number
          approval_status: 'pending' | 'approved' | 'approved_with_observations' | 'rejected'
          approval_by: string | null
          approval_at: string | null
          approval_note: string | null
          section_type: 'content' | 'serp_preview'
          meta_title: string
          meta_description: string
          meta_url: string
          meta_approval_status: 'pending' | 'approved' | 'approved_with_observations' | 'rejected'
          meta_approval_by: string | null
          meta_approval_at: string | null
          meta_approval_note: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          page_id: string
          name: string
          content_before?: string
          content_after?: string
          defense_note?: string
          order?: number
          section_type?: 'content' | 'serp_preview'
          approval_status?: 'pending' | 'approved' | 'approved_with_observations' | 'rejected'
          approval_by?: string | null
          approval_at?: string | null
          approval_note?: string | null
          meta_title?: string
          meta_description?: string
          meta_url?: string
          meta_approval_status?: 'pending' | 'approved' | 'approved_with_observations' | 'rejected'
          meta_approval_by?: string | null
          meta_approval_at?: string | null
          meta_approval_note?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          name?: string
          content_before?: string
          content_after?: string
          defense_note?: string
          order?: number
          section_type?: 'content' | 'serp_preview'
          approval_status?: 'pending' | 'approved' | 'approved_with_observations' | 'rejected'
          approval_by?: string | null
          approval_at?: string | null
          approval_note?: string | null
          meta_title?: string
          meta_description?: string
          meta_url?: string
          meta_approval_status?: 'pending' | 'approved' | 'approved_with_observations' | 'rejected'
          meta_approval_by?: string | null
          meta_approval_at?: string | null
          meta_approval_note?: string | null
          updated_at?: string
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          client_id: string
          sender_id: string
          body: string
          mention_ids: string[]
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          sender_id: string
          body: string
          mention_ids?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          sender_id?: string
          body?: string
          mention_ids?: string[]
          created_at?: string
        }
      }
      section_comments: {
        Row: {
          id: string
          section_id: string
          sender_id: string
          body: string
          mention_ids: string[]
          created_at: string
        }
        Insert: {
          id?: string
          section_id: string
          sender_id: string
          body: string
          mention_ids?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          sender_id?: string
          body?: string
          mention_ids?: string[]
          created_at?: string
        }
      }
      approval_notifications: {
        Row: {
          id: string
          section_id: string
          client_id: string
          approval_type: 'content' | 'meta'
          approval_status: 'approved' | 'approved_with_observations' | 'rejected'
          approved_by: string
          section_name: string | null
          client_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          section_id: string
          client_id: string
          approval_type: 'content' | 'meta'
          approval_status: 'approved' | 'approved_with_observations' | 'rejected'
          approved_by: string
          section_name?: string | null
          client_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          client_id?: string
          approval_type?: 'content' | 'meta'
          approval_status?: 'approved' | 'approved_with_observations' | 'rejected'
          approved_by?: string
          section_name?: string | null
          client_name?: string | null
          created_at?: string
        }
      }
      approval_notification_reads: {
        Row: {
          id: string
          user_id: string
          notification_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          notification_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          notification_id?: string
          created_at?: string
        }
      }
      mention_reads: {
        Row: {
          id: string
          user_id: string
          source_type: 'chat_message' | 'section_comment'
          source_id: string
          section_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_type: 'chat_message' | 'section_comment'
          source_id: string
          section_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_type?: 'chat_message' | 'section_comment'
          source_id?: string
          section_id?: string | null
          created_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Client = Database['public']['Tables']['clients']['Row']
export type Folder = Database['public']['Tables']['folders']['Row']
export type Page = Database['public']['Tables']['pages']['Row']
export type Section = Database['public']['Tables']['sections']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type SectionComment = Database['public']['Tables']['section_comments']['Row']
export type MentionRead = Database['public']['Tables']['mention_reads']['Row']

export interface FolderWithPages extends Folder {
  pages: PageWithSections[]
}

export interface PageWithSections extends Page {
  sections: Section[]
}
