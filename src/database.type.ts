export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string | null
          created_by: string
          description: string
          detailed_description: string | null
          features: Json | null
          id: string
          name: string
          site_media_type: string | null
          site_media_url: string | null
          site_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description: string
          detailed_description?: string | null
          features?: Json | null
          id?: string
          name: string
          site_media_type?: string | null
          site_media_url?: string | null
          site_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string
          detailed_description?: string | null
          features?: Json | null
          id?: string
          name?: string
          site_media_type?: string | null
          site_media_url?: string | null
          site_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      announcement_attachments: {
        Row: {
          announcement_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_template_types: {
        Row: {
          code: string
          display_order: number | null
          id: string
          label: string
        }
        Insert: {
          code: string
          display_order?: number | null
          id?: string
          label: string
        }
        Update: {
          code?: string
          display_order?: number | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_template: string
          created_at: string
          id: string
          subject_template: string
          type_code: string
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          id?: string
          subject_template: string
          type_code: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          id?: string
          subject_template?: string
          type_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "email_template_types"
            referencedColumns: ["code"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          retry_count: number
          sent_at: string | null
          status: string
          subject: string
          task_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          retry_count?: number
          sent_at?: string | null
          status: string
          subject: string
          task_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          bundle_id: string | null
          content: string | null
          created_at: string
          deleted_at: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_log_anchor: boolean
          message_type: Database["public"]["Enums"]["message_type"]
          read_by: Json | null
          task_id: string
          user_id: string
        }
        Insert: {
          bundle_id?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_log_anchor?: boolean
          message_type?: Database["public"]["Enums"]["message_type"]
          read_by?: Json | null
          task_id: string
          user_id: string
        }
        Update: {
          bundle_id?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_log_anchor?: boolean
          message_type?: Database["public"]["Enums"]["message_type"]
          read_by?: Json | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at: string | null
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          position: string | null
          profile_completed: boolean | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          phone?: string | null
          position?: string | null
          profile_completed?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          position?: string | null
          profile_completed?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_chat_log_items: {
        Row: {
          id: string
          log_id: string
          message_id: string
          position: number
        }
        Insert: {
          id?: string
          log_id: string
          message_id: string
          position: number
        }
        Update: {
          id?: string
          log_id?: string
          message_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_chat_log_items_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "task_chat_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_chat_log_items_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      task_chat_logs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          log_type: Database["public"]["Enums"]["chat_log_type"]
          task_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          log_type: Database["public"]["Enums"]["chat_log_type"]
          task_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          log_type?: Database["public"]["Enums"]["chat_log_type"]
          task_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_chat_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_chat_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_list_items: {
        Row: {
          created_at: string
          display_order: number
          id: string
          task_id: string
          task_list_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          task_id: string
          task_list_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          task_id?: string
          task_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_list_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_list_items_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      task_lists: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_references: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_references_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_references_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_schedules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_all_day: boolean
          start_time: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_all_day?: boolean
          start_time: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_all_day?: boolean
          start_time?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_schedules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          approved_at: string | null
          assignee_id: string | null
          assigner_id: string | null
          client_name: string | null
          confirm_email_sent_at: string | null
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          is_self_task: boolean
          send_email_to_client: boolean
          task_category: Database["public"]["Enums"]["task_category"]
          task_status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          assignee_id?: string | null
          assigner_id?: string | null
          client_name?: string | null
          confirm_email_sent_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          is_self_task?: boolean
          send_email_to_client?: boolean
          task_category?: Database["public"]["Enums"]["task_category"]
          task_status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          assignee_id?: string | null
          assigner_id?: string | null
          client_name?: string | null
          confirm_email_sent_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          is_self_task?: boolean
          send_email_to_client?: boolean
          task_category?: Database["public"]["Enums"]["task_category"]
          task_status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigner_id_fkey"
            columns: ["assigner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_profile: { Args: { target_user_id: string }; Returns: boolean }
      create_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_notification_type: Database["public"]["Enums"]["notification_type"]
          p_task_id?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      get_active_profiles: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          position: string | null
          profile_completed: boolean | null
          role: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_unread_message_count: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: number
      }
      get_unread_message_counts: {
        Args: { p_task_ids: string[]; p_user_id: string }
        Returns: {
          result_task_id: string
          unread_count: number
        }[]
      }
      get_unread_notification_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      mark_message_as_read: {
        Args: { message_id: string; reader_id: string }
        Returns: undefined
      }
      mark_task_messages_as_read: {
        Args: { reader_id: string; task_id_param: string }
        Returns: undefined
      }
      search_profiles_for_invite: {
        Args: { search_term: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          role: string
        }[]
      }
      send_confirm_email_rpc: {
        Args: {
          p_task_id: string
          p_subject: string
          p_html_body: string
          p_attachment?: Json | null
        }
        Returns: Json
      }
    }
    Enums: {
      chat_log_type: "START" | "REQUEST_CONFIRM" | "APPROVE" | "REJECT"
      message_type: "USER" | "SYSTEM" | "FILE"
      notification_type:
        | "TASK_CREATED"
        | "TASK_STATUS_CHANGED"
        | "TASK_DELETED"
        | "TASK_DUE_DATE_EXCEEDED"
        | "TASK_DUE_DATE_APPROACHING"
      task_category:
        | "REVIEW"
        | "REVISION"
        | "CONTRACT"
        | "SPECIFICATION"
        | "APPLICATION"
      task_status:
        | "ASSIGNED"
        | "IN_PROGRESS"
        | "WAITING_CONFIRM"
        | "APPROVED"
        | "REJECTED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      chat_log_type: ["START", "REQUEST_CONFIRM", "APPROVE", "REJECT"],
      message_type: ["USER", "SYSTEM", "FILE"],
      notification_type: [
        "TASK_CREATED",
        "TASK_STATUS_CHANGED",
        "TASK_DELETED",
        "TASK_DUE_DATE_EXCEEDED",
        "TASK_DUE_DATE_APPROACHING",
      ],
      task_category: [
        "REVIEW",
        "REVISION",
        "CONTRACT",
        "SPECIFICATION",
        "APPLICATION",
      ],
      task_status: [
        "ASSIGNED",
        "IN_PROGRESS",
        "WAITING_CONFIRM",
        "APPROVED",
        "REJECTED",
      ],
    },
  },
} as const
