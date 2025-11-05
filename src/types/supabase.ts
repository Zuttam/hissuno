// This file contains TypeScript types for your Supabase database
// Generate types from your Supabase database schema with:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      project_analyses: {
        Row: {
          archive_temp_path: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          project_id: string
          prompt: string | null
          result: Json | null
          source_kind: 'path' | 'upload' | null
          source_value: string | null
          started_at: string | null
          status: 'pending' | 'running' | 'completed' | 'failed'
          summary: Json | null
          updated_at: string
        }
        Insert: {
          archive_temp_path?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          project_id: string
          prompt?: string | null
          result?: Json | null
          source_kind?: 'path' | 'upload' | null
          source_value?: string | null
          started_at?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed'
          summary?: Json | null
          updated_at?: string
        }
        Update: {
          archive_temp_path?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          project_id?: string
          prompt?: string | null
          result?: Json | null
          source_kind?: 'path' | 'upload' | null
          source_value?: string | null
          started_at?: string | null
          status?: 'pending' | 'running' | 'completed' | 'failed'
          summary?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      projects: {
        Row: {
          archive_temp_path: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          source_kind: 'path' | 'upload' | null
          repository_branch: string | null
          repository_url: string | null
          updated_at: string
        }
        Insert: {
          archive_temp_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          source_kind?: 'path' | 'upload' | null
          repository_branch?: string | null
          repository_url?: string | null
          updated_at?: string
        }
        Update: {
          archive_temp_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          source_kind?: 'path' | 'upload' | null
          repository_branch?: string | null
          repository_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
