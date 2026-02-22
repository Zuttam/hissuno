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
      companies: {
        Row: {
          arr: number | null
          country: string | null
          created_at: string
          custom_fields: Json | null
          domain: string
          employee_count: number | null
          health_score: number | null
          id: string
          industry: string | null
          is_archived: boolean | null
          name: string
          notes: string | null
          plan_tier: string | null
          product_used: string | null
          project_id: string
          renewal_date: string | null
          stage: string | null
          updated_at: string
        }
        Insert: {
          arr?: number | null
          country?: string | null
          created_at?: string
          custom_fields?: Json | null
          domain: string
          employee_count?: number | null
          health_score?: number | null
          id?: string
          industry?: string | null
          is_archived?: boolean | null
          name: string
          notes?: string | null
          plan_tier?: string | null
          product_used?: string | null
          project_id: string
          renewal_date?: string | null
          stage?: string | null
          updated_at?: string
        }
        Update: {
          arr?: number | null
          country?: string | null
          created_at?: string
          custom_fields?: Json | null
          domain?: string
          employee_count?: number | null
          health_score?: number | null
          id?: string
          industry?: string | null
          is_archived?: boolean | null
          name?: string
          notes?: string | null
          plan_tier?: string | null
          product_used?: string | null
          project_id?: string
          renewal_date?: string | null
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          company_url: string | null
          created_at: string
          custom_fields: Json | null
          email: string
          id: string
          is_archived: boolean | null
          is_champion: boolean | null
          last_contacted_at: string | null
          name: string
          notes: string | null
          phone: string | null
          project_id: string
          role: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          company_url?: string | null
          created_at?: string
          custom_fields?: Json | null
          email: string
          id?: string
          is_archived?: boolean | null
          is_champion?: boolean | null
          last_contacted_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          project_id: string
          role?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          company_url?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string
          id?: string
          is_archived?: boolean | null
          is_champion?: boolean | null
          last_contacted_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          role?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_tags: {
        Row: {
          color: string | null
          created_at: string
          description: string
          id: string
          name: string
          position: number
          project_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description: string
          id?: string
          name: string
          position?: number
          project_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          project_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_custom_field_definitions: {
        Row: {
          created_at: string
          entity_type: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean | null
          position: number
          project_id: string
          select_options: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          field_key: string
          field_label: string
          field_type: string
          id?: string
          is_required?: boolean | null
          position?: number
          project_id: string
          select_options?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          position?: number
          project_id?: string
          select_options?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_custom_field_definitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      github_app_installations: {
        Row: {
          access_token: string | null
          account_id: number
          account_login: string
          created_at: string | null
          id: string
          installation_id: number | null
          installed_by_email: string | null
          installed_by_user_id: string | null
          project_id: string
          scope: string | null
          target_type: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          account_id: number
          account_login: string
          created_at?: string | null
          id?: string
          installation_id?: number | null
          installed_by_email?: string | null
          installed_by_user_id?: string | null
          project_id: string
          scope?: string | null
          target_type?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: number
          account_login?: string
          created_at?: string | null
          id?: string
          installation_id?: number | null
          installed_by_email?: string | null
          installed_by_user_id?: string | null
          project_id?: string
          scope?: string | null
          target_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "github_app_installations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gong_connections: {
        Row: {
          access_key: string
          access_key_secret: string
          base_url: string
          created_at: string
          filter_config: Json | null
          id: string
          last_sync_at: string | null
          last_sync_calls_count: number | null
          last_sync_error: string | null
          last_sync_status: string | null
          next_sync_at: string | null
          project_id: string
          sync_enabled: boolean
          sync_frequency: string
          updated_at: string
        }
        Insert: {
          access_key: string
          access_key_secret: string
          base_url?: string
          created_at?: string
          filter_config?: Json | null
          id?: string
          last_sync_at?: string | null
          last_sync_calls_count?: number | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          next_sync_at?: string | null
          project_id: string
          sync_enabled?: boolean
          sync_frequency?: string
          updated_at?: string
        }
        Update: {
          access_key?: string
          access_key_secret?: string
          base_url?: string
          created_at?: string
          filter_config?: Json | null
          id?: string
          last_sync_at?: string | null
          last_sync_calls_count?: number | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          next_sync_at?: string | null
          project_id?: string
          sync_enabled?: boolean
          sync_frequency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gong_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gong_sync_runs: {
        Row: {
          calls_found: number | null
          calls_skipped: number | null
          calls_synced: number | null
          completed_at: string | null
          connection_id: string
          error_message: string | null
          id: string
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          calls_found?: number | null
          calls_skipped?: number | null
          calls_synced?: number | null
          completed_at?: string | null
          connection_id: string
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by: string
        }
        Update: {
          calls_found?: number | null
          calls_skipped?: number | null
          calls_synced?: number | null
          completed_at?: string | null
          connection_id?: string
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "gong_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gong_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      gong_synced_calls: {
        Row: {
          call_created_at: string | null
          call_duration_seconds: number | null
          connection_id: string
          gong_call_id: string
          id: string
          messages_count: number | null
          session_id: string
          synced_at: string
        }
        Insert: {
          call_created_at?: string | null
          call_duration_seconds?: number | null
          connection_id: string
          gong_call_id: string
          id?: string
          messages_count?: number | null
          session_id: string
          synced_at?: string
        }
        Update: {
          call_created_at?: string | null
          call_duration_seconds?: number | null
          connection_id?: string
          gong_call_id?: string
          id?: string
          messages_count?: number | null
          session_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gong_synced_calls_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gong_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gong_synced_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      intercom_connections: {
        Row: {
          access_token: string
          auth_method: string
          created_at: string
          filter_config: Json | null
          id: string
          last_sync_at: string | null
          last_sync_conversations_count: number | null
          last_sync_error: string | null
          last_sync_status: string | null
          next_sync_at: string | null
          project_id: string
          sync_enabled: boolean
          sync_frequency: string
          updated_at: string
          workspace_id: string
          workspace_name: string | null
        }
        Insert: {
          access_token: string
          auth_method?: string
          created_at?: string
          filter_config?: Json | null
          id?: string
          last_sync_at?: string | null
          last_sync_conversations_count?: number | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          next_sync_at?: string | null
          project_id: string
          sync_enabled?: boolean
          sync_frequency?: string
          updated_at?: string
          workspace_id: string
          workspace_name?: string | null
        }
        Update: {
          access_token?: string
          auth_method?: string
          created_at?: string
          filter_config?: Json | null
          id?: string
          last_sync_at?: string | null
          last_sync_conversations_count?: number | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          next_sync_at?: string | null
          project_id?: string
          sync_enabled?: boolean
          sync_frequency?: string
          updated_at?: string
          workspace_id?: string
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intercom_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      intercom_sync_runs: {
        Row: {
          completed_at: string | null
          connection_id: string
          conversations_found: number | null
          conversations_skipped: number | null
          conversations_synced: number | null
          error_message: string | null
          id: string
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          conversations_found?: number | null
          conversations_skipped?: number | null
          conversations_synced?: number | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          conversations_found?: number | null
          conversations_skipped?: number | null
          conversations_synced?: number | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercom_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "intercom_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      intercom_synced_conversations: {
        Row: {
          connection_id: string
          conversation_created_at: string | null
          conversation_updated_at: string | null
          id: string
          intercom_conversation_id: string
          parts_count: number | null
          session_id: string
          synced_at: string
        }
        Insert: {
          connection_id: string
          conversation_created_at?: string | null
          conversation_updated_at?: string | null
          id?: string
          intercom_conversation_id: string
          parts_count?: number | null
          session_id: string
          synced_at?: string
        }
        Update: {
          connection_id?: string
          conversation_created_at?: string | null
          conversation_updated_at?: string | null
          id?: string
          intercom_conversation_id?: string
          parts_count?: number | null
          session_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercom_synced_conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "intercom_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercom_synced_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          claimed_at: string | null
          claimed_by_user_id: string | null
          code: string
          created_at: string
          expires_at: string | null
          id: string
          owner_user_id: string
          promotion_code: string | null
          promotion_description: string | null
          target_email: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_user_id: string
          promotion_code?: string | null
          promotion_description?: string | null
          target_email?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_user_id?: string
          promotion_code?: string | null
          promotion_description?: string | null
          target_email?: string | null
        }
        Relationships: []
      }
      issue_analysis_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          issue_id: string
          metadata: Json | null
          project_id: string
          run_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          issue_id: string
          metadata?: Json | null
          project_id: string
          run_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          issue_id?: string
          metadata?: Json | null
          project_id?: string
          run_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_analysis_runs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_analysis_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_embeddings: {
        Row: {
          created_at: string
          embedding: string
          id: string
          issue_id: string
          project_id: string
          text_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          embedding: string
          id?: string
          issue_id: string
          project_id: string
          text_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          embedding?: string
          id?: string
          issue_id?: string
          project_id?: string
          text_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_embeddings_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: true
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_embeddings_project_id_fkey"
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
          affected_areas: string[] | null
          affected_files: string[] | null
          analysis_computed_at: string | null
          confidence_reasoning: string | null
          confidence_score: number | null
          created_at: string
          description: string
          effort_estimate: string | null
          effort_reasoning: string | null
          effort_score: number | null
          id: string
          impact_analysis: Json | null
          impact_score: number | null
          is_archived: boolean
          priority: string
          priority_manual_override: boolean | null
          product_spec: string | null
          product_spec_generated_at: string | null
          project_id: string
          reach_reasoning: string | null
          reach_score: number | null
          status: string | null
          title: string
          type: string
          updated_at: string
          upvote_count: number | null
        }
        Insert: {
          affected_areas?: string[] | null
          affected_files?: string[] | null
          analysis_computed_at?: string | null
          confidence_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string
          description: string
          effort_estimate?: string | null
          effort_reasoning?: string | null
          effort_score?: number | null
          id?: string
          impact_analysis?: Json | null
          impact_score?: number | null
          is_archived?: boolean
          priority?: string
          priority_manual_override?: boolean | null
          product_spec?: string | null
          product_spec_generated_at?: string | null
          project_id: string
          reach_reasoning?: string | null
          reach_score?: number | null
          status?: string | null
          title: string
          type: string
          updated_at?: string
          upvote_count?: number | null
        }
        Update: {
          affected_areas?: string[] | null
          affected_files?: string[] | null
          analysis_computed_at?: string | null
          confidence_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string
          description?: string
          effort_estimate?: string | null
          effort_reasoning?: string | null
          effort_score?: number | null
          id?: string
          impact_analysis?: Json | null
          impact_score?: number | null
          is_archived?: boolean
          priority?: string
          priority_manual_override?: boolean | null
          product_spec?: string | null
          product_spec_generated_at?: string | null
          project_id?: string
          reach_reasoning?: string | null
          reach_score?: number | null
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
      jira_connections: {
        Row: {
          access_token: string
          auto_sync_enabled: boolean
          cloud_id: string
          created_at: string
          id: string
          installed_by_email: string | null
          installed_by_user_id: string | null
          is_enabled: boolean
          issue_type_id: string | null
          issue_type_name: string | null
          jira_project_id: string | null
          jira_project_key: string | null
          project_id: string
          refresh_token: string
          site_url: string
          token_expires_at: string
          updated_at: string
          webhook_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token: string
          auto_sync_enabled?: boolean
          cloud_id: string
          created_at?: string
          id?: string
          installed_by_email?: string | null
          installed_by_user_id?: string | null
          is_enabled?: boolean
          issue_type_id?: string | null
          issue_type_name?: string | null
          jira_project_id?: string | null
          jira_project_key?: string | null
          project_id: string
          refresh_token: string
          site_url: string
          token_expires_at: string
          updated_at?: string
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string
          auto_sync_enabled?: boolean
          cloud_id?: string
          created_at?: string
          id?: string
          installed_by_email?: string | null
          installed_by_user_id?: string | null
          is_enabled?: boolean
          issue_type_id?: string | null
          issue_type_name?: string | null
          jira_project_id?: string | null
          jira_project_key?: string | null
          project_id?: string
          refresh_token?: string
          site_url?: string
          token_expires_at?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jira_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jira_issue_syncs: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          issue_id: string
          jira_issue_id: string | null
          jira_issue_key: string | null
          jira_issue_url: string | null
          last_jira_status: string | null
          last_sync_action: string | null
          last_sync_error: string | null
          last_sync_status: string
          last_synced_at: string | null
          last_webhook_received_at: string | null
          retry_count: number
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          issue_id: string
          jira_issue_id?: string | null
          jira_issue_key?: string | null
          jira_issue_url?: string | null
          last_jira_status?: string | null
          last_sync_action?: string | null
          last_sync_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          last_webhook_received_at?: string | null
          retry_count?: number
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          issue_id?: string
          jira_issue_id?: string | null
          jira_issue_key?: string | null
          jira_issue_url?: string | null
          last_jira_status?: string | null
          last_sync_action?: string | null
          last_sync_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          last_webhook_received_at?: string | null
          retry_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "jira_issue_syncs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "jira_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jira_issue_syncs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: true
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_embeddings: {
        Row: {
          category: string
          chunk_end_line: number | null
          chunk_index: number
          chunk_start_line: number | null
          chunk_text: string
          created_at: string
          embedding: string
          id: string
          named_package_id: string | null
          package_id: string
          parent_headings: string[] | null
          project_id: string
          section_heading: string | null
          updated_at: string
          version: number
        }
        Insert: {
          category: string
          chunk_end_line?: number | null
          chunk_index: number
          chunk_start_line?: number | null
          chunk_text: string
          created_at?: string
          embedding: string
          id?: string
          named_package_id?: string | null
          package_id: string
          parent_headings?: string[] | null
          project_id: string
          section_heading?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          chunk_end_line?: number | null
          chunk_index?: number
          chunk_start_line?: number | null
          chunk_text?: string
          created_at?: string
          embedding?: string
          id?: string
          named_package_id?: string | null
          package_id?: string
          parent_headings?: string[] | null
          project_id?: string
          section_heading?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_embeddings_named_package_id_fkey"
            columns: ["named_package_id"]
            isOneToOne: false
            referencedRelation: "named_knowledge_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_embeddings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "knowledge_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_embeddings_project_id_fkey"
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
          named_package_id: string | null
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
          named_package_id?: string | null
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
          named_package_id?: string | null
          project_id?: string
          storage_path?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_packages_named_package_id_fkey"
            columns: ["named_package_id"]
            isOneToOne: false
            referencedRelation: "named_knowledge_packages"
            referencedColumns: ["id"]
          },
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
          source_code_id: string | null
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
          source_code_id?: string | null
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
          source_code_id?: string | null
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
          {
            foreignKeyName: "knowledge_sources_source_code_id_fkey"
            columns: ["source_code_id"]
            isOneToOne: false
            referencedRelation: "source_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      linear_connections: {
        Row: {
          access_token: string
          auto_sync_enabled: boolean
          created_at: string
          id: string
          installed_by_email: string | null
          installed_by_user_id: string | null
          is_enabled: boolean
          organization_id: string
          organization_name: string
          project_id: string
          refresh_token: string
          team_id: string | null
          team_key: string | null
          team_name: string | null
          token_expires_at: string
          updated_at: string
          webhook_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token: string
          auto_sync_enabled?: boolean
          created_at?: string
          id?: string
          installed_by_email?: string | null
          installed_by_user_id?: string | null
          is_enabled?: boolean
          organization_id: string
          organization_name: string
          project_id: string
          refresh_token: string
          team_id?: string | null
          team_key?: string | null
          team_name?: string | null
          token_expires_at: string
          updated_at?: string
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string
          auto_sync_enabled?: boolean
          created_at?: string
          id?: string
          installed_by_email?: string | null
          installed_by_user_id?: string | null
          is_enabled?: boolean
          organization_id?: string
          organization_name?: string
          project_id?: string
          refresh_token?: string
          team_id?: string | null
          team_key?: string | null
          team_name?: string | null
          token_expires_at?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linear_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      linear_issue_syncs: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          issue_id: string
          last_linear_state: string | null
          last_linear_state_type: string | null
          last_sync_action: string | null
          last_sync_error: string | null
          last_sync_status: string
          last_synced_at: string | null
          last_webhook_received_at: string | null
          linear_issue_id: string | null
          linear_issue_identifier: string | null
          linear_issue_url: string | null
          retry_count: number
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          issue_id: string
          last_linear_state?: string | null
          last_linear_state_type?: string | null
          last_sync_action?: string | null
          last_sync_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          last_webhook_received_at?: string | null
          linear_issue_id?: string | null
          linear_issue_identifier?: string | null
          linear_issue_url?: string | null
          retry_count?: number
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          issue_id?: string
          last_linear_state?: string | null
          last_linear_state_type?: string | null
          last_sync_action?: string | null
          last_sync_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          last_webhook_received_at?: string | null
          linear_issue_id?: string | null
          linear_issue_identifier?: string | null
          linear_issue_url?: string | null
          retry_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "linear_issue_syncs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "linear_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linear_issue_syncs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: true
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      named_knowledge_packages: {
        Row: {
          created_at: string
          description: string | null
          guidelines: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          guidelines?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          guidelines?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "named_knowledge_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      named_package_sources: {
        Row: {
          created_at: string
          id: string
          package_id: string
          source_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          source_id: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "named_package_sources_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "named_knowledge_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "named_package_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
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
      project_api_keys: {
        Row: {
          created_at: string
          created_by_user_id: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          project_id: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          project_id: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          project_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          invited_email: string | null
          project_id: string
          role: string
          signup_invite_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          invited_email?: string | null
          project_id: string
          role?: string
          signup_invite_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          invited_email?: string | null
          project_id?: string
          role?: string
          signup_invite_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_signup_invite_id_fkey"
            columns: ["signup_invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      project_settings: {
        Row: {
          allowed_origins: string[] | null
          analysis_guidelines: string | null
          classification_guidelines: string | null
          created_at: string
          issue_tracking_enabled: boolean | null
          pm_dedup_include_closed: boolean | null
          project_id: string
          session_goodbye_delay_seconds: number | null
          session_idle_response_timeout_seconds: number | null
          session_idle_timeout_minutes: number | null
          spec_guidelines: string | null
          support_agent_package_id: string | null
          updated_at: string
          widget_display_type: string | null
          widget_drawer_badge_label: string | null
          widget_initial_message: string | null
          widget_position: string | null
          widget_shortcut: string | null
          widget_theme: string | null
          widget_title: string | null
          widget_token_required: boolean | null
          widget_trigger_type: string | null
          widget_variant: string | null
        }
        Insert: {
          allowed_origins?: string[] | null
          analysis_guidelines?: string | null
          classification_guidelines?: string | null
          created_at?: string
          issue_tracking_enabled?: boolean | null
          pm_dedup_include_closed?: boolean | null
          project_id: string
          session_goodbye_delay_seconds?: number | null
          session_idle_response_timeout_seconds?: number | null
          session_idle_timeout_minutes?: number | null
          spec_guidelines?: string | null
          support_agent_package_id?: string | null
          updated_at?: string
          widget_display_type?: string | null
          widget_drawer_badge_label?: string | null
          widget_initial_message?: string | null
          widget_position?: string | null
          widget_shortcut?: string | null
          widget_theme?: string | null
          widget_title?: string | null
          widget_token_required?: boolean | null
          widget_trigger_type?: string | null
          widget_variant?: string | null
        }
        Update: {
          allowed_origins?: string[] | null
          analysis_guidelines?: string | null
          classification_guidelines?: string | null
          created_at?: string
          issue_tracking_enabled?: boolean | null
          pm_dedup_include_closed?: boolean | null
          project_id?: string
          session_goodbye_delay_seconds?: number | null
          session_idle_response_timeout_seconds?: number | null
          session_idle_timeout_minutes?: number | null
          spec_guidelines?: string | null
          support_agent_package_id?: string | null
          updated_at?: string
          widget_display_type?: string | null
          widget_drawer_badge_label?: string | null
          widget_initial_message?: string | null
          widget_position?: string | null
          widget_shortcut?: string | null
          widget_theme?: string | null
          widget_title?: string | null
          widget_token_required?: boolean | null
          widget_trigger_type?: string | null
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
          {
            foreignKeyName: "project_settings_support_agent_package_id_fkey"
            columns: ["support_agent_package_id"]
            isOneToOne: false
            referencedRelation: "named_knowledge_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          secret_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          secret_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          secret_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          contact_id: string | null
          created_at: string
          first_message_at: string | null
          goodbye_detected_at: string | null
          human_takeover_at: string | null
          id: string
          idle_prompt_sent_at: string | null
          is_archived: boolean
          is_human_takeover: boolean
          last_activity_at: string | null
          message_count: number | null
          name: string | null
          page_title: string | null
          page_url: string | null
          pm_reviewed_at: string | null
          project_id: string
          scheduled_close_at: string | null
          session_type: string
          source: string | null
          status: string | null
          tags: string[] | null
          tags_auto_applied_at: string | null
          updated_at: string
          user_id: string | null
          user_metadata: Json | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          first_message_at?: string | null
          goodbye_detected_at?: string | null
          human_takeover_at?: string | null
          id: string
          idle_prompt_sent_at?: string | null
          is_archived?: boolean
          is_human_takeover?: boolean
          last_activity_at?: string | null
          message_count?: number | null
          name?: string | null
          page_title?: string | null
          page_url?: string | null
          pm_reviewed_at?: string | null
          project_id: string
          scheduled_close_at?: string | null
          session_type?: string
          source?: string | null
          status?: string | null
          tags?: string[] | null
          tags_auto_applied_at?: string | null
          updated_at?: string
          user_id?: string | null
          user_metadata?: Json | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          first_message_at?: string | null
          goodbye_detected_at?: string | null
          human_takeover_at?: string | null
          id?: string
          idle_prompt_sent_at?: string | null
          is_archived?: boolean
          is_human_takeover?: boolean
          last_activity_at?: string | null
          message_count?: number | null
          name?: string | null
          page_title?: string | null
          page_url?: string | null
          pm_reviewed_at?: string | null
          project_id?: string
          scheduled_close_at?: string | null
          session_type?: string
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
            foreignKeyName: "sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
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
          capture_scope: string | null
          channel_id: string
          channel_mode: string | null
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
          capture_scope?: string | null
          channel_id: string
          channel_mode?: string | null
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
          capture_scope?: string | null
          channel_id?: string
          channel_mode?: string | null
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
          last_bot_response_ts: string | null
          last_message_ts: string | null
          last_responder_type: string | null
          session_id: string
          slack_channel_id: string
          thread_ts: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          has_external_participants?: boolean | null
          id?: string
          last_bot_response_ts?: string | null
          last_message_ts?: string | null
          last_responder_type?: string | null
          session_id: string
          slack_channel_id: string
          thread_ts: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          has_external_participants?: boolean | null
          id?: string
          last_bot_response_ts?: string | null
          last_message_ts?: string | null
          last_responder_type?: string | null
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
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          issues_limit: number | null
          lemon_squeezy_customer_id: string | null
          lemon_squeezy_subscription_id: string | null
          plan_id: string
          plan_name: string | null
          sessions_limit: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          issues_limit?: number | null
          lemon_squeezy_customer_id?: string | null
          lemon_squeezy_subscription_id?: string | null
          plan_id: string
          plan_name?: string | null
          sessions_limit?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          issues_limit?: number | null
          lemon_squeezy_customer_id?: string | null
          lemon_squeezy_subscription_id?: string | null
          plan_id?: string
          plan_name?: string | null
          sessions_limit?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          channel: string
          dedup_key: string | null
          dismissed_at: string | null
          id: string
          metadata: Json | null
          project_id: string | null
          sent_at: string
          type: string
          user_id: string
        }
        Insert: {
          channel?: string
          dedup_key?: string | null
          dismissed_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          sent_at?: string
          type: string
          user_id: string
        }
        Update: {
          channel?: string
          dedup_key?: string | null
          dismissed_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          sent_at?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          billing_skipped: boolean
          communication_channels: string[] | null
          company_name: string | null
          company_size: string | null
          created_at: string
          full_name: string | null
          id: string
          is_activated: boolean
          notification_preferences: Json | null
          notifications_silenced: boolean
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          onboarding_current_step: string | null
          role: string | null
          slack_notification_channel: string | null
          slack_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_skipped?: boolean
          communication_channels?: string[] | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_activated?: boolean
          notification_preferences?: Json | null
          notifications_silenced?: boolean
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_current_step?: string | null
          role?: string | null
          slack_notification_channel?: string | null
          slack_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_skipped?: boolean
          communication_channels?: string[] | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_activated?: boolean
          notification_preferences?: Json | null
          notifications_silenced?: boolean
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_current_step?: string | null
          role?: string | null
          slack_notification_channel?: string | null
          slack_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
          source: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          source?: string | null
          type?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          source?: string | null
          type?: string
        }
        Relationships: []
      }
      zendesk_connections: {
        Row: {
          account_name: string | null
          admin_email: string
          api_token: string
          created_at: string
          filter_config: Json | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_sync_tickets_count: number | null
          next_sync_at: string | null
          project_id: string
          subdomain: string
          sync_enabled: boolean
          sync_frequency: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          admin_email: string
          api_token: string
          created_at?: string
          filter_config?: Json | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_sync_tickets_count?: number | null
          next_sync_at?: string | null
          project_id: string
          subdomain: string
          sync_enabled?: boolean
          sync_frequency?: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          admin_email?: string
          api_token?: string
          created_at?: string
          filter_config?: Json | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_sync_tickets_count?: number | null
          next_sync_at?: string | null
          project_id?: string
          subdomain?: string
          sync_enabled?: boolean
          sync_frequency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zendesk_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zendesk_sync_runs: {
        Row: {
          completed_at: string | null
          connection_id: string
          error_message: string | null
          id: string
          started_at: string
          status: string
          tickets_found: number | null
          tickets_skipped: number | null
          tickets_synced: number | null
          triggered_by: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          tickets_found?: number | null
          tickets_skipped?: number | null
          tickets_synced?: number | null
          triggered_by: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          tickets_found?: number | null
          tickets_skipped?: number | null
          tickets_synced?: number | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "zendesk_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "zendesk_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      zendesk_synced_tickets: {
        Row: {
          comments_count: number | null
          connection_id: string
          id: string
          session_id: string
          synced_at: string
          ticket_created_at: string | null
          ticket_updated_at: string | null
          zendesk_ticket_id: number
        }
        Insert: {
          comments_count?: number | null
          connection_id: string
          id?: string
          session_id: string
          synced_at?: string
          ticket_created_at?: string | null
          ticket_updated_at?: string | null
          zendesk_ticket_id: number
        }
        Update: {
          comments_count?: number | null
          connection_id?: string
          id?: string
          session_id?: string
          synced_at?: string
          ticket_created_at?: string | null
          ticket_updated_at?: string | null
          zendesk_ticket_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "zendesk_synced_tickets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "zendesk_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zendesk_synced_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_waitlist_rate_limit: {
        Args: { client_ip: string }
        Returns: boolean
      }
      generate_project_key: {
        Args: { prefix: string; random_length: number }
        Returns: string
      }
      search_knowledge_embeddings: {
        Args: {
          p_categories?: string[]
          p_limit?: number
          p_named_package_id?: string
          p_project_id: string
          p_query_embedding: string
          p_similarity_threshold?: number
        }
        Returns: {
          category: string
          chunk_text: string
          id: string
          parent_headings: string[]
          section_heading: string
          similarity: number
        }[]
      }
      search_sessions_by_content: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_project_id: string
          p_query: string
        }
        Returns: {
          match_count: number
          rank: number
          session_id: string
        }[]
      }
      search_similar_issues: {
        Args: {
          p_exclude_issue_id?: string
          p_include_closed?: boolean
          p_issue_type?: string
          p_limit?: number
          p_project_id: string
          p_query_embedding: string
          p_similarity_threshold?: number
        }
        Returns: {
          description: string
          issue_id: string
          similarity: number
          status: string
          title: string
          type: string
          upvote_count: number
        }[]
      }
      user_has_project_access: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      user_has_project_role: {
        Args: { p_project_id: string; p_role: string; p_user_id: string }
        Returns: boolean
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

