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
          analyzed_at: string | null
          content: string | null
          created_at: string
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
          analyzed_at?: string | null
          content?: string | null
          created_at?: string
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
          analyzed_at?: string | null
          content?: string | null
          created_at?: string
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
      projects: {
        Row: {
          allowed_origins: string[] | null
          created_at: string
          description: string | null
          id: string
          name: string
          public_key: string | null
          secret_key: string | null
          source_code_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_origins?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          public_key?: string | null
          secret_key?: string | null
          source_code_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_origins?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          public_key?: string | null
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
      sessions: {
        Row: {
          created_at: string
          first_message_at: string | null
          id: string
          last_activity_at: string | null
          message_count: number | null
          page_title: string | null
          page_url: string | null
          project_id: string
          status: string | null
          updated_at: string
          user_id: string | null
          user_metadata: Json | null
        }
        Insert: {
          created_at?: string
          first_message_at?: string | null
          id: string
          last_activity_at?: string | null
          message_count?: number | null
          page_title?: string | null
          page_url?: string | null
          project_id: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
          user_metadata?: Json | null
        }
        Update: {
          created_at?: string
          first_message_at?: string | null
          id?: string
          last_activity_at?: string | null
          message_count?: number | null
          page_title?: string | null
          page_url?: string | null
          project_id?: string
          status?: string | null
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
      source_codes: {
        Row: {
          commit_sha: string | null
          created_at: string
          id: string
          kind: string | null
          repository_branch: string | null
          repository_url: string | null
          storage_uri: string | null
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
          storage_uri?: string | null
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
          storage_uri?: string | null
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

