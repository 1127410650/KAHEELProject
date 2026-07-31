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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      attachments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          delete_requested_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          entity_id: string
          entity_type: string
          file_hash: string | null
          file_name: string
          file_size: number | null
          id: string
          kind: string | null
          mime_type: string | null
          note: string | null
          project_id: string | null
          replaces_id: string | null
          stage_id: string | null
          storage_path: string
          uploader_role: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          delete_requested_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          entity_id: string
          entity_type: string
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          kind?: string | null
          mime_type?: string | null
          note?: string | null
          project_id?: string | null
          replaces_id?: string | null
          stage_id?: string | null
          storage_path: string
          uploader_role?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          delete_requested_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          entity_id?: string
          entity_type?: string
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          kind?: string | null
          mime_type?: string | null
          note?: string | null
          project_id?: string | null
          replaces_id?: string | null
          stage_id?: string | null
          storage_path?: string
          uploader_role?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "request_status_history"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      custody_transactions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          client_token: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          id: string
          invoice_id: string | null
          notes_ar: string | null
          notes_en: string | null
          project_id: string | null
          reason: string | null
          request_id: string | null
          reversal_of_id: string | null
          serial_no: number
          status: Database["public"]["Enums"]["record_status"]
          supervisor_id: string
          txn_date: string
          txn_type: Database["public"]["Enums"]["custody_txn_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          notes_ar?: string | null
          notes_en?: string | null
          project_id?: string | null
          reason?: string | null
          request_id?: string | null
          reversal_of_id?: string | null
          serial_no?: number
          status?: Database["public"]["Enums"]["record_status"]
          supervisor_id: string
          txn_date?: string
          txn_type: Database["public"]["Enums"]["custody_txn_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          notes_ar?: string | null
          notes_en?: string | null
          project_id?: string | null
          reason?: string | null
          request_id?: string | null
          reversal_of_id?: string | null
          serial_no?: number
          status?: Database["public"]["Enums"]["record_status"]
          supervisor_id?: string
          txn_date?: string
          txn_type?: Database["public"]["Enums"]["custody_txn_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_settlements"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "custody_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "custody_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "custody_txn_effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "custody_txn_effects"
            referencedColumns: ["reversed_by_id"]
          },
          {
            foreignKeyName: "custody_transactions_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["supervisor_id"]
          },
          {
            foreignKeyName: "custody_transactions_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["record_status"] | null
          id: string
          invoice_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["record_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["record_status"] | null
          id?: string
          invoice_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["record_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["record_status"] | null
          id?: string
          invoice_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["record_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_settlements"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_before_tax: number
          client_token: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          description: string | null
          duplicate_reason: string | null
          id: string
          internal_no: number
          invoice_date: string
          invoice_no: string
          invoice_no_norm: string | null
          project_id: string
          status: Database["public"]["Enums"]["record_status"]
          supervisor_id: string | null
          supplier_id: string
          tax_amount: number
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_before_tax?: number
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          description?: string | null
          duplicate_reason?: string | null
          id?: string
          internal_no?: number
          invoice_date: string
          invoice_no: string
          invoice_no_norm?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["record_status"]
          supervisor_id?: string | null
          supplier_id: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_before_tax?: number
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          description?: string | null
          duplicate_reason?: string | null
          id?: string
          internal_no?: number
          invoice_date?: string
          invoice_no?: string
          invoice_no_norm?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["record_status"]
          supervisor_id?: string | null
          supplier_id?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["supervisor_id"]
          },
          {
            foreignKeyName: "invoices_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          fail_count: number
          identifier: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          fail_count?: number
          identifier: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          fail_count?: number
          identifier?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event: string
          id: string
          message_id: string | null
          read_at: string | null
          request_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event: string
          id?: string
          message_id?: string | null
          read_at?: string | null
          request_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event?: string
          id?: string
          message_id?: string | null
          read_at?: string | null
          request_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "request_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          locale: Database["public"]["Enums"]["app_locale"]
          must_change_password: boolean
          national_id: string | null
          phone: string | null
          supervisor_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          locale?: Database["public"]["Enums"]["app_locale"]
          must_change_password?: boolean
          national_id?: string | null
          phone?: string | null
          supervisor_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          locale?: Database["public"]["Enums"]["app_locale"]
          must_change_password?: boolean
          national_id?: string | null
          phone?: string | null
          supervisor_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["supervisor_id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_supervisors: {
        Row: {
          created_at: string
          id: string
          project_id: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          supervisor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_supervisors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supervisors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["supervisor_id"]
          },
          {
            foreignKeyName: "project_supervisors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          city: string | null
          code: string
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          location: string | null
          name_ar: string
          name_en: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          supervisor_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          location?: string | null
          name_ar: string
          name_en?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supervisor_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          location?: string | null
          name_ar?: string
          name_en?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supervisor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["supervisor_id"]
          },
          {
            foreignKeyName: "projects_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      request_change_requests: {
        Row: {
          action: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          executed_at: string | null
          executed_by: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          reason: string
          request_id: string
          requested_by: string | null
          requested_role: string | null
          status: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          executed_at?: string | null
          executed_by?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason: string
          request_id: string
          requested_by?: string | null
          requested_role?: string | null
          status?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          executed_at?: string | null
          executed_by?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string
          request_id?: string
          requested_by?: string | null
          requested_role?: string | null
          status?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_change_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_field_versions: {
        Row: {
          change_request_id: string | null
          changed_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          request_id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          change_request_id?: string | null
          changed_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          request_id: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          change_request_id?: string | null
          changed_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          request_id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_field_versions_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "request_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_field_versions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "request_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      request_messages: {
        Row: {
          author_id: string | null
          author_role: string | null
          body: string
          client_token: string | null
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          is_draft: boolean
          items: Json | null
          msg_kind: string
          priority: string | null
          reply_to_id: string | null
          request_id: string
        }
        Insert: {
          author_id?: string | null
          author_role?: string | null
          body: string
          client_token?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          is_draft?: boolean
          items?: Json | null
          msg_kind?: string
          priority?: string | null
          reply_to_id?: string | null
          request_id: string
        }
        Update: {
          author_id?: string | null
          author_role?: string | null
          body?: string
          client_token?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          is_draft?: boolean
          items?: Json | null
          msg_kind?: string
          priority?: string | null
          reply_to_id?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "request_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_reminders: {
        Row: {
          actor_id: string
          client_token: string | null
          created_at: string
          follow_up_date: string | null
          id: string
          message: string | null
          request_id: string
          target_user_id: string | null
        }
        Insert: {
          actor_id: string
          client_token?: string | null
          created_at?: string
          follow_up_date?: string | null
          id?: string
          message?: string | null
          request_id: string
          target_user_id?: string | null
        }
        Update: {
          actor_id?: string
          client_token?: string | null
          created_at?: string
          follow_up_date?: string | null
          id?: string
          message?: string | null
          request_id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_reminders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          assignee_id: string | null
          created_at: string
          department: string | null
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: string
          note: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          assignee_id?: string | null
          created_at?: string
          department?: string | null
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          assignee_id?: string | null
          created_at?: string
          department?: string | null
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          account_ref: string | null
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          authority: string | null
          beneficiary: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          created_project_id: string | null
          delete_reason: string | null
          deleted_at: string | null
          department: string | null
          due_date: string | null
          executed_at: string | null
          executed_by: string | null
          execution_reference: string | null
          final_result: string | null
          id: string
          info_state: string
          kind: string
          need_date: string | null
          notes_ar: string | null
          notes_en: string | null
          paid_at: string | null
          payment_amount: number | null
          payment_beneficiary: string | null
          payment_expiry: string | null
          payment_method: string | null
          payment_no: string | null
          payment_note: string | null
          payment_reference: string | null
          priority: string
          project_id: string | null
          reason: string | null
          reassign_reason: string | null
          reference_no: string | null
          reject_reason: string | null
          reopen_reason: string | null
          request_date: string
          request_no: string
          request_type: string
          requester_id: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["request_status"]
          status_note: string | null
          supervisor_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          account_ref?: string | null
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          authority?: string | null
          beneficiary?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_project_id?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          department?: string | null
          due_date?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_reference?: string | null
          final_result?: string | null
          id?: string
          info_state?: string
          kind?: string
          need_date?: string | null
          notes_ar?: string | null
          notes_en?: string | null
          paid_at?: string | null
          payment_amount?: number | null
          payment_beneficiary?: string | null
          payment_expiry?: string | null
          payment_method?: string | null
          payment_no?: string | null
          payment_note?: string | null
          payment_reference?: string | null
          priority?: string
          project_id?: string | null
          reason?: string | null
          reassign_reason?: string | null
          reference_no?: string | null
          reject_reason?: string | null
          reopen_reason?: string | null
          request_date?: string
          request_no: string
          request_type: string
          requester_id?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          status_note?: string | null
          supervisor_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          account_ref?: string | null
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          authority?: string | null
          beneficiary?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_project_id?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          department?: string | null
          due_date?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_reference?: string | null
          final_result?: string | null
          id?: string
          info_state?: string
          kind?: string
          need_date?: string | null
          notes_ar?: string | null
          notes_en?: string | null
          paid_at?: string | null
          payment_amount?: number | null
          payment_beneficiary?: string | null
          payment_expiry?: string | null
          payment_method?: string | null
          payment_no?: string | null
          payment_note?: string | null
          payment_reference?: string | null
          priority?: string
          project_id?: string | null
          reason?: string | null
          reassign_reason?: string | null
          reference_no?: string | null
          reject_reason?: string | null
          reopen_reason?: string | null
          request_date?: string
          request_no?: string
          request_type?: string
          requester_id?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          status_note?: string | null
          supervisor_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["supervisor_id"]
          },
          {
            foreignKeyName: "requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisors: {
        Row: {
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          job_title: string | null
          name_ar: string
          name_en: string | null
          national_id: string
          notes_ar: string | null
          notes_en: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          name_ar: string
          name_en?: string | null
          national_id: string
          notes_ar?: string | null
          notes_en?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          name_ar?: string
          name_en?: string | null
          national_id?: string
          notes_ar?: string | null
          notes_en?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          commercial_reg: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          notes: string | null
          phone: string | null
          tax_number: string | null
          unified_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          commercial_reg?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          unified_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          commercial_reg?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          unified_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      custody_balances: {
        Row: {
          balance: number | null
          name_ar: string | null
          name_en: string | null
          supervisor_id: string | null
        }
        Relationships: []
      }
      custody_txn_effects: {
        Row: {
          amount: number | null
          deleted_at: string | null
          id: string | null
          invoice_id: string | null
          notes_ar: string | null
          project_id: string | null
          reason: string | null
          reversal_of_id: string | null
          reversal_of_invoice_id: string | null
          reversal_of_serial: number | null
          reversal_of_type:
            | Database["public"]["Enums"]["custody_txn_type"]
            | null
          reversed_by_id: string | null
          reversed_by_serial: number | null
          serial_no: number | null
          signed_amount: number | null
          status: Database["public"]["Enums"]["record_status"] | null
          supervisor_id: string | null
          txn_date: string | null
          txn_type: Database["public"]["Enums"]["custody_txn_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "custody_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_settlements"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "custody_transactions_invoice_id_fkey"
            columns: ["reversal_of_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_settlements"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "custody_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_invoice_id_fkey"
            columns: ["reversal_of_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "custody_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "custody_txn_effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "custody_txn_effects"
            referencedColumns: ["reversed_by_id"]
          },
          {
            foreignKeyName: "custody_transactions_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["supervisor_id"]
          },
          {
            foreignKeyName: "custody_transactions_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settlements: {
        Row: {
          invoice_id: string | null
          remaining_amount: number | null
          settled_amount: number | null
          total_amount: number | null
        }
        Insert: {
          invoice_id?: string | null
          remaining_amount?: never
          settled_amount?: never
          total_amount?: number | null
        }
        Update: {
          invoice_id?: string | null
          remaining_amount?: never
          settled_amount?: never
          total_amount?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_attachment: {
        Args: { _attachment_id: string }
        Returns: undefined
      }
      attachment_restore: {
        Args: { _attachment_id: string; _reason?: string }
        Returns: undefined
      }
      can_access_attachment_object: {
        Args: { _path: string }
        Returns: boolean
      }
      can_access_project: { Args: { _project_id: string }; Returns: boolean }
      can_access_request: { Args: { _request_id: string }; Returns: boolean }
      can_access_supervisor: {
        Args: { _supervisor_id: string }
        Returns: boolean
      }
      change_request_create: {
        Args: {
          _action: string
          _field_name?: string
          _new_value?: string
          _old_value?: string
          _reason: string
          _request_id: string
          _target_id?: string
          _target_type: string
        }
        Returns: string
      }
      change_request_decide: {
        Args: {
          _change_id: string
          _decision: string
          _new_value?: string
          _reason?: string
        }
        Returns: undefined
      }
      change_request_execute: {
        Args: { _change_id: string }
        Returns: undefined
      }
      current_role_label: { Args: never; Returns: string }
      current_supervisor_id: { Args: never; Returns: string }
      custody_base_effect: {
        Args: {
          p_amount: number
          p_type: Database["public"]["Enums"]["custody_txn_type"]
        }
        Returns: number
      }
      has_perm: { Args: { _perm: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoice_settled_amount: {
        Args: { p_invoice_id: string }
        Returns: number
      }
      is_accountant: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_supervisor_user: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type: string
          _new_value?: Json
          _old_value?: Json
          _reason?: string
        }
        Returns: string
      }
      normalize_doc_no: { Args: { p_value: string }; Returns: string }
      notify_request: {
        Args: {
          _body?: string
          _event: string
          _message_id?: string
          _request_id: string
          _title: string
        }
        Returns: undefined
      }
      register_login_result: {
        Args: { _identifier: string; _success: boolean }
        Returns: boolean
      }
      request_add_reminder: {
        Args: {
          _client_token?: string
          _follow_up_date?: string
          _message: string
          _request_id: string
          _target_user_id?: string
        }
        Returns: string
      }
      request_ask_info: {
        Args: {
          _body: string
          _due_date?: string
          _items?: string
          _priority?: string
          _request_id: string
        }
        Returns: string
      }
      request_can_transition: {
        Args: { _from: string; _to: string }
        Returns: boolean
      }
      request_cancel: {
        Args: { _reason: string; _request_id: string }
        Returns: undefined
      }
      request_close: {
        Args: { _note?: string; _request_id: string }
        Returns: undefined
      }
      request_decide: {
        Args: { _decision: string; _note?: string; _request_id: string }
        Returns: undefined
      }
      request_execute:
        | { Args: { _note?: string; _request_id: string }; Returns: Json }
        | {
            Args: { _note?: string; _reference?: string; _request_id: string }
            Returns: Json
          }
      request_mark_read: { Args: { _request_id: string }; Returns: undefined }
      request_message_publish: {
        Args: { _body?: string; _message_id: string }
        Returns: undefined
      }
      request_post_message: {
        Args: {
          _body: string
          _client_token?: string
          _is_draft?: boolean
          _msg_kind?: string
          _reply_to?: string
          _request_id: string
        }
        Returns: string
      }
      request_progress: { Args: { _status: string }; Returns: number }
      request_reassign: {
        Args: { _assignee: string; _reason: string; _request_id: string }
        Returns: undefined
      }
      request_reopen: {
        Args: { _reason: string; _request_id: string }
        Returns: undefined
      }
      request_set_status: {
        Args: {
          _assignee?: string
          _department?: string
          _note?: string
          _request_id: string
          _status: string
        }
        Returns: undefined
      }
      request_stage_order: { Args: never; Returns: string[] }
      request_supervisor_reply: {
        Args: {
          _body: string
          _client_token?: string
          _is_draft?: boolean
          _request_id: string
        }
        Returns: string
      }
      resolve_login_identity: {
        Args: { _identifier: string }
        Returns: {
          email: string
          is_active: boolean
          locked: boolean
        }[]
      }
      send_request_reminder: {
        Args: { _message?: string; _request_id: string }
        Returns: string
      }
      submit_portal_request: {
        Args: {
          _amount?: number
          _authority?: string
          _kind: string
          _notes_ar?: string
          _project_id?: string
          _request_date?: string
          _request_type: string
        }
        Returns: string
      }
      submit_request: {
        Args: {
          _account_ref?: string
          _amount?: number
          _authority?: string
          _beneficiary?: string
          _department?: string
          _kind: string
          _need_date?: string
          _notes_ar?: string
          _priority?: string
          _project_id?: string
          _reason?: string
          _request_date?: string
          _request_type?: string
          _service_type?: string
          _title?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_locale: "ar" | "en"
      app_role: "accountant" | "employee" | "supervisor"
      custody_txn_type:
        | "add"
        | "settlement"
        | "deduction"
        | "refund"
        | "reversal"
      project_status: "active" | "on_hold" | "completed" | "cancelled" | "draft"
      record_status:
        | "draft"
        | "under_review"
        | "returned"
        | "approved"
        | "cancelled"
      request_status:
        | "new"
        | "processing"
        | "needs_info"
        | "awaiting_payment"
        | "paid"
        | "completed"
        | "cancelled"
        | "approved"
        | "rejected"
        | "awaiting_reply"
        | "under_review"
        | "assigned"
        | "supervisor_replied"
        | "review_after_info"
        | "awaiting_approval"
        | "awaiting_execution"
        | "executing"
        | "executed"
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
      app_locale: ["ar", "en"],
      app_role: ["accountant", "employee", "supervisor"],
      custody_txn_type: [
        "add",
        "settlement",
        "deduction",
        "refund",
        "reversal",
      ],
      project_status: ["active", "on_hold", "completed", "cancelled", "draft"],
      record_status: [
        "draft",
        "under_review",
        "returned",
        "approved",
        "cancelled",
      ],
      request_status: [
        "new",
        "processing",
        "needs_info",
        "awaiting_payment",
        "paid",
        "completed",
        "cancelled",
        "approved",
        "rejected",
        "awaiting_reply",
        "under_review",
        "assigned",
        "supervisor_replied",
        "review_after_info",
        "awaiting_approval",
        "awaiting_execution",
        "executing",
        "executed",
      ],
    },
  },
} as const
