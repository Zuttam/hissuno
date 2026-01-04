export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      chat_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          project_id: string
          run_id: string
          session_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          run_id: string
          session_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          run_id?: string
          session_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_sessions: {
        Row: {
          created_at: string
          issue_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          issue_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          issue_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_sessions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_spec_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          issue_id: string
          metadata: Json | null
          project_id: string
          run_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          issue_id: string
          metadata?: Json | null
          project_id: string
          run_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          issue_id?: string
          metadata?: Json | null
          project_id?: string
          run_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_spec_runs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_spec_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          description: string
          id: string
          priority: string
          priority_manual_override: boolean | null
          product_spec: string | null
          product_spec_generated_at: string | null
          project_id: string
          status: string | null
          title: string
          type: string
          updated_at: string
          upvote_count: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          priority?: string
          priority_manual_override?: boolean | null
          product_spec?: string | null
          product_spec_generated_at?: string | null
          project_id: string
          status?: string | null
          title: string
          type: string
          updated_at?: string
          upvote_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          priority?: string
          priority_manual_override?: boolean | null
          product_spec?: string | null
          product_spec_generated_at?: string | null
          project_id?: string
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
          upvote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_packages: {
        Row: {
          category: string
          created_at: string
          generated_at: string
          id: string
          project_id: string
          storage_path: string
          updated_at: string
          version: number
        }
        Insert: {
          category: string
          created_at?: string
          generated_at?: string
          id?: string
          project_id: string
          storage_path: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          created_at?: string
          generated_at?: string
          id?: string
          project_id?: string
          storage_path?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          analysis_scope: string | null
          analyzed_at: string | null
          content: string | null
          created_at: string
          enabled: boolean | null
          error_message: string | null
          id: string
          project_id: string
          status: string
          storage_path: string | null
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          analysis_scope?: string | null
          analyzed_at?: string | null
          content?: string | null
          created_at?: string
          enabled?: boolean | null
          error_message?: string | null
          id?: string
          project_id: string
          status?: string
          storage_path?: string | null
          type: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          analysis_scope?: string | null
          analyzed_at?: string | null
          content?: string | null
          created_at?: string
          enabled?: boolean | null
          error_message?: string | null
          id?: string
          project_id?: string
          status?: string
          storage_path?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_analyses: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          project_id: string
          run_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          run_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          run_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_settings: {
        Row: {
          allowed_origins: string[] | null
          created_at: string
          issue_spec_threshold: number | null
          issue_tracking_enabled: boolean | null
          project_id: string
          session_goodbye_delay_seconds: number | null
          session_idle_response_timeout_seconds: number | null
          session_idle_timeout_minutes: number | null
          spec_guidelines: string | null
          updated_at: string
          widget_initial_message: string | null
          widget_position: string | null
          widget_theme: string | null
          widget_title: string | null
          widget_token_required: boolean | null
          widget_variant: string | null
        }
        Insert: {
          allowed_origins?: string[] | null
          created_at?: string
          issue_spec_threshold?: number | null
          issue_tracking_enabled?: boolean | null
          project_id: string
          session_goodbye_delay_seconds?: number | null
          session_idle_response_timeout_seconds?: number | null
          session_idle_timeout_minutes?: number | null
          spec_guidelines?: string | null
          updated_at?: string
          widget_initial_message?: string | null
          widget_position?: string | null
          widget_theme?: string | null
          widget_title?: string | null
          widget_token_required?: boolean | null
          widget_variant?: string | null
        }
        Update: {
          allowed_origins?: string[] | null
          created_at?: string
          issue_spec_threshold?: number | null
          issue_tracking_enabled?: boolean | null
          project_id?: string
          session_goodbye_delay_seconds?: number | null
          session_idle_response_timeout_seconds?: number | null
          session_idle_timeout_minutes?: number | null
          spec_guidelines?: string | null
          updated_at?: string
          widget_initial_message?: string | null
          widget_position?: string | null
          widget_theme?: string | null
          widget_title?: string | null
          widget_token_required?: boolean | null
          widget_variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          secret_key: string | null
          source_code_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          secret_key?: string | null
          source_code_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          secret_key?: string | null
          source_code_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_source_code_id_fkey"
            columns: ["source_code_id"]
            isOneToOne: false
            referencedRelation: "source_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      session_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          sender_type: string
          sender_user_id: string | null
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          sender_type: string
          sender_user_id?: string | null
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          sender_type?: string
          sender_user_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reviews: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          project_id: string
          result: Json | null
          run_id: string
          session_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          result?: Json | null
          run_id: string
          session_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          result?: Json | null
          run_id?: string
          session_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          first_message_at: string | null
          goodbye_detected_at: string | null
          id: string
          idle_prompt_sent_at: string | null
          last_activity_at: string | null
          message_count: number | null
          page_title: string | null
          page_url: string | null
          pm_reviewed_at: string | null
          project_id: string
          scheduled_close_at: string | null
          source: string | null
          status: string | null
          tags: string[] | null
          tags_auto_applied_at: string | null
          updated_at: string
          user_id: string | null
          user_metadata: Json | null
        }
        Insert: {
          created_at?: string
          first_message_at?: string | null
          goodbye_detected_at?: string | null
          id: string
          idle_prompt_sent_at?: string | null
          last_activity_at?: string | null
          message_count?: number | null
          page_title?: string | null
          page_url?: string | null
          pm_reviewed_at?: string | null
          project_id: string
          scheduled_close_at?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          tags_auto_applied_at?: string | null
          updated_at?: string
          user_id?: string | null
          user_metadata?: Json | null
        }
        Update: {
          created_at?: string
          first_message_at?: string | null
          goodbye_detected_at?: string | null
          id?: string
          idle_prompt_sent_at?: string | null
          last_activity_at?: string | null
          message_count?: number | null
          page_title?: string | null
          page_url?: string | null
          pm_reviewed_at?: string | null
          project_id?: string
          scheduled_close_at?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          tags_auto_applied_at?: string | null
          updated_at?: string
          user_id?: string | null
          user_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_channels: {
        Row: {
          channel_id: string
          channel_name: string | null
          channel_type: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          workspace_primary_domain: string | null
          workspace_token_id: string
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          channel_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          workspace_primary_domain?: string | null
          workspace_token_id: string
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          channel_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          workspace_primary_domain?: string | null
          workspace_token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_channels_workspace_token_id_fkey"
            columns: ["workspace_token_id"]
            isOneToOne: false
            referencedRelation: "slack_workspace_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_thread_sessions: {
        Row: {
          channel_id: string
          created_at: string | null
          has_external_participants: boolean | null
          id: string
          last_message_ts: string | null
          session_id: string
          slack_channel_id: string
          thread_ts: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          has_external_participants?: boolean | null
          id?: string
          last_message_ts?: string | null
          session_id: string
          slack_channel_id: string
          thread_ts: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          has_external_participants?: boolean | null
          id?: string
          last_message_ts?: string | null
          session_id?: string
          slack_channel_id?: string
          thread_ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_thread_sessions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "slack_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slack_thread_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_workspace_tokens: {
        Row: {
          bot_token: string
          bot_user_id: string
          created_at: string | null
          id: string
          installed_by_email: string | null
          installed_by_user_id: string | null
          project_id: string
          scope: string | null
          updated_at: string | null
          workspace_domain: string | null
          workspace_id: string
          workspace_name: string | null
        }
        Insert: {
          bot_token: string
          bot_user_id: string
          created_at?: string | null
          id?: string
          installed_by_email?: string | null
          installed_by_user_id?: string | null
          project_id: string
          scope?: string | null
          updated_at?: string | null
          workspace_domain?: string | null
          workspace_id: string
          workspace_name?: string | null
        }
        Update: {
          bot_token?: string
          bot_user_id?: string
          created_at?: string | null
          id?: string
          installed_by_email?: string | null
          installed_by_user_id?: string | null
          project_id?: string
          scope?: string | null
          updated_at?: string | null
          workspace_domain?: string | null
          workspace_id?: string
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slack_workspace_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      source_codes: {
        Row: {
          commit_sha: string | null
          created_at: string
          id: string
          kind: string | null
          repository_branch: string | null
          repository_url: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          commit_sha?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          repository_branch?: string | null
          repository_url?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          commit_sha?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          repository_branch?: string | null
          repository_url?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_github_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          github_user_id: string | null
          github_username: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          github_user_id?: string | null
          github_username?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          github_user_id?: string | null
          github_username?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_project_key: {
        Args: { prefix: string; random_length: number }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

