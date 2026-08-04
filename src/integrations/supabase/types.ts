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
      account_link_reviews: {
        Row: {
          candidate_count: number
          created_at: string
          id: string
          reason: string
          status: string
          supervisor_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          candidate_count?: number
          created_at?: string
          id?: string
          reason: string
          status?: string
          supervisor_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          candidate_count?: number
          created_at?: string
          id?: string
          reason?: string
          status?: string
          supervisor_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_link_reviews_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "custody_balances"
            referencedColumns: ["supervisor_id"]
          },
          {
            foreignKeyName: "account_link_reviews_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_link_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          is_public: boolean
          key: string
          tenant_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          tenant_id?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "attachments_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "custody_transactions_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analyses: {
        Row: {
          analyzer_version: string
          applied_at: string | null
          applied_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          document_id: string
          document_type_confirmed: string | null
          document_type_detected: string | null
          document_version: number | null
          extraction_method: string | null
          failure_code: string | null
          failure_message: string | null
          file_hash: string | null
          id: string
          language_detected: string | null
          overall_confidence: number | null
          page_count: number | null
          project_id: string
          qr_findings: Json
          quick_mode: boolean
          raw_text: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          analyzer_version?: string
          applied_at?: string | null
          applied_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          document_type_confirmed?: string | null
          document_type_detected?: string | null
          document_version?: number | null
          extraction_method?: string | null
          failure_code?: string | null
          failure_message?: string | null
          file_hash?: string | null
          id?: string
          language_detected?: string | null
          overall_confidence?: number | null
          page_count?: number | null
          project_id: string
          qr_findings?: Json
          quick_mode?: boolean
          raw_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          analyzer_version?: string
          applied_at?: string | null
          applied_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          document_type_confirmed?: string | null
          document_type_detected?: string | null
          document_version?: number | null
          extraction_method?: string | null
          failure_code?: string | null
          failure_message?: string | null
          file_hash?: string | null
          id?: string
          language_detected?: string | null
          overall_confidence?: number | null
          page_count?: number | null
          project_id?: string
          qr_findings?: Json
          quick_mode?: boolean
          raw_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "property_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_analyses_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analysis_conflicts: {
        Row: {
          analysis_id: string
          conflict_type: string | null
          created_at: string
          document_value: string | null
          field_key: string
          id: string
          project_value: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          tenant_id: string
        }
        Insert: {
          analysis_id: string
          conflict_type?: string | null
          created_at?: string
          document_value?: string | null
          field_key: string
          id?: string
          project_value?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          tenant_id?: string
        }
        Update: {
          analysis_id?: string
          conflict_type?: string | null
          created_at?: string
          document_value?: string | null
          field_key?: string
          id?: string
          project_value?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_analysis_conflicts_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "document_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_analysis_conflicts_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analysis_fields: {
        Row: {
          analysis_id: string
          approved_value: string | null
          bounding_box: Json | null
          confidence: number | null
          created_at: string
          current_project_value: string | null
          extracted_value: string | null
          extraction_method: string | null
          field_key: string
          field_label: string | null
          id: string
          is_sensitive: boolean
          match_state: string | null
          normalized_value: string | null
          original_text: string | null
          page_number: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          analysis_id: string
          approved_value?: string | null
          bounding_box?: Json | null
          confidence?: number | null
          created_at?: string
          current_project_value?: string | null
          extracted_value?: string | null
          extraction_method?: string | null
          field_key: string
          field_label?: string | null
          id?: string
          is_sensitive?: boolean
          match_state?: string | null
          normalized_value?: string | null
          original_text?: string | null
          page_number?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
        }
        Update: {
          analysis_id?: string
          approved_value?: string | null
          bounding_box?: Json | null
          confidence?: number | null
          created_at?: string
          current_project_value?: string | null
          extracted_value?: string | null
          extraction_method?: string | null
          field_key?: string
          field_label?: string | null
          id?: string
          is_sensitive?: boolean
          match_state?: string | null
          normalized_value?: string | null
          original_text?: string | null
          page_number?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_analysis_fields_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "document_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_analysis_fields_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analysis_runs: {
        Row: {
          analysis_id: string
          analyzer_version: string
          completed_at: string | null
          device_info: Json | null
          id: string
          performance_metrics: Json | null
          result: string | null
          started_at: string
          tenant_id: string
        }
        Insert: {
          analysis_id: string
          analyzer_version?: string
          completed_at?: string | null
          device_info?: Json | null
          id?: string
          performance_metrics?: Json | null
          result?: string | null
          started_at?: string
          tenant_id?: string
        }
        Update: {
          analysis_id?: string
          analyzer_version?: string
          completed_at?: string | null
          device_info?: Json | null
          id?: string
          performance_metrics?: Json | null
          result?: string | null
          started_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_analysis_runs_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "document_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_analysis_runs_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          confidence: number
          created_at: string
          created_by: string | null
          description: string | null
          discount: number | null
          extraction_method: string
          id: string
          invoice_id: string
          line_number: number
          normalized_name: string | null
          original_name: string
          quantity: number | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          sku: string | null
          subtotal_before_vat: number | null
          tenant_id: string
          total_with_vat: number | null
          unified_product_id: string | null
          unit: string | null
          unit_price_before_vat: number | null
          updated_at: string
          vat_amount: number | null
          vat_rate: number | null
          verification_id: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount?: number | null
          extraction_method?: string
          id?: string
          invoice_id: string
          line_number?: number
          normalized_name?: string | null
          original_name: string
          quantity?: number | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku?: string | null
          subtotal_before_vat?: number | null
          tenant_id?: string
          total_with_vat?: number | null
          unified_product_id?: string | null
          unit?: string | null
          unit_price_before_vat?: number | null
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
          verification_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount?: number | null
          extraction_method?: string
          id?: string
          invoice_id?: string
          line_number?: number
          normalized_name?: string | null
          original_name?: string
          quantity?: number | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku?: string | null
          subtotal_before_vat?: number | null
          tenant_id?: string
          total_with_vat?: number | null
          unified_product_id?: string | null
          unit?: string | null
          unit_price_before_vat?: number | null
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
          verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_settlements"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "invoice_verifications"
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
          tenant_id: string
          to_status: Database["public"]["Enums"]["record_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["record_status"] | null
          id?: string
          invoice_id: string
          note?: string | null
          tenant_id?: string
          to_status: Database["public"]["Enums"]["record_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["record_status"] | null
          id?: string
          invoice_id?: string
          note?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "invoice_status_history_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_verifications: {
        Row: {
          created_at: string
          created_by: string | null
          decoded_tags: Json
          detected_phase: number | null
          extraction_method: string | null
          file_hash: string | null
          id: string
          invoice_id: string
          invoice_timestamp: string | null
          qr_hash: string | null
          result_status: string
          seller_name: string | null
          seller_vat_number: string | null
          storage_path: string | null
          tenant_id: string
          total_with_vat: number | null
          vat_total: number | null
          verification_reasons: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decoded_tags?: Json
          detected_phase?: number | null
          extraction_method?: string | null
          file_hash?: string | null
          id?: string
          invoice_id: string
          invoice_timestamp?: string | null
          qr_hash?: string | null
          result_status: string
          seller_name?: string | null
          seller_vat_number?: string | null
          storage_path?: string | null
          tenant_id?: string
          total_with_vat?: number | null
          vat_total?: number | null
          verification_reasons?: Json
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decoded_tags?: Json
          detected_phase?: number | null
          extraction_method?: string | null
          file_hash?: string | null
          id?: string
          invoice_id?: string
          invoice_timestamp?: string | null
          qr_hash?: string | null
          result_status?: string
          seller_name?: string | null
          seller_vat_number?: string | null
          storage_path?: string | null
          tenant_id?: string
          total_with_vat?: number | null
          vat_total?: number | null
          verification_reasons?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_verifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_settlements"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_verifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_verifications_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_before_tax: number
          approved_at: string | null
          approved_by: string | null
          client_token: string | null
          created_at: string
          created_by: string | null
          currency: string
          delete_reason: string | null
          deleted_at: string | null
          description: string | null
          duplicate_reason: string | null
          extraction_method: string | null
          file_hash: string | null
          id: string
          internal_no: number
          invoice_date: string
          invoice_no: string
          invoice_no_norm: string | null
          lines_reviewed_at: string | null
          project_id: string
          qr_hash: string | null
          seller_name_raw: string | null
          seller_vat_number: string | null
          source: string
          status: Database["public"]["Enums"]["record_status"]
          supervisor_id: string | null
          supplier_id: string
          tax_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
          updated_by: string | null
          zatca_uuid: string | null
        }
        Insert: {
          amount_before_tax?: number
          approved_at?: string | null
          approved_by?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delete_reason?: string | null
          deleted_at?: string | null
          description?: string | null
          duplicate_reason?: string | null
          extraction_method?: string | null
          file_hash?: string | null
          id?: string
          internal_no?: number
          invoice_date: string
          invoice_no: string
          invoice_no_norm?: string | null
          lines_reviewed_at?: string | null
          project_id: string
          qr_hash?: string | null
          seller_name_raw?: string | null
          seller_vat_number?: string | null
          source?: string
          status?: Database["public"]["Enums"]["record_status"]
          supervisor_id?: string | null
          supplier_id: string
          tax_amount?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          zatca_uuid?: string | null
        }
        Update: {
          amount_before_tax?: number
          approved_at?: string | null
          approved_by?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delete_reason?: string | null
          deleted_at?: string | null
          description?: string | null
          duplicate_reason?: string | null
          extraction_method?: string | null
          file_hash?: string | null
          id?: string
          internal_no?: number
          invoice_date?: string
          invoice_no?: string
          invoice_no_norm?: string | null
          lines_reviewed_at?: string | null
          project_id?: string
          qr_hash?: string | null
          seller_name_raw?: string | null
          seller_vat_number?: string | null
          source?: string
          status?: Database["public"]["Enums"]["record_status"]
          supervisor_id?: string | null
          supplier_id?: string
          tax_amount?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          zatca_uuid?: string | null
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
          {
            foreignKeyName: "invoices_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      mkt_account_restrictions: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          lifted_at: string | null
          lifted_reason: string | null
          reason: string
          report_id: string | null
          restriction: string
          starts_at: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          lifted_at?: string | null
          lifted_reason?: string | null
          reason: string
          report_id?: string | null
          restriction: string
          starts_at?: string
          subject_id: string
          subject_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          lifted_at?: string | null
          lifted_reason?: string | null
          reason?: string
          report_id?: string | null
          restriction?: string
          starts_at?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_account_restrictions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_activities: {
        Row: {
          country_id: string | null
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          is_active: boolean
          merged_into_id: string | null
          name_ar: string
          name_en: string | null
          needs_review: boolean
          norm_ar: string | null
          norm_en: string | null
          official_code: string | null
          official_source: string | null
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          merged_into_id?: string | null
          name_ar: string
          name_en?: string | null
          needs_review?: boolean
          norm_ar?: string | null
          norm_en?: string | null
          official_code?: string | null
          official_source?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          merged_into_id?: string | null
          name_ar?: string
          name_en?: string | null
          needs_review?: boolean
          norm_ar?: string | null
          norm_en?: string | null
          official_code?: string | null
          official_source?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_activities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_activities_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "mkt_activity_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_activities_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "mkt_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_activities_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mkt_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_activity_aliases: {
        Row: {
          activity_id: string
          alias: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          norm_alias: string | null
        }
        Insert: {
          activity_id: string
          alias: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          norm_alias?: string | null
        }
        Update: {
          activity_id?: string
          alias?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          norm_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_activity_aliases_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "mkt_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_activity_groups: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mkt_activity_merges: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          moved_aliases: number
          moved_children: number
          moved_links: number
          note: string | null
          source_id: string
          target_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          moved_aliases?: number
          moved_children?: number
          moved_links?: number
          note?: string | null
          source_id: string
          target_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          moved_aliases?: number
          moved_children?: number
          moved_links?: number
          note?: string | null
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_activity_merges_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "mkt_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_activity_merges_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "mkt_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_activity_suggestions: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          linked_activity_id: string | null
          norm_text: string | null
          parent_id: string | null
          raw_text: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_by: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          linked_activity_id?: string | null
          norm_text?: string | null
          parent_id?: string | null
          raw_text: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          linked_activity_id?: string | null
          norm_text?: string | null
          parent_id?: string | null
          raw_text?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_activity_suggestions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "mkt_activity_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_activity_suggestions_linked_activity_id_fkey"
            columns: ["linked_activity_id"]
            isOneToOne: false
            referencedRelation: "mkt_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_activity_suggestions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mkt_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_activity_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_admin_assignments: {
        Row: {
          assigned_by: string | null
          assignee: string | null
          auto_assigned: boolean
          claimed_at: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          department: string | null
          due_at: string | null
          first_action_at: string | null
          id: string
          kind: string
          last_action_at: string | null
          priority: string
          progress: string
          released_at: string | null
          released_reason: string | null
          subject_id: string
          transfer_reason: string | null
          transferred_from: string | null
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assignee?: string | null
          auto_assigned?: boolean
          claimed_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          department?: string | null
          due_at?: string | null
          first_action_at?: string | null
          id?: string
          kind: string
          last_action_at?: string | null
          priority?: string
          progress?: string
          released_at?: string | null
          released_reason?: string | null
          subject_id: string
          transfer_reason?: string | null
          transferred_from?: string | null
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assignee?: string | null
          auto_assigned?: boolean
          claimed_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          department?: string | null
          due_at?: string | null
          first_action_at?: string | null
          id?: string
          kind?: string
          last_action_at?: string | null
          priority?: string
          progress?: string
          released_at?: string | null
          released_reason?: string | null
          subject_id?: string
          transfer_reason?: string | null
          transferred_from?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mkt_admin_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          subject_id: string
          subject_type: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      mkt_appeals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          listing_id: string | null
          reason: string
          report_id: string
          status: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          listing_id?: string | null
          reason: string
          report_id: string
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          listing_id?: string | null
          reason?: string
          report_id?: string
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_appeals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_appeals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_business_officers: {
        Row: {
          authorization_expires_on: string | null
          capacity: string
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          id_last2: string | null
          id_number: string
          id_type: string
          is_primary: boolean
          phone: string
          relation: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          authorization_expires_on?: string | null
          capacity: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_last2?: string | null
          id_number: string
          id_type: string
          is_primary?: boolean
          phone: string
          relation?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          authorization_expires_on?: string | null
          capacity?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_last2?: string | null
          id_number?: string
          id_type?: string
          is_primary?: boolean
          phone?: string
          relation?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_business_officers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_business_profiles: {
        Row: {
          about: string | null
          categories: string[]
          city: string | null
          city_id: string | null
          country_id: string | null
          created_at: string
          display_name_ar: string
          display_name_en: string | null
          headline: string | null
          is_published: boolean
          joined_at: string
          logo_url: string | null
          main_activity: string | null
          public_email: string | null
          public_phone: string | null
          public_website: string | null
          public_whatsapp: string | null
          region: string | null
          service_area_city_ids: string[]
          service_area_regions: string[]
          show_email: boolean
          show_phone: boolean
          show_whatsapp: boolean
          slug: string
          sub_activities: string[]
          tenant_id: string
          updated_at: string
          verification_note: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          about?: string | null
          categories?: string[]
          city?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          display_name_ar: string
          display_name_en?: string | null
          headline?: string | null
          is_published?: boolean
          joined_at?: string
          logo_url?: string | null
          main_activity?: string | null
          public_email?: string | null
          public_phone?: string | null
          public_website?: string | null
          public_whatsapp?: string | null
          region?: string | null
          service_area_city_ids?: string[]
          service_area_regions?: string[]
          show_email?: boolean
          show_phone?: boolean
          show_whatsapp?: boolean
          slug: string
          sub_activities?: string[]
          tenant_id: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          about?: string | null
          categories?: string[]
          city?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          display_name_ar?: string
          display_name_en?: string | null
          headline?: string | null
          is_published?: boolean
          joined_at?: string
          logo_url?: string | null
          main_activity?: string | null
          public_email?: string | null
          public_phone?: string | null
          public_website?: string | null
          public_whatsapp?: string | null
          region?: string | null
          service_area_city_ids?: string[]
          service_area_regions?: string[]
          show_email?: boolean
          show_phone?: boolean
          show_whatsapp?: boolean
          slug?: string
          sub_activities?: string[]
          tenant_id?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_business_profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_business_profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_business_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_business_registry: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          country_id: string | null
          cr_expiry_date: string | null
          cr_issue_date: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          entity_type: string
          legal_name: string
          main_activity: string | null
          national_address: string | null
          sub_activities: string[]
          tenant_id: string
          unified_number: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          country_id?: string | null
          cr_expiry_date?: string | null
          cr_issue_date?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          legal_name: string
          main_activity?: string | null
          national_address?: string | null
          sub_activities?: string[]
          tenant_id: string
          unified_number?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          country_id?: string | null
          cr_expiry_date?: string | null
          cr_issue_date?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          legal_name?: string
          main_activity?: string | null
          national_address?: string | null
          sub_activities?: string[]
          tenant_id?: string
          unified_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_business_registry_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_business_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_call_blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          kind: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          kind?: string
          user_id?: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_call_restrictions: {
        Row: {
          created_at: string
          reason: string
          restricted_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reason: string
          restricted_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          reason?: string
          restricted_until?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_call_settings: {
        Row: {
          available_from: string | null
          available_to: string | null
          calls_enabled: boolean
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          calls_enabled?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          calls_enabled?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_call_signals: {
        Row: {
          call_id: string
          created_at: string
          expires_at: string
          id: number
          kind: string
          payload: Json
          sender_user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          expires_at?: string
          id?: number
          kind: string
          payload: Json
          sender_user_id?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          expires_at?: string
          id?: number
          kind?: string
          payload?: Json
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "mkt_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_calls: {
        Row: {
          accepted_at: string | null
          callee_user_id: string
          caller_user_id: string
          conversation_id: string | null
          created_at: string
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          id: string
          listing_id: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          callee_user_id: string
          caller_user_id: string
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          listing_id?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          callee_user_id?: string
          caller_user_id?: string
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          listing_id?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mkt_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_calls_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mkt_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_cities: {
        Row: {
          country_id: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          sort_order: number
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "mkt_cities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_city_suggestions: {
        Row: {
          country_id: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_by: string
          suggested_name: string
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string
          suggested_name: string
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string
          suggested_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_city_suggestions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_conversations: {
        Row: {
          buyer_user_id: string
          created_at: string
          id: string
          last_message_at: string
          listing_id: string
          seller_tenant_id: string | null
          seller_user_id: string | null
        }
        Insert: {
          buyer_user_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id: string
          seller_tenant_id?: string | null
          seller_user_id?: string | null
        }
        Update: {
          buyer_user_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string
          seller_tenant_id?: string | null
          seller_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_conversations_seller_tenant_id_fkey"
            columns: ["seller_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_countries: {
        Row: {
          calling_code: string
          created_at: string
          currency_code: string
          id: string
          is_active: boolean
          iso2: string
          name_ar: string
          name_en: string
          sort_order: number
        }
        Insert: {
          calling_code: string
          created_at?: string
          currency_code: string
          id?: string
          is_active?: boolean
          iso2: string
          name_ar: string
          name_en: string
          sort_order?: number
        }
        Update: {
          calling_code?: string
          created_at?: string
          currency_code?: string
          id?: string
          is_active?: boolean
          iso2?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
        }
        Relationships: []
      }
      mkt_enforcement_actions: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          duration_days: number | null
          expires_at: string | null
          id: string
          reason: string | null
          report_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          report_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          report_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_enforcement_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_entity_activities: {
        Row: {
          activity_id: string
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_entity_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "mkt_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_entity_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_follows: {
        Row: {
          created_at: string
          follower_id: string
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      mkt_listing_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          listing_id: string
          meta: Json
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          listing_id: string
          meta?: Json
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          listing_id?: string
          meta?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_listing_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_listing_images: {
        Row: {
          alt_text: string | null
          byte_size: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          file_hash: string | null
          height: number | null
          id: string
          is_cover: boolean
          listing_id: string
          mime_type: string | null
          original_filename: string | null
          sort_order: number
          storage_key: string | null
          thumbnail_key: string | null
          upload_status: string
          url: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          byte_size?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          file_hash?: string | null
          height?: number | null
          id?: string
          is_cover?: boolean
          listing_id: string
          mime_type?: string | null
          original_filename?: string | null
          sort_order?: number
          storage_key?: string | null
          thumbnail_key?: string | null
          upload_status?: string
          url: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          byte_size?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          file_hash?: string | null
          height?: number | null
          id?: string
          is_cover?: boolean
          listing_id?: string
          mime_type?: string | null
          original_filename?: string | null
          sort_order?: number
          storage_key?: string | null
          thumbnail_key?: string | null
          upload_status?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_listing_license_private: {
        Row: {
          brokerage_contract_number: string | null
          created_at: string
          deed_number: string | null
          internal_note: string | null
          listing_id: string
          updated_at: string
        }
        Insert: {
          brokerage_contract_number?: string | null
          created_at?: string
          deed_number?: string | null
          internal_note?: string | null
          listing_id: string
          updated_at?: string
        }
        Update: {
          brokerage_contract_number?: string | null
          created_at?: string
          deed_number?: string | null
          internal_note?: string | null
          listing_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_listing_license_private_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_listing_licenses: {
        Row: {
          ad_license_expiry: string | null
          ad_license_number: string | null
          advertiser_role: string
          created_at: string
          exemption_approved: boolean
          exemption_doc_path: string | null
          exemption_reason: string | null
          exemption_requested: boolean
          license_doc_path: string | null
          listing_id: string
          practice_license_number: string | null
          updated_at: string
          verification_note: string | null
          verification_source: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          ad_license_expiry?: string | null
          ad_license_number?: string | null
          advertiser_role?: string
          created_at?: string
          exemption_approved?: boolean
          exemption_doc_path?: string | null
          exemption_reason?: string | null
          exemption_requested?: boolean
          license_doc_path?: string | null
          listing_id: string
          practice_license_number?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_source?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          ad_license_expiry?: string | null
          ad_license_number?: string | null
          advertiser_role?: string
          created_at?: string
          exemption_approved?: boolean
          exemption_doc_path?: string | null
          exemption_reason?: string | null
          exemption_requested?: boolean
          license_doc_path?: string | null
          listing_id?: string
          practice_license_number?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_source?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_listing_licenses_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_listing_promotions: {
        Row: {
          created_at: string
          created_by: string | null
          duration_days: number
          ended_at: string | null
          ends_at: string
          id: string
          listing_id: string
          op_id: string | null
          points_spent: number
          starts_at: string
          status: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_days: number
          ended_at?: string | null
          ends_at: string
          id?: string
          listing_id: string
          op_id?: string | null
          points_spent: number
          starts_at?: string
          status?: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_days?: number
          ended_at?: string | null
          ends_at?: string
          id?: string
          listing_id?: string
          op_id?: string | null
          points_spent?: number
          starts_at?: string
          status?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_listing_promotions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_listing_promotions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mkt_point_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_listing_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          listing_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          listing_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          listing_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_listing_status_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_listing_types: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          is_request: boolean
          name_ar: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          is_request?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          is_request?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mkt_listings: {
        Row: {
          address_text: string | null
          advertiser_type: string | null
          category_id: string
          city: string | null
          city_id: string | null
          contact_requests_count: number
          country_id: string | null
          cover_image_url: string | null
          created_at: string
          created_by_staff: string | null
          currency: string
          deal_kind: string | null
          deleted_at: string | null
          description: string | null
          display_priority: number
          district: string | null
          duration_days: number
          expires_at: string | null
          expiry_notice_stage: number
          favorites_count: number
          featured_from: string | null
          featured_package: string | null
          featured_until: string | null
          guaranteed_impressions: number | null
          id: string
          is_featured: boolean
          item_condition: string | null
          keywords: string[]
          last_renewed_at: string | null
          last_scan_at: string | null
          latitude: number | null
          latitude_public: number | null
          link_copies_count: number
          location_accuracy: number | null
          location_source: string | null
          location_visibility: string
          longitude: number | null
          longitude_public: number | null
          moderation_score: number
          moderation_state: string
          owner_user_id: string
          paused_at: string | null
          price: number | null
          price_on_request: boolean
          price_unit: string | null
          promoted_until: string | null
          published_at: string | null
          qr_opens_count: number
          quantity: number | null
          quote_requests_count: number
          ratings_avg: number | null
          ratings_count: number
          ref_no: number
          region: string | null
          rejection_reason: string | null
          reports_count: number
          share_link_count: number
          shares_count: number
          slug: string | null
          specs: Json
          status: string
          subcategory_id: string | null
          summary: string | null
          tenant_id: string | null
          title: string
          type_code: string
          unit: string | null
          updated_at: string
          views_count: number
        }
        Insert: {
          address_text?: string | null
          advertiser_type?: string | null
          category_id: string
          city?: string | null
          city_id?: string | null
          contact_requests_count?: number
          country_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by_staff?: string | null
          currency?: string
          deal_kind?: string | null
          deleted_at?: string | null
          description?: string | null
          display_priority?: number
          district?: string | null
          duration_days?: number
          expires_at?: string | null
          expiry_notice_stage?: number
          favorites_count?: number
          featured_from?: string | null
          featured_package?: string | null
          featured_until?: string | null
          guaranteed_impressions?: number | null
          id?: string
          is_featured?: boolean
          item_condition?: string | null
          keywords?: string[]
          last_renewed_at?: string | null
          last_scan_at?: string | null
          latitude?: number | null
          latitude_public?: number | null
          link_copies_count?: number
          location_accuracy?: number | null
          location_source?: string | null
          location_visibility?: string
          longitude?: number | null
          longitude_public?: number | null
          moderation_score?: number
          moderation_state?: string
          owner_user_id?: string
          paused_at?: string | null
          price?: number | null
          price_on_request?: boolean
          price_unit?: string | null
          promoted_until?: string | null
          published_at?: string | null
          qr_opens_count?: number
          quantity?: number | null
          quote_requests_count?: number
          ratings_avg?: number | null
          ratings_count?: number
          ref_no?: number
          region?: string | null
          rejection_reason?: string | null
          reports_count?: number
          share_link_count?: number
          shares_count?: number
          slug?: string | null
          specs?: Json
          status?: string
          subcategory_id?: string | null
          summary?: string | null
          tenant_id?: string | null
          title: string
          type_code: string
          unit?: string | null
          updated_at?: string
          views_count?: number
        }
        Update: {
          address_text?: string | null
          advertiser_type?: string | null
          category_id?: string
          city?: string | null
          city_id?: string | null
          contact_requests_count?: number
          country_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by_staff?: string | null
          currency?: string
          deal_kind?: string | null
          deleted_at?: string | null
          description?: string | null
          display_priority?: number
          district?: string | null
          duration_days?: number
          expires_at?: string | null
          expiry_notice_stage?: number
          favorites_count?: number
          featured_from?: string | null
          featured_package?: string | null
          featured_until?: string | null
          guaranteed_impressions?: number | null
          id?: string
          is_featured?: boolean
          item_condition?: string | null
          keywords?: string[]
          last_renewed_at?: string | null
          last_scan_at?: string | null
          latitude?: number | null
          latitude_public?: number | null
          link_copies_count?: number
          location_accuracy?: number | null
          location_source?: string | null
          location_visibility?: string
          longitude?: number | null
          longitude_public?: number | null
          moderation_score?: number
          moderation_state?: string
          owner_user_id?: string
          paused_at?: string | null
          price?: number | null
          price_on_request?: boolean
          price_unit?: string | null
          promoted_until?: string | null
          published_at?: string | null
          qr_opens_count?: number
          quantity?: number | null
          quote_requests_count?: number
          ratings_avg?: number | null
          ratings_count?: number
          ref_no?: number
          region?: string | null
          rejection_reason?: string | null
          reports_count?: number
          share_link_count?: number
          shares_count?: number
          slug?: string | null
          specs?: Json
          status?: string
          subcategory_id?: string | null
          summary?: string | null
          tenant_id?: string | null
          title?: string
          type_code?: string
          unit?: string | null
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "mkt_listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mkt_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_listings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_listings_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "mkt_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_listings_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "mkt_listing_types"
            referencedColumns: ["code"]
          },
        ]
      }
      mkt_messages: {
        Row: {
          attachment_path: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_user_id: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_user_id?: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mkt_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_moderation_rules: {
        Row: {
          action: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: string
          lang: string
          normalized: string | null
          notes: string | null
          pattern: string
          severity: string
          updated_at: string
          weight: number
        }
        Insert: {
          action?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          lang?: string
          normalized?: string | null
          notes?: string | null
          pattern: string
          severity?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          lang?: string
          normalized?: string | null
          notes?: string | null
          pattern?: string
          severity?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      mkt_moderation_scans: {
        Row: {
          content_hash: string | null
          created_at: string
          decision: string
          dismiss_reason: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          listing_id: string
          policy_version: string | null
          rules_evaluated: number
          scanned_at: string
          score: number
          signals: Json
          trigger_source: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          decision: string
          dismiss_reason?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          listing_id: string
          policy_version?: string | null
          rules_evaluated?: number
          scanned_at?: string
          score?: number
          signals?: Json
          trigger_source?: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          decision?: string
          dismiss_reason?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          listing_id?: string
          policy_version?: string | null
          rules_evaluated?: number
          scanned_at?: string
          score?: number
          signals?: Json
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_moderation_scans_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_notifications: {
        Row: {
          body: string | null
          created_at: string
          event: string
          id: string
          read_at: string | null
          report_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event: string
          id?: string
          read_at?: string | null
          report_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event?: string
          id?: string
          read_at?: string | null
          report_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          granted_reason: string | null
          platform_role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          granted_reason?: string | null
          platform_role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          granted_reason?: string | null
          platform_role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_platform_settings: {
        Row: {
          created_at: string
          description_ar: string | null
          key: string
          section: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          key: string
          section: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          key?: string
          section?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      mkt_point_ledger: {
        Row: {
          actor_id: string | null
          balance_after: number
          balance_before: number
          created_at: string
          direction: string
          id: string
          kind: string
          listing_id: string | null
          meta: Json
          op_id: string | null
          points: number
          promotion_id: string | null
          reason: string | null
          wallet_id: string
        }
        Insert: {
          actor_id?: string | null
          balance_after: number
          balance_before: number
          created_at?: string
          direction: string
          id?: string
          kind: string
          listing_id?: string | null
          meta?: Json
          op_id?: string | null
          points: number
          promotion_id?: string | null
          reason?: string | null
          wallet_id: string
        }
        Update: {
          actor_id?: string | null
          balance_after?: number
          balance_before?: number
          created_at?: string
          direction?: string
          id?: string
          kind?: string
          listing_id?: string | null
          meta?: Json
          op_id?: string | null
          points?: number
          promotion_id?: string | null
          reason?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_point_ledger_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_point_ledger_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mkt_point_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_point_wallets: {
        Row: {
          account_id: string
          account_type: string
          balance_points: number
          created_at: string
          id: string
          lifetime_granted: number
          lifetime_spent: number
          updated_at: string
        }
        Insert: {
          account_id: string
          account_type: string
          balance_points?: number
          created_at?: string
          id?: string
          lifetime_granted?: number
          lifetime_spent?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          account_type?: string
          balance_points?: number
          created_at?: string
          id?: string
          lifetime_granted?: number
          lifetime_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      mkt_quote_request_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          quote_request_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          quote_request_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          quote_request_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_quote_request_files_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "mkt_quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_quote_requests: {
        Row: {
          budget: number | null
          buyer_user_id: string
          city: string | null
          contact_phone: string | null
          contact_preference: string
          created_at: string
          description: string | null
          id: string
          listing_id: string | null
          location_note: string | null
          needed_date: string | null
          quantity: number | null
          seller_tenant_id: string | null
          seller_user_id: string | null
          status: string
          status_note: string | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          buyer_user_id?: string
          city?: string | null
          contact_phone?: string | null
          contact_preference?: string
          created_at?: string
          description?: string | null
          id?: string
          listing_id?: string | null
          location_note?: string | null
          needed_date?: string | null
          quantity?: number | null
          seller_tenant_id?: string | null
          seller_user_id?: string | null
          status?: string
          status_note?: string | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          buyer_user_id?: string
          city?: string | null
          contact_phone?: string | null
          contact_preference?: string
          created_at?: string
          description?: string | null
          id?: string
          listing_id?: string | null
          location_note?: string | null
          needed_date?: string | null
          quantity?: number | null
          seller_tenant_id?: string | null
          seller_user_id?: string | null
          status?: string
          status_note?: string | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_quote_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_quote_requests_seller_tenant_id_fkey"
            columns: ["seller_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_report_files: {
        Row: {
          appeal_id: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          report_id: string
          side: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          appeal_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          report_id: string
          side?: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string
        }
        Update: {
          appeal_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          report_id?: string
          side?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_report_files_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_report_messages: {
        Row: {
          attachment_path: string | null
          body: string
          channel: string
          created_at: string
          due_at: string | null
          id: string
          kind: string
          report_id: string
          sender_side: string
          sender_user_id: string | null
        }
        Insert: {
          attachment_path?: string | null
          body: string
          channel: string
          created_at?: string
          due_at?: string | null
          id?: string
          kind?: string
          report_id: string
          sender_side: string
          sender_user_id?: string | null
        }
        Update: {
          attachment_path?: string | null
          body?: string
          channel?: string
          created_at?: string
          due_at?: string | null
          id?: string
          kind?: string
          report_id?: string
          sender_side?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_report_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_report_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          report_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          report_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_report_notes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_report_reasons: {
        Row: {
          code: string
          created_at: string
          default_severity: string
          is_active: boolean
          name_ar: string
          name_en: string
          requires_note: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_severity?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          requires_note?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_severity?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          requires_note?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mkt_report_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          report_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          report_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          report_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_reports: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          decision: string | null
          decision_reason: string | null
          first_response_at: string | null
          id: string
          listing_id: string
          listing_snapshot: Json | null
          merged_into: string | null
          note: string | null
          owner_user_id: string | null
          priority: string
          public_outcome: string | null
          reason: string
          reason_code: string | null
          ref_no: string | null
          reopened_at: string | null
          reporter_confirmed: boolean
          reporter_user_id: string
          resolution_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          sla_due_at: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          decision?: string | null
          decision_reason?: string | null
          first_response_at?: string | null
          id?: string
          listing_id: string
          listing_snapshot?: Json | null
          merged_into?: string | null
          note?: string | null
          owner_user_id?: string | null
          priority?: string
          public_outcome?: string | null
          reason: string
          reason_code?: string | null
          ref_no?: string | null
          reopened_at?: string | null
          reporter_confirmed?: boolean
          reporter_user_id?: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          sla_due_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          decision?: string | null
          decision_reason?: string | null
          first_response_at?: string | null
          id?: string
          listing_id?: string
          listing_snapshot?: Json | null
          merged_into?: string | null
          note?: string | null
          owner_user_id?: string | null
          priority?: string
          public_outcome?: string | null
          reason?: string
          reason_code?: string | null
          ref_no?: string | null
          reopened_at?: string | null
          reporter_confirmed?: boolean
          reporter_user_id?: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          sla_due_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_reports_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "mkt_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_reports_reason_code_fkey"
            columns: ["reason_code"]
            isOneToOne: false
            referencedRelation: "mkt_report_reasons"
            referencedColumns: ["code"]
          },
        ]
      }
      mkt_staff_leaves: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          kind: string
          note: string | null
          starts_on: string
          substitute_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          kind?: string
          note?: string | null
          starts_on: string
          substitute_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          kind?: string
          note?: string | null
          starts_on?: string
          substitute_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_staff_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          perm: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          perm: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          perm?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_staff_status: {
        Row: {
          accepts_auto: boolean
          capacity_limit: number
          created_at: string
          department: string | null
          last_assigned_at: string | null
          note: string | null
          pre_leave_state: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          work_state: string
        }
        Insert: {
          accepts_auto?: boolean
          capacity_limit?: number
          created_at?: string
          department?: string | null
          last_assigned_at?: string | null
          note?: string | null
          pre_leave_state?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_state?: string
        }
        Update: {
          accepts_auto?: boolean
          capacity_limit?: number
          created_at?: string
          department?: string | null
          last_assigned_at?: string | null
          note?: string | null
          pre_leave_state?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_staff_status_department_fkey"
            columns: ["department"]
            isOneToOne: false
            referencedRelation: "mkt_workforce_departments"
            referencedColumns: ["code"]
          },
        ]
      }
      mkt_storage_cleanup: {
        Row: {
          bucket: string
          enqueued_at: string
          error: string | null
          id: string
          object_key: string
          processed_at: string | null
          reason: string
        }
        Insert: {
          bucket?: string
          enqueued_at?: string
          error?: string | null
          id?: string
          object_key: string
          processed_at?: string | null
          reason: string
        }
        Update: {
          bucket?: string
          enqueued_at?: string
          error?: string | null
          id?: string
          object_key?: string
          processed_at?: string | null
          reason?: string
        }
        Relationships: []
      }
      mkt_user_activity: {
        Row: {
          ad_id: string | null
          category_id: string | null
          city_id: string | null
          created_at: string
          event_type: string
          id: string
          search_query: string | null
          user_id: string
        }
        Insert: {
          ad_id?: string | null
          category_id?: string | null
          city_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          search_query?: string | null
          user_id?: string
        }
        Update: {
          ad_id?: string | null
          category_id?: string | null
          city_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          search_query?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_user_activity_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_user_activity_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mkt_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_user_activity_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_user_contacts: {
        Row: {
          country_id: string | null
          created_at: string
          phone_e164: string | null
          phone_status: string
          phone_visibility: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          phone_e164?: string | null
          phone_status?: string
          phone_visibility?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          phone_e164?: string | null
          phone_status?: string
          phone_visibility?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_user_contacts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_user_market_preferences: {
        Row: {
          browsing_city_id: string | null
          browsing_country_id: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          browsing_city_id?: string | null
          browsing_country_id?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          browsing_city_id?: string | null
          browsing_country_id?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_user_market_preferences_city_id_fkey"
            columns: ["browsing_city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_user_market_preferences_country_id_fkey"
            columns: ["browsing_country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_user_profiles: {
        Row: {
          about: string | null
          avatar_url: string | null
          city: string | null
          city_id: string | null
          country_id: string | null
          created_at: string
          display_name: string
          headline: string | null
          is_published: boolean
          joined_at: string
          personalize_suggestions: boolean
          public_email: string | null
          public_whatsapp: string | null
          region: string | null
          show_email: boolean
          show_whatsapp: boolean
          updated_at: string
          user_id: string
          username: string
          verification_status: string
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          city?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          display_name: string
          headline?: string | null
          is_published?: boolean
          joined_at?: string
          personalize_suggestions?: boolean
          public_email?: string | null
          public_whatsapp?: string | null
          region?: string | null
          show_email?: boolean
          show_whatsapp?: boolean
          updated_at?: string
          user_id: string
          username: string
          verification_status?: string
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          city?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          display_name?: string
          headline?: string | null
          is_published?: boolean
          joined_at?: string
          personalize_suggestions?: boolean
          public_email?: string | null
          public_whatsapp?: string | null
          region?: string | null
          show_email?: boolean
          show_whatsapp?: boolean
          updated_at?: string
          user_id?: string
          username?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_user_profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_user_profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_verification_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          request_id: string | null
          tenant_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          request_id?: string | null
          tenant_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          request_id?: string | null
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_verification_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mkt_verification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_verification_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_verification_files: {
        Row: {
          created_at: string
          doc_kind: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          request_id: string
          size_bytes: number | null
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_kind?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          request_id: string
          size_bytes?: number | null
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_kind?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          request_id?: string
          size_bytes?: number | null
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_verification_files_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mkt_verification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_verification_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_verification_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          note: string | null
          status: string
          submitted_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          note?: string | null
          status?: string
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          note?: string | null
          status?: string
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_verification_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_workforce_departments: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name_ar: string
          name_en: string
          queue_kinds: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          queue_kinds?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          queue_kinds?: string[]
          sort_order?: number
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "notifications_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aliases: {
        Row: {
          alias_name: string
          catalog_id: string | null
          created_at: string
          created_by: string | null
          id: string
          normalized_name: string | null
          supplier_id: string | null
          tenant_id: string
          unified_product_id: string
        }
        Insert: {
          alias_name: string
          catalog_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_name?: string | null
          supplier_id?: string | null
          tenant_id?: string
          unified_product_id: string
        }
        Update: {
          alias_name?: string
          catalog_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_name?: string | null
          supplier_id?: string | null
          tenant_id?: string
          unified_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_unified_product_id_fkey"
            columns: ["unified_product_id"]
            isOneToOne: false
            referencedRelation: "unified_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          default_unit: string | null
          description: string | null
          id: string
          normalized_name: string
          original_name: string
          sku: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          unified_product_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_unit?: string | null
          description?: string | null
          id?: string
          normalized_name: string
          original_name: string
          sku?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          unified_product_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_unit?: string | null
          description?: string | null
          id?: string
          normalized_name?: string
          original_name?: string
          sku?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          unified_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_catalog_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_catalog_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_catalog_unified_product_id_fkey"
            columns: ["unified_product_id"]
            isOneToOne: false
            referencedRelation: "unified_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          catalog_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          exclusion_reason: string | null
          id: string
          invoice_date: string | null
          invoice_id: string | null
          project_id: string | null
          quantity: number | null
          source_line_item_id: string
          status: string
          supplier_id: string | null
          tenant_id: string
          total_with_vat: number | null
          unified_product_id: string | null
          unit: string | null
          unit_price: number
          vat_rate: number | null
        }
        Insert: {
          catalog_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          exclusion_reason?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id?: string | null
          project_id?: string | null
          quantity?: number | null
          source_line_item_id: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total_with_vat?: number | null
          unified_product_id?: string | null
          unit?: string | null
          unit_price: number
          vat_rate?: number | null
        }
        Update: {
          catalog_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          exclusion_reason?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id?: string | null
          project_id?: string | null
          quantity?: number | null
          source_line_item_id?: string
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total_with_vat?: number | null
          unified_product_id?: string | null
          unit?: string | null
          unit_price?: number
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_settlements"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "product_price_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_source_line_item_id_fkey"
            columns: ["source_line_item_id"]
            isOneToOne: true
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_unified_product_id_fkey"
            columns: ["unified_product_id"]
            isOneToOne: false
            referencedRelation: "unified_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_unit_conversions: {
        Row: {
          approved_by: string | null
          created_at: string
          factor: number
          from_unit: string
          id: string
          note: string | null
          tenant_id: string
          to_unit: string
          unified_product_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          factor: number
          from_unit: string
          id?: string
          note?: string | null
          tenant_id?: string
          to_unit: string
          unified_product_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          factor?: number
          from_unit?: string
          id?: string
          note?: string | null
          tenant_id?: string
          to_unit?: string
          unified_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_unit_conversions_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_unit_conversions_unified_product_id_fkey"
            columns: ["unified_product_id"]
            isOneToOne: false
            referencedRelation: "unified_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_tenant_id: string | null
          always_select_account: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          last_tenant_id: string | null
          locale: Database["public"]["Enums"]["app_locale"]
          must_change_password: boolean
          national_id: string | null
          phone: string | null
          supervisor_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_tenant_id?: string | null
          always_select_account?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_tenant_id?: string | null
          locale?: Database["public"]["Enums"]["app_locale"]
          must_change_password?: boolean
          national_id?: string | null
          phone?: string | null
          supervisor_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_tenant_id?: string | null
          always_select_account?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_tenant_id?: string | null
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
            foreignKeyName: "profiles_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_last_tenant_id_fkey"
            columns: ["last_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
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
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "project_members_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_supervisors: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          is_active: boolean
          membership_type: string
          project_id: string
          start_date: string
          supervisor_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          is_active?: boolean
          membership_type?: string
          project_id: string
          start_date?: string
          supervisor_id: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          is_active?: boolean
          membership_type?: string
          project_id?: string
          start_date?: string
          supervisor_id?: string
          tenant_id?: string
          updated_at?: string
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
          {
            foreignKeyName: "project_supervisors_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          project_type: Database["public"]["Enums"]["project_kind"]
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          supervisor_id: string
          tenant_id: string
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
          project_type?: Database["public"]["Enums"]["project_kind"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supervisor_id: string
          tenant_id?: string
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
          project_type?: Database["public"]["Enums"]["project_kind"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supervisor_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "projects_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_boundaries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          length_m: number | null
          notes: string | null
          project_id: string
          projection_m: number | null
          setback_m: number | null
          side: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          length_m?: number | null
          notes?: string | null
          project_id: string
          projection_m?: number | null
          setback_m?: number | null
          side: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          length_m?: number | null
          notes?: string | null
          project_id?: string
          projection_m?: number | null
          setback_m?: number | null
          side?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_boundaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_boundaries_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_contracts: {
        Row: {
          amount: number | null
          attachment_id: string | null
          contract_date: string | null
          contract_no: string | null
          contract_type: string | null
          contractor: string | null
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          engineering_office: string | null
          id: string
          inspection_body: string | null
          insurance_company: string | null
          is_current: boolean
          notes: string | null
          owner_name: string | null
          previous_id: string | null
          project_id: string
          project_owner: string | null
          start_date: string | null
          status: string
          supervision_office: string | null
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          amount?: number | null
          attachment_id?: string | null
          contract_date?: string | null
          contract_no?: string | null
          contract_type?: string | null
          contractor?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          engineering_office?: string | null
          id?: string
          inspection_body?: string | null
          insurance_company?: string | null
          is_current?: boolean
          notes?: string | null
          owner_name?: string | null
          previous_id?: string | null
          project_id: string
          project_owner?: string | null
          start_date?: string | null
          status?: string
          supervision_office?: string | null
          tenant_id?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount?: number | null
          attachment_id?: string | null
          contract_date?: string | null
          contract_no?: string | null
          contract_type?: string | null
          contractor?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          engineering_office?: string | null
          id?: string
          inspection_body?: string | null
          insurance_company?: string | null
          is_current?: boolean
          notes?: string | null
          owner_name?: string | null
          previous_id?: string | null
          project_id?: string
          project_owner?: string | null
          start_date?: string | null
          status?: string
          supervision_office?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_contracts_previous_id_fkey"
            columns: ["previous_id"]
            isOneToOne: false
            referencedRelation: "property_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_contracts_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_coordinates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          latitude: number
          longitude: number
          notes: string | null
          project_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          latitude: number
          longitude: number
          notes?: string | null
          project_id: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          latitude?: number
          longitude?: number
          notes?: string | null
          project_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_coordinates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_coordinates_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_deeds: {
        Row: {
          attachment_id: string | null
          copy_no: string | null
          created_at: string
          created_by: string | null
          deed_date: string | null
          deed_no: string | null
          doc_status: string
          doc_type: string
          id: string
          is_current: boolean
          issue_date: string | null
          issuer: string | null
          notes: string | null
          owner_registry_no: string | null
          previous_id: string | null
          project_id: string
          qr_payload: string | null
          registry_property_no: string | null
          tenant_id: string
          updated_at: string
          verify_url: string | null
          version: number
        }
        Insert: {
          attachment_id?: string | null
          copy_no?: string | null
          created_at?: string
          created_by?: string | null
          deed_date?: string | null
          deed_no?: string | null
          doc_status?: string
          doc_type?: string
          id?: string
          is_current?: boolean
          issue_date?: string | null
          issuer?: string | null
          notes?: string | null
          owner_registry_no?: string | null
          previous_id?: string | null
          project_id: string
          qr_payload?: string | null
          registry_property_no?: string | null
          tenant_id?: string
          updated_at?: string
          verify_url?: string | null
          version?: number
        }
        Update: {
          attachment_id?: string | null
          copy_no?: string | null
          created_at?: string
          created_by?: string | null
          deed_date?: string | null
          deed_no?: string | null
          doc_status?: string
          doc_type?: string
          id?: string
          is_current?: boolean
          issue_date?: string | null
          issuer?: string | null
          notes?: string | null
          owner_registry_no?: string | null
          previous_id?: string | null
          project_id?: string
          qr_payload?: string | null
          registry_property_no?: string | null
          tenant_id?: string
          updated_at?: string
          verify_url?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_deeds_previous_id_fkey"
            columns: ["previous_id"]
            isOneToOne: false
            referencedRelation: "property_deeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_deeds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_deeds_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_document_requests: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          document_id: string
          id: string
          payload: Json | null
          project_id: string
          reason: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          document_id: string
          id?: string
          payload?: Json | null
          project_id: string
          reason: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          document_id?: string
          id?: string
          payload?: Json | null
          project_id?: string
          reason?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_document_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "property_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_document_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_document_requests_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          doc_category: string
          doc_status: string
          file_hash: string | null
          file_name: string
          file_size: number | null
          id: string
          is_current: boolean
          mime_type: string | null
          previous_id: string | null
          project_id: string
          source_request_id: string | null
          storage_path: string
          tenant_id: string
          title: string | null
          unit_id: string | null
          updated_at: string
          version: number
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          doc_category?: string
          doc_status?: string
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          mime_type?: string | null
          previous_id?: string | null
          project_id: string
          source_request_id?: string | null
          storage_path: string
          tenant_id?: string
          title?: string | null
          unit_id?: string | null
          updated_at?: string
          version?: number
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          doc_category?: string
          doc_status?: string
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          mime_type?: string | null
          previous_id?: string | null
          project_id?: string
          source_request_id?: string | null
          storage_path?: string
          tenant_id?: string
          title?: string | null
          unit_id?: string | null
          updated_at?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_previous_id_fkey"
            columns: ["previous_id"]
            isOneToOne: false
            referencedRelation: "property_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "property_units"
            referencedColumns: ["id"]
          },
        ]
      }
      property_land: {
        Row: {
          additional_no: string | null
          amanah: string | null
          block_no: string | null
          city: string | null
          created_at: string
          created_by: string | null
          district: string | null
          id: string
          land_area: number | null
          land_use: string | null
          latitude: number | null
          longitude: number | null
          map_url: string | null
          municipality: string | null
          national_address: string | null
          notes: string | null
          parcel_no: string | null
          plan_no: string | null
          postal_code: string | null
          project_id: string
          property_no: string | null
          region: string | null
          street_name: string | null
          street_width: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          additional_no?: string | null
          amanah?: string | null
          block_no?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          id?: string
          land_area?: number | null
          land_use?: string | null
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          municipality?: string | null
          national_address?: string | null
          notes?: string | null
          parcel_no?: string | null
          plan_no?: string | null
          postal_code?: string | null
          project_id: string
          property_no?: string | null
          region?: string | null
          street_name?: string | null
          street_width?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          additional_no?: string | null
          amanah?: string | null
          block_no?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          id?: string
          land_area?: number | null
          land_use?: string | null
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          municipality?: string | null
          national_address?: string | null
          notes?: string | null
          parcel_no?: string | null
          plan_no?: string | null
          postal_code?: string | null
          project_id?: string
          property_no?: string | null
          region?: string | null
          street_name?: string | null
          street_width?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_land_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_land_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_license_components: {
        Row: {
          area: number | null
          created_at: string
          floors_count: number | null
          id: string
          license_id: string
          name: string
          notes: string | null
          project_id: string
          tenant_id: string
          units_count: number | null
          usage: string | null
        }
        Insert: {
          area?: number | null
          created_at?: string
          floors_count?: number | null
          id?: string
          license_id: string
          name: string
          notes?: string | null
          project_id: string
          tenant_id?: string
          units_count?: number | null
          usage?: string | null
        }
        Update: {
          area?: number | null
          created_at?: string
          floors_count?: number | null
          id?: string
          license_id?: string
          name?: string
          notes?: string | null
          project_id?: string
          tenant_id?: string
          units_count?: number | null
          usage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_license_components_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "property_licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_license_components_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_license_components_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_licenses: {
        Row: {
          amanah: string | null
          attachment_id: string | null
          build_ratio: number | null
          building_description: string | null
          building_type: string | null
          building_use: string | null
          built_area: number | null
          conditions: string | null
          contractor: string | null
          created_at: string
          created_by: string | null
          design_office: string | null
          expiry_date: string | null
          fees: number | null
          floors_count: number | null
          holder_id: string | null
          holder_name: string | null
          id: string
          issue_date: string | null
          land_area: number | null
          license_no: string | null
          license_status: string | null
          license_type: string | null
          municipality: string | null
          notes: string | null
          ownership_doc_no: string | null
          ownership_doc_type: string | null
          parcel_no: string | null
          payment_date: string | null
          payment_no: string | null
          plan_no: string | null
          project_id: string
          request_type: string | null
          supervision_office: string | null
          tenant_id: string
          units_count: number | null
          updated_at: string
        }
        Insert: {
          amanah?: string | null
          attachment_id?: string | null
          build_ratio?: number | null
          building_description?: string | null
          building_type?: string | null
          building_use?: string | null
          built_area?: number | null
          conditions?: string | null
          contractor?: string | null
          created_at?: string
          created_by?: string | null
          design_office?: string | null
          expiry_date?: string | null
          fees?: number | null
          floors_count?: number | null
          holder_id?: string | null
          holder_name?: string | null
          id?: string
          issue_date?: string | null
          land_area?: number | null
          license_no?: string | null
          license_status?: string | null
          license_type?: string | null
          municipality?: string | null
          notes?: string | null
          ownership_doc_no?: string | null
          ownership_doc_type?: string | null
          parcel_no?: string | null
          payment_date?: string | null
          payment_no?: string | null
          plan_no?: string | null
          project_id: string
          request_type?: string | null
          supervision_office?: string | null
          tenant_id?: string
          units_count?: number | null
          updated_at?: string
        }
        Update: {
          amanah?: string | null
          attachment_id?: string | null
          build_ratio?: number | null
          building_description?: string | null
          building_type?: string | null
          building_use?: string | null
          built_area?: number | null
          conditions?: string | null
          contractor?: string | null
          created_at?: string
          created_by?: string | null
          design_office?: string | null
          expiry_date?: string | null
          fees?: number | null
          floors_count?: number | null
          holder_id?: string | null
          holder_name?: string | null
          id?: string
          issue_date?: string | null
          land_area?: number | null
          license_no?: string | null
          license_status?: string | null
          license_type?: string | null
          municipality?: string | null
          notes?: string | null
          ownership_doc_no?: string | null
          ownership_doc_type?: string | null
          parcel_no?: string | null
          payment_date?: string | null
          payment_no?: string | null
          plan_no?: string | null
          project_id?: string
          request_type?: string | null
          supervision_office?: string | null
          tenant_id?: string
          units_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_licenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_licenses_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          id_number: string | null
          id_type: string | null
          nationality: string | null
          notes: string | null
          ownership_end: string | null
          ownership_start: string | null
          project_id: string
          purchase_date: string | null
          share_percent: number
          tenant_id: string
          transfer_value: number | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          nationality?: string | null
          notes?: string | null
          ownership_end?: string | null
          ownership_start?: string | null
          project_id: string
          purchase_date?: string | null
          share_percent?: number
          tenant_id?: string
          transfer_value?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          nationality?: string | null
          notes?: string | null
          ownership_end?: string | null
          ownership_start?: string | null
          project_id?: string
          purchase_date?: string | null
          share_percent?: number
          tenant_id?: string
          transfer_value?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_partition_reports: {
        Row: {
          approved_at: string | null
          attachment_id: string | null
          created_at: string
          created_by: string | null
          deed_area: number | null
          deed_no: string | null
          engineering_office: string | null
          id: string
          license_no: string | null
          notes: string | null
          project_id: string
          report_no: string | null
          request_no: string | null
          tenant_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          attachment_id?: string | null
          created_at?: string
          created_by?: string | null
          deed_area?: number | null
          deed_no?: string | null
          engineering_office?: string | null
          id?: string
          license_no?: string | null
          notes?: string | null
          project_id: string
          report_no?: string | null
          request_no?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          attachment_id?: string | null
          created_at?: string
          created_by?: string | null
          deed_area?: number | null
          deed_no?: string | null
          engineering_office?: string | null
          id?: string
          license_no?: string | null
          notes?: string | null
          project_id?: string
          report_no?: string | null
          request_no?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_partition_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_partition_reports_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_partition_reports_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "property_units"
            referencedColumns: ["id"]
          },
        ]
      }
      property_plans: {
        Row: {
          attachment_id: string | null
          created_at: string
          created_by: string | null
          design_office: string | null
          id: string
          is_current: boolean
          issue_date: string | null
          name: string
          notes: string | null
          plan_no: string | null
          plan_type: string
          preview_attachment_id: string | null
          previous_id: string | null
          project_id: string
          review_status: string
          revision_no: string | null
          tenant_id: string
          unit_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          attachment_id?: string | null
          created_at?: string
          created_by?: string | null
          design_office?: string | null
          id?: string
          is_current?: boolean
          issue_date?: string | null
          name: string
          notes?: string | null
          plan_no?: string | null
          plan_type?: string
          preview_attachment_id?: string | null
          previous_id?: string | null
          project_id: string
          review_status?: string
          revision_no?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          attachment_id?: string | null
          created_at?: string
          created_by?: string | null
          design_office?: string | null
          id?: string
          is_current?: boolean
          issue_date?: string | null
          name?: string
          notes?: string | null
          plan_no?: string | null
          plan_type?: string
          preview_attachment_id?: string | null
          previous_id?: string | null
          project_id?: string
          review_status?: string
          revision_no?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_plans_previous_id_fkey"
            columns: ["previous_id"]
            isOneToOne: false
            referencedRelation: "property_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_plans_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_service_results: {
        Row: {
          account_no: string | null
          applied_at: string | null
          applied_service_id: string | null
          capacity: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          executed_at: string | null
          id: string
          meter_no: string | null
          notes: string | null
          payment_no: string | null
          previous_value: Json | null
          project_id: string
          request_no: string | null
          service_status: string
          service_type: string
          source_request_id: string
          status: string
          subscription_no: string | null
          tenant_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_no?: string | null
          applied_at?: string | null
          applied_service_id?: string | null
          capacity?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          executed_at?: string | null
          id?: string
          meter_no?: string | null
          notes?: string | null
          payment_no?: string | null
          previous_value?: Json | null
          project_id: string
          request_no?: string | null
          service_status?: string
          service_type: string
          source_request_id: string
          status?: string
          subscription_no?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          account_no?: string | null
          applied_at?: string | null
          applied_service_id?: string | null
          capacity?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          executed_at?: string | null
          id?: string
          meter_no?: string | null
          notes?: string | null
          payment_no?: string | null
          previous_value?: Json | null
          project_id?: string
          request_no?: string | null
          service_status?: string
          service_type?: string
          source_request_id?: string
          status?: string
          subscription_no?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_service_results_applied_service_id_fkey"
            columns: ["applied_service_id"]
            isOneToOne: false
            referencedRelation: "property_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_service_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_service_results_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_service_results_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_service_results_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "property_units"
            referencedColumns: ["id"]
          },
        ]
      }
      property_services: {
        Row: {
          account_no: string | null
          activated_at: string | null
          capacity: string | null
          created_at: string
          created_by: string | null
          id: string
          installed_at: string | null
          meter_no: string | null
          notes: string | null
          payment_no: string | null
          project_id: string
          request_no: string | null
          service_status: string
          service_type: string
          source_request_id: string | null
          subscription_no: string | null
          tenant_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_no?: string | null
          activated_at?: string | null
          capacity?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          installed_at?: string | null
          meter_no?: string | null
          notes?: string | null
          payment_no?: string | null
          project_id: string
          request_no?: string | null
          service_status?: string
          service_type: string
          source_request_id?: string | null
          subscription_no?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          account_no?: string | null
          activated_at?: string | null
          capacity?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          installed_at?: string | null
          meter_no?: string | null
          notes?: string | null
          payment_no?: string | null
          project_id?: string
          request_no?: string | null
          service_status?: string
          service_type?: string
          source_request_id?: string | null
          subscription_no?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_services_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_services_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_services_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "property_units"
            referencedColumns: ["id"]
          },
        ]
      }
      property_unit_components: {
        Row: {
          area: number | null
          created_at: string
          id: string
          name: string
          notes: string | null
          part_type: string
          project_id: string
          quantity: number | null
          tenant_id: string
          unit_id: string
        }
        Insert: {
          area?: number | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          part_type?: string
          project_id: string
          quantity?: number | null
          tenant_id?: string
          unit_id: string
        }
        Update: {
          area?: number | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          part_type?: string
          project_id?: string
          quantity?: number | null
          tenant_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_unit_components_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_unit_components_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_unit_components_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "property_units"
            referencedColumns: ["id"]
          },
        ]
      }
      property_units: {
        Row: {
          created_at: string
          created_by: string | null
          current_owner: string | null
          floor: string | null
          id: string
          land_share_area: number | null
          land_share_percent: number | null
          notes: string | null
          orientation: string | null
          private_area: number | null
          project_id: string
          purchase_date: string | null
          shared_area: number | null
          status: string
          tenant_id: string
          total_area: number | null
          transfer_value: number | null
          unit_code: string | null
          unit_no: string
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_owner?: string | null
          floor?: string | null
          id?: string
          land_share_area?: number | null
          land_share_percent?: number | null
          notes?: string | null
          orientation?: string | null
          private_area?: number | null
          project_id: string
          purchase_date?: string | null
          shared_area?: number | null
          status?: string
          tenant_id?: string
          total_area?: number | null
          transfer_value?: number | null
          unit_code?: string | null
          unit_no: string
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_owner?: string | null
          floor?: string | null
          id?: string
          land_share_area?: number | null
          land_share_percent?: number | null
          notes?: string | null
          orientation?: string | null
          private_area?: number | null
          project_id?: string
          purchase_date?: string | null
          shared_area?: number | null
          status?: string
          tenant_id?: string
          total_area?: number | null
          transfer_value?: number | null
          unit_code?: string | null
          unit_no?: string
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_units_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_events: {
        Row: {
          bucket: string
          created_at: string
          id: string
          key_hash: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          key_hash: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          key_hash?: string
        }
        Relationships: []
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_change_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_change_requests_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "request_field_versions_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      request_message_reads: {
        Row: {
          message_id: string
          read_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          tenant_id?: string
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
          {
            foreignKeyName: "request_message_reads_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          visibility: string
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
          tenant_id?: string
          visibility?: string
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
          tenant_id?: string
          visibility?: string
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
          {
            foreignKeyName: "request_messages_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_reminders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_reminders_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "request_status_history_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          request_scope: string
          request_type: string
          requester_id: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["request_status"]
          status_note: string | null
          supervisor_id: string | null
          tenant_id: string
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
          request_scope?: string
          request_type: string
          requester_id?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          status_note?: string | null
          supervisor_id?: string | null
          tenant_id?: string
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
          request_scope?: string
          request_type?: string
          requester_id?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          status_note?: string | null
          supervisor_id?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "requests_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisors_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          unified_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_type: string
          invited_by: string
          invited_permissions: string[]
          invited_role: string
          membership_end: string | null
          membership_start: string | null
          membership_type: string | null
          mobile: string | null
          project_ids: string[]
          revoked_at: string | null
          revoked_by: string | null
          service_type: string | null
          status: string
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invitation_type: string
          invited_by: string
          invited_permissions?: string[]
          invited_role: string
          membership_end?: string | null
          membership_start?: string | null
          membership_type?: string | null
          mobile?: string | null
          project_ids?: string[]
          revoked_at?: string | null
          revoked_by?: string | null
          service_type?: string | null
          status?: string
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invitation_type?: string
          invited_by?: string
          invited_permissions?: string[]
          invited_role?: string
          membership_end?: string | null
          membership_start?: string | null
          membership_type?: string | null
          mobile?: string | null
          project_ids?: string[]
          revoked_at?: string | null
          revoked_by?: string | null
          service_type?: string | null
          status?: string
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          joined_at: string | null
          last_seen_at: string | null
          membership_end: string | null
          membership_start: string | null
          role: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string | null
          last_seen_at?: string | null
          membership_end?: string | null
          membership_start?: string | null
          role: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string | null
          last_seen_at?: string | null
          membership_end?: string | null
          membership_start?: string | null
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activity: string | null
          city: string | null
          commercial_registration_number: string | null
          contact_info: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_default: boolean
          is_test: boolean
          legal_name: string | null
          name_ar: string
          name_en: string
          onboarding_completed_at: string | null
          personal_user_id: string | null
          phone: string | null
          provider_type: string | null
          specialty: string | null
          status: string
          tenant_type: string
          updated_at: string
          usage_type: string | null
          vat_number: string | null
        }
        Insert: {
          activity?: string | null
          city?: string | null
          commercial_registration_number?: string | null
          contact_info?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_default?: boolean
          is_test?: boolean
          legal_name?: string | null
          name_ar: string
          name_en: string
          onboarding_completed_at?: string | null
          personal_user_id?: string | null
          phone?: string | null
          provider_type?: string | null
          specialty?: string | null
          status?: string
          tenant_type?: string
          updated_at?: string
          usage_type?: string | null
          vat_number?: string | null
        }
        Update: {
          activity?: string | null
          city?: string | null
          commercial_registration_number?: string | null
          contact_info?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_default?: boolean
          is_test?: boolean
          legal_name?: string | null
          name_ar?: string
          name_en?: string
          onboarding_completed_at?: string | null
          personal_user_id?: string | null
          phone?: string | null
          provider_type?: string | null
          specialty?: string | null
          status?: string
          tenant_type?: string
          updated_at?: string
          usage_type?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      unified_products: {
        Row: {
          arabic_name: string
          category: string | null
          created_at: string
          created_by: string | null
          default_unit: string | null
          description: string | null
          english_name: string | null
          id: string
          normalized_name: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          arabic_name: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_unit?: string | null
          description?: string | null
          english_name?: string | null
          id?: string
          normalized_name?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          arabic_name?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_unit?: string | null
          description?: string | null
          english_name?: string | null
          id?: string
          normalized_name?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_products_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      mkt_public_listing_licenses: {
        Row: {
          ad_license_expiry: string | null
          ad_license_number: string | null
          advertiser_role: string | null
          listing_id: string | null
          practice_license_number: string | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_listing_licenses_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_account: {
        Args: { _tenant_id: string }
        Returns: {
          is_personal: boolean
          role: string
          tenant_id: string
          tenant_type: string
        }[]
      }
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
      can_access_invoice_object: { Args: { _name: string }; Returns: boolean }
      can_access_project: { Args: { _project_id: string }; Returns: boolean }
      can_access_request: { Args: { _request_id: string }; Returns: boolean }
      can_access_supervisor: {
        Args: { _supervisor_id: string }
        Returns: boolean
      }
      can_approve_property: { Args: { _project_id: string }; Returns: boolean }
      can_edit_property: { Args: { _project_id: string }; Returns: boolean }
      can_view_invoice: { Args: { _invoice_id: string }; Returns: boolean }
      can_view_property: { Args: { _project_id: string }; Returns: boolean }
      can_view_property_document: {
        Args: { _document_id: string }
        Returns: boolean
      }
      can_view_property_documents: {
        Args: { _project_id: string }
        Returns: boolean
      }
      can_view_property_services: {
        Args: { _project_id: string }
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
      create_workspace: {
        Args: {
          _activity?: string
          _city?: string
          _confirm_duplicate?: boolean
          _contact_info?: Json
          _cr_number?: string
          _email?: string
          _legal_name?: string
          _name_ar: string
          _name_en?: string
          _phone?: string
          _provider_type?: string
          _specialty?: string
          _tenant_type: string
          _usage_type?: string
          _vat_number?: string
        }
        Returns: string
      }
      current_role_label: { Args: never; Returns: string }
      current_supervisor_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      current_tenant_ids: { Args: never; Returns: string[] }
      custody_base_effect: {
        Args: {
          p_amount: number
          p_type: Database["public"]["Enums"]["custody_txn_type"]
        }
        Returns: number
      }
      document_analysis_apply: {
        Args: { _analysis_id: string; _only_field_keys?: string[] }
        Returns: Json
      }
      document_analysis_raw_text: {
        Args: { _analysis_id: string }
        Returns: string
      }
      document_analysis_resolve_conflict: {
        Args: { _conflict_id: string; _keep?: string; _resolution: string }
        Returns: undefined
      }
      document_analysis_review_field: {
        Args: { _action: string; _field_id: string; _value?: string }
        Returns: undefined
      }
      ensure_personal_tenant: { Args: never; Returns: string }
      has_perm: { Args: { _perm: string }; Returns: boolean }
      has_permission_in_tenant: {
        Args: { _permission: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_tenant: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_permission: {
        Args: { _permission: string; _tenant_id: string }
        Returns: boolean
      }
      has_tenant_role: {
        Args: { _role: string; _tenant_id: string }
        Returns: boolean
      }
      invitation_accept: {
        Args: { _token: string }
        Returns: {
          activated: boolean
          memberships: number
          tenant_id: string
        }[]
      }
      invitation_accept_by_id: {
        Args: { _id: string }
        Returns: {
          activated: boolean
          memberships: number
          tenant_id: string
        }[]
      }
      invitation_create: {
        Args: {
          _email: string
          _invitation_type: string
          _invited_role: string
          _membership_end?: string
          _membership_start?: string
          _membership_type?: string
          _mobile?: string
          _permissions?: string[]
          _project_ids?: string[]
          _service_type?: string
        }
        Returns: {
          expires_at: string
          id: string
          token: string
        }[]
      }
      invitation_preview: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          invitation_type: string
          invited_role: string
          masked_email: string
          state: string
          tenant_name_ar: string
          tenant_name_en: string
        }[]
      }
      invitation_revoke: {
        Args: { _id: string; _reason?: string }
        Returns: undefined
      }
      invoice_settled_amount: {
        Args: { p_invoice_id: string }
        Returns: number
      }
      is_accountant: { Args: never; Returns: boolean }
      is_active_member: {
        Args: { _tenant_id: string; _user_id?: string }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      is_supervisor_user: { Args: never; Returns: boolean }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
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
      mask_id_number: { Args: { _value: string }; Returns: string }
      membership_set_access: {
        Args: {
          _membership_end?: string
          _membership_id: string
          _membership_start?: string
          _permissions?: string[]
          _project_ids?: string[]
          _role: string
        }
        Returns: undefined
      }
      membership_set_status: {
        Args: { _membership_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      mkt_account_context: {
        Args: { _account_key: string }
        Returns: {
          account_key: string
          activity: string
          avatar_url: string
          can_publish: boolean
          city: string
          kind: string
          membership_id: string
          name: string
          permissions: string[]
          role: string
          slug: string
          tenant_id: string
          verification_status: string
        }[]
      }
      mkt_account_country_id: { Args: { _user_id: string }; Returns: string }
      mkt_activity_migration_report: {
        Args: never
        Returns: {
          bucket: string
          legacy_text: string
          matched_activity_id: string
          matched_name_ar: string
          score: number
          tenant_id: string
        }[]
      }
      mkt_admin_activities: {
        Args: {
          _group_id?: string
          _include_inactive?: boolean
          _limit?: number
          _q?: string
        }
        Returns: {
          alias_count: number
          child_count: number
          created_at: string
          entity_count: number
          group_id: string
          group_name_ar: string
          id: string
          is_active: boolean
          merged_into_id: string
          name_ar: string
          name_en: string
          parent_id: string
          parent_name_ar: string
        }[]
      }
      mkt_admin_add_note: {
        Args: { _body: string; _subject_id: string; _subject_type: string }
        Returns: string
      }
      mkt_admin_assignments_for: {
        Args: { _kind: string; _subject_ids: string[] }
        Returns: {
          assignee: string
          assignee_label: string
          claimed_at: string
          is_mine: boolean
          subject_id: string
        }[]
      }
      mkt_admin_audit_log: {
        Args: {
          _entity?: string
          _limit?: number
          _offset?: number
          _search?: string
        }
        Returns: {
          action: string
          actor_id: string
          actor_name: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json
          old_value: Json
          reason: string
        }[]
      }
      mkt_admin_business_detail: { Args: { _tenant_id: string }; Returns: Json }
      mkt_admin_businesses: {
        Args: { _limit?: number; _offset?: number; _search?: string }
        Returns: {
          city: string
          country: string
          created_at: string
          listings_count: number
          main_activity: string
          name: string
          officer_name: string
          restriction: string
          restriction_id: string
          slug: string
          status: string
          sub_activities: string[]
          tenant_id: string
          verification_status: string
        }[]
      }
      mkt_admin_call_abuse: {
        Args: { _limit?: number }
        Returns: {
          declined_count: number
          no_answer_count: number
          restricted_until: string
          total_calls: number
          user_id: string
        }[]
      }
      mkt_admin_can: { Args: { _perm: string }; Returns: boolean }
      mkt_admin_claim: {
        Args: { _kind: string; _subject_id: string }
        Returns: string
      }
      mkt_admin_create_activity: {
        Args: {
          _group_id: string
          _name_ar: string
          _name_en?: string
          _parent_id?: string
        }
        Returns: string
      }
      mkt_admin_create_group: {
        Args: {
          _name_ar: string
          _name_en?: string
          _slug?: string
          _sort_order?: number
        }
        Returns: string
      }
      mkt_admin_grant_points: {
        Args: {
          _account_id: string
          _account_type: string
          _points: number
          _reason: string
        }
        Returns: Json
      }
      mkt_admin_listing_action: {
        Args: {
          _action: string
          _days?: number
          _listing_id: string
          _reason?: string
        }
        Returns: string
      }
      mkt_admin_listing_brief: {
        Args: { _listing_id: string }
        Returns: {
          city: string
          expires_at: string
          id: string
          published_at: string
          ref_no: string
          rejection_reason: string
          slug: string
          status: string
          title: string
        }[]
      }
      mkt_admin_listing_create_for: {
        Args: {
          _owner_user_id: string
          _reason: string
          _tenant_id: string
          _title: string
        }
        Returns: string
      }
      mkt_admin_listing_detail: { Args: { _listing_id: string }; Returns: Json }
      mkt_admin_listing_events: {
        Args: {
          _actor?: string
          _event_type?: string
          _from?: string
          _limit?: number
          _offset?: number
          _search?: string
          _to?: string
        }
        Returns: {
          actor_id: string
          actor_label: string
          can_view_ip: boolean
          created_at: string
          event_type: string
          id: string
          ip_address: string
          listing_city: string
          listing_id: string
          listing_ref: string
          listing_status: string
          listing_title: string
          meta: Json
          user_agent: string
        }[]
      }
      mkt_admin_listing_extend: {
        Args: { _days: number; _listing_id: string }
        Returns: undefined
      }
      mkt_admin_listing_moderation: { Args: { _id: string }; Returns: Json }
      mkt_admin_listing_reports: {
        Args: {
          _assignee?: string
          _from?: string
          _limit?: number
          _offset?: number
          _priority?: string
          _reason?: string
          _search?: string
          _status?: string
          _suspended_only?: boolean
          _to?: string
        }
        Returns: {
          assigned_to: string
          assignee_label: string
          can_view_reporter: boolean
          created_at: string
          id: string
          last_action: string
          last_action_at: string
          listing_city: string
          listing_id: string
          listing_ref: string
          listing_report_count: number
          listing_slug: string
          listing_status: string
          listing_title: string
          note: string
          owner_business: string
          owner_label: string
          priority: string
          reason_code: string
          reason_name_ar: string
          reason_name_en: string
          ref_no: string
          reporter_alias: string
          reporter_identity: string
          reporter_invalid_count: number
          severity: string
          sla_due_at: string
          status: string
          total_count: number
          updated_at: string
        }[]
      }
      mkt_admin_log_doc_access: {
        Args: { _kind: string; _path: string; _subject_id: string }
        Returns: undefined
      }
      mkt_admin_moderation_rule_delete: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      mkt_admin_moderation_rule_save: {
        Args: {
          _action: string
          _category: string
          _id: string
          _is_active: boolean
          _kind: string
          _lang: string
          _notes: string
          _pattern: string
          _severity: string
          _weight: number
        }
        Returns: string
      }
      mkt_admin_notes_list: {
        Args: { _subject_id: string; _subject_type: string }
        Returns: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
        }[]
      }
      mkt_admin_notify_user: {
        Args: { _body: string; _title: string; _user_id: string }
        Returns: undefined
      }
      mkt_admin_overview: { Args: never; Returns: Json }
      mkt_admin_refund_promotion: {
        Args: { _promotion_id: string; _reason: string }
        Returns: Json
      }
      mkt_admin_release: {
        Args: { _kind: string; _reason: string; _subject_id: string }
        Returns: undefined
      }
      mkt_admin_rescan_listing: { Args: { _id: string }; Returns: Json }
      mkt_admin_roles: {
        Args: never
        Returns: {
          display_name: string
          email: string
          granted_at: string
          platform_role: string
          staff_perms: string[]
          user_id: string
        }[]
      }
      mkt_admin_scan_dismiss: {
        Args: { _reason: string; _scan_id: string }
        Returns: undefined
      }
      mkt_admin_search: { Args: { _limit?: number; _q: string }; Returns: Json }
      mkt_admin_set_platform_role: {
        Args: { _reason: string; _role: string; _user_id: string }
        Returns: undefined
      }
      mkt_admin_set_setting: {
        Args: { _key: string; _reason: string; _value: Json }
        Returns: undefined
      }
      mkt_admin_set_staff_perm: {
        Args: {
          _granted: boolean
          _perm: string
          _reason: string
          _user_id: string
        }
        Returns: undefined
      }
      mkt_admin_subject_action: {
        Args: {
          _action: string
          _days?: number
          _reason: string
          _subject_id: string
          _subject_type: string
        }
        Returns: undefined
      }
      mkt_admin_subject_ids: {
        Args: { _listing_ids?: string[]; _report_ids?: string[] }
        Returns: {
          kind: string
          source_id: string
          user_id: string
        }[]
      }
      mkt_admin_transfer: {
        Args: {
          _kind: string
          _reason: string
          _subject_id: string
          _to: string
        }
        Returns: string
      }
      mkt_admin_update_activity: {
        Args: {
          _id: string
          _is_active?: boolean
          _name_ar?: string
          _name_en?: string
        }
        Returns: undefined
      }
      mkt_admin_update_group: {
        Args: {
          _id: string
          _is_active?: boolean
          _name_ar?: string
          _name_en?: string
          _sort_order?: number
        }
        Returns: undefined
      }
      mkt_admin_user_detail: { Args: { _user_id: string }; Returns: Json }
      mkt_admin_users: {
        Args: { _limit?: number; _offset?: number; _search?: string }
        Returns: {
          businesses_count: number
          created_at: string
          display_name: string
          email: string
          last_seen_at: string
          listings_count: number
          phone: string
          restriction: string
          restriction_id: string
          user_id: string
          username: string
          verification_status: string
        }[]
      }
      mkt_admin_verification_detail: {
        Args: { _request_id: string }
        Returns: Json
      }
      mkt_advertiser_safety: {
        Args: { _tenant_id?: string; _user_id: string }
        Returns: Json
      }
      mkt_business_details_complete: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      mkt_business_is_restricted: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      mkt_business_number_taken: {
        Args: { _cr_number: string; _unified_number: string }
        Returns: boolean
      }
      mkt_call_can_call: { Args: { _listing_id: string }; Returns: Json }
      mkt_call_peer: { Args: { _call_id: string }; Returns: Json }
      mkt_call_start: { Args: { _listing_id: string }; Returns: Json }
      mkt_call_transition: {
        Args: { _call_id: string; _reason?: string; _status: string }
        Returns: Json
      }
      mkt_calls_sweep: { Args: never; Returns: number }
      mkt_can_manage_business: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      mkt_can_manage_listing: { Args: { _id: string }; Returns: boolean }
      mkt_can_publish_as_business: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      mkt_can_review_identity: { Args: never; Returns: boolean }
      mkt_can_view_conversation: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      mkt_can_view_quote: { Args: { _quote_id: string }; Returns: boolean }
      mkt_enforce_listing: {
        Args: {
          _action: string
          _days?: number
          _reason?: string
          _report_id: string
        }
        Returns: undefined
      }
      mkt_entity_activities_list: {
        Args: { _tenant_id: string }
        Returns: {
          activity_id: string
          group_id: string
          group_name_ar: string
          group_name_en: string
          is_primary: boolean
          name_ar: string
          name_en: string
          parent_id: string
        }[]
      }
      mkt_expire_re_licenses: { Args: never; Returns: number }
      mkt_has_restriction: {
        Args: {
          _restrictions: string[]
          _subject_id: string
          _subject_type: string
        }
        Returns: boolean
      }
      mkt_increment_views: { Args: { _listing_id: string }; Returns: undefined }
      mkt_is_auto_publish_op: { Args: never; Returns: boolean }
      mkt_is_call_party: { Args: { _call_id: string }; Returns: boolean }
      mkt_is_listing_op: { Args: never; Returns: boolean }
      mkt_is_moderation_op: { Args: never; Returns: boolean }
      mkt_is_platform_admin: { Args: never; Returns: boolean }
      mkt_is_super_admin: { Args: never; Returns: boolean }
      mkt_is_system_action: { Args: never; Returns: boolean }
      mkt_is_system_owner: { Args: never; Returns: boolean }
      mkt_is_verified_business: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      mkt_lift_expired_restrictions: { Args: never; Returns: number }
      mkt_lift_restriction: {
        Args: { _reason: string; _restriction_id: string }
        Returns: undefined
      }
      mkt_listing_archive: { Args: { _id: string }; Returns: string }
      mkt_listing_delete: { Args: { _id: string }; Returns: string }
      mkt_listing_duplicate: { Args: { _id: string }; Returns: string }
      mkt_listing_event_log: {
        Args: { _limit?: number; _listing_id: string }
        Returns: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          ip_address: string
          meta: Json
          user_agent: string
        }[]
      }
      mkt_listing_exact_location: {
        Args: { p_listing_id: string }
        Returns: {
          address_text: string
          latitude: number
          location_accuracy: number
          location_source: string
          longitude: number
        }[]
      }
      mkt_listing_image_delete: {
        Args: { _image: string; _listing: string }
        Returns: undefined
      }
      mkt_listing_image_set_cover: {
        Args: { _image: string; _listing: string }
        Returns: undefined
      }
      mkt_listing_images_reorder: {
        Args: { _ids: string[]; _listing: string }
        Returns: undefined
      }
      mkt_listing_images_required: {
        Args: { _listing: string }
        Returns: boolean
      }
      mkt_listing_is_public: { Args: { _id: string }; Returns: boolean }
      mkt_listing_pause: { Args: { _id: string }; Returns: string }
      mkt_listing_promote: {
        Args: { _days: number; _id: string; _op_id: string }
        Returns: Json
      }
      mkt_listing_promotion_overview: { Args: { _id: string }; Returns: Json }
      mkt_listing_reactivate: { Args: { _id: string }; Returns: string }
      mkt_listing_renew: {
        Args: { _days?: number; _id: string }
        Returns: string
      }
      mkt_listing_republish: {
        Args: { _days: number; _listing_id: string; _reason: string }
        Returns: string
      }
      mkt_listing_restore: { Args: { _id: string }; Returns: string }
      mkt_listing_resume: { Args: { _id: string }; Returns: string }
      mkt_listing_submit: { Args: { _id: string }; Returns: string }
      mkt_listing_track: {
        Args: { _id: string; _kind: string }
        Returns: undefined
      }
      mkt_listing_track_share: { Args: { _id: string }; Returns: undefined }
      mkt_log_listing_event: {
        Args: { _event_type: string; _listing_id: string; _meta?: Json }
        Returns: undefined
      }
      mkt_merge_activities: {
        Args: { _note?: string; _source_id: string; _target_id: string }
        Returns: undefined
      }
      mkt_moderation_normalize: { Args: { _t: string }; Returns: string }
      mkt_moderation_scan_listing: {
        Args: { _id: string; _trigger?: string }
        Returns: Json
      }
      mkt_my_accounts: {
        Args: never
        Returns: {
          account_key: string
          activity: string
          avatar_url: string
          can_publish: boolean
          city: string
          kind: string
          membership_id: string
          name: string
          permissions: string[]
          role: string
          slug: string
          tenant_id: string
          verification_status: string
        }[]
      }
      mkt_my_moderation_cases: {
        Args: never
        Returns: {
          can_appeal: boolean
          closed_at: string
          created_at: string
          decision: string
          decision_reason: string
          listing_id: string
          listing_title: string
          reason_code: string
          ref_no: string
          report_id: string
          severity: string
          status: string
        }[]
      }
      mkt_my_platform_role: { Args: never; Returns: Json }
      mkt_norm_activity_text: { Args: { _t: string }; Returns: string }
      mkt_norm_digits: { Args: { _t: string }; Returns: string }
      mkt_notify: {
        Args: {
          _body?: string
          _event: string
          _report_id: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      mkt_perm_aliases: { Args: { _perm: string }; Returns: string[] }
      mkt_person_is_restricted: { Args: { _user_id: string }; Returns: boolean }
      mkt_promotion_prices: { Args: never; Returns: Json }
      mkt_public_business: {
        Args: { _slug: string }
        Returns: {
          about: string
          active_listings: number
          can_edit: boolean
          city_ar: string
          city_en: string
          display_name_ar: string
          display_name_en: string
          entity_type: string
          headline: string
          is_member: boolean
          joined_at: string
          logo_url: string
          main_activity: string
          public_email: string
          public_phone: string
          public_website: string
          public_whatsapp: string
          region: string
          slug: string
          sub_activities: string[]
          verification_status: string
        }[]
      }
      mkt_public_business_categories: {
        Args: { _slug: string }
        Returns: {
          category_id: string
          listings_count: number
          name_ar: string
          name_en: string
          slug: string
        }[]
      }
      mkt_public_business_listings: {
        Args: {
          _category_id?: string
          _limit?: number
          _offset?: number
          _slug: string
        }
        Returns: {
          category_id: string
          city: string
          city_id: string
          cover_image_url: string
          created_at: string
          currency: string
          deal_kind: string
          district: string
          id: string
          item_condition: string
          price: number
          price_on_request: boolean
          price_unit: string
          published_at: string
          slug: string
          subcategory_id: string
          summary: string
          title: string
          type_code: string
          views_count: number
        }[]
      }
      mkt_public_person: {
        Args: { _username: string }
        Returns: {
          about: string
          active_listings: number
          avatar_url: string
          city_ar: string
          city_en: string
          display_name: string
          headline: string
          is_owner: boolean
          joined_at: string
          public_email: string
          public_phone: string
          public_whatsapp: string
          username: string
          verification_status: string
        }[]
      }
      mkt_public_person_categories: {
        Args: { _username: string }
        Returns: {
          category_id: string
          listings_count: number
          name_ar: string
          name_en: string
          slug: string
        }[]
      }
      mkt_public_person_listings: {
        Args: {
          _category_id?: string
          _limit?: number
          _offset?: number
          _username: string
        }
        Returns: {
          category_id: string
          city: string
          city_id: string
          cover_image_url: string
          created_at: string
          currency: string
          deal_kind: string
          district: string
          id: string
          item_condition: string
          price: number
          price_on_request: boolean
          price_unit: string
          published_at: string
          slug: string
          subcategory_id: string
          summary: string
          title: string
          type_code: string
          views_count: number
        }[]
      }
      mkt_public_phone: { Args: { _user_id: string }; Returns: string }
      mkt_queue_perm: { Args: { _kind: string }; Returns: string }
      mkt_re_license_active: {
        Args: { p_listing_id: string }
        Returns: boolean
      }
      mkt_report_apply_status: {
        Args: { _reason: string; _report_id: string; _status: string }
        Returns: undefined
      }
      mkt_report_assign: {
        Args: { _assignee: string; _report_id: string }
        Returns: undefined
      }
      mkt_report_close: {
        Args: {
          _decision: string
          _public_outcome: string
          _reason: string
          _report_id: string
        }
        Returns: undefined
      }
      mkt_report_conflict: { Args: { _report_id: string }; Returns: boolean }
      mkt_report_is_advertiser: {
        Args: { _report_id: string }
        Returns: boolean
      }
      mkt_report_is_reporter: { Args: { _report_id: string }; Returns: boolean }
      mkt_report_listing_action: {
        Args: {
          _action: string
          _days?: number
          _reason: string
          _report_id: string
        }
        Returns: string
      }
      mkt_report_merge: {
        Args: { _into: string; _report_id: string }
        Returns: undefined
      }
      mkt_report_message: {
        Args: {
          _attachment_path?: string
          _body: string
          _channel: string
          _due_days?: number
          _kind?: string
          _report_id: string
        }
        Returns: undefined
      }
      mkt_report_note: {
        Args: { _body: string; _report_id: string }
        Returns: undefined
      }
      mkt_report_reopen: {
        Args: { _reason: string; _report_id: string }
        Returns: undefined
      }
      mkt_report_reply: {
        Args: { _attachment_path?: string; _body: string; _report_id: string }
        Returns: undefined
      }
      mkt_report_require: {
        Args: { _perm: string; _report_id: string }
        Returns: undefined
      }
      mkt_report_set_priority: {
        Args: { _priority: string; _report_id: string; _severity?: string }
        Returns: undefined
      }
      mkt_report_set_status: {
        Args: { _reason?: string; _report_id: string; _status: string }
        Returns: undefined
      }
      mkt_report_staff_can_view: {
        Args: { _report_id: string }
        Returns: boolean
      }
      mkt_report_staff_options: {
        Args: never
        Returns: {
          label: string
          user_id: string
        }[]
      }
      mkt_report_stats: { Args: never; Returns: Json }
      mkt_report_transition: {
        Args: { _reason?: string; _report_id: string; _to: string }
        Returns: string
      }
      mkt_report_transition_ok: {
        Args: { _from: string; _to: string }
        Returns: boolean
      }
      mkt_restrict_subject: {
        Args: {
          _days?: number
          _reason: string
          _report_id: string
          _restriction: string
          _subject_id: string
          _subject_type: string
        }
        Returns: string
      }
      mkt_review_activity_suggestion: {
        Args: {
          _activity_id?: string
          _decision: string
          _note?: string
          _suggestion_id: string
        }
        Returns: undefined
      }
      mkt_review_appeal: {
        Args: { _appeal_id: string; _reason: string; _status: string }
        Returns: undefined
      }
      mkt_review_listing: {
        Args: { _action: string; _listing_id: string; _reason?: string }
        Returns: undefined
      }
      mkt_review_verification: {
        Args: { _action: string; _reason?: string; _request_id: string }
        Returns: undefined
      }
      mkt_search_activities: {
        Args: {
          _group_id?: string
          _limit?: number
          _only_main?: boolean
          _parent_id?: string
          _q: string
        }
        Returns: {
          group_id: string
          group_name_ar: string
          group_name_en: string
          id: string
          match_kind: string
          matched_alias: string
          name_ar: string
          name_en: string
          parent_id: string
          parent_name_ar: string
          score: number
        }[]
      }
      mkt_set_entity_activities: {
        Args: {
          _main_activity_id: string
          _sub_activity_ids?: string[]
          _tenant_id: string
        }
        Returns: undefined
      }
      mkt_set_listing_status: {
        Args: { _listing_id: string; _reason?: string; _to: string }
        Returns: undefined
      }
      mkt_slugify: { Args: { _text: string }; Returns: string }
      mkt_staff_has: { Args: { _perm: string }; Returns: boolean }
      mkt_staff_on_leave: { Args: { _uid: string }; Returns: boolean }
      mkt_submit_appeal: {
        Args: { _reason: string; _report_id: string }
        Returns: string
      }
      mkt_submit_report: {
        Args: {
          _confirmed?: boolean
          _listing_id: string
          _note?: string
          _reason_code: string
        }
        Returns: {
          ref_no: string
          report_id: string
        }[]
      }
      mkt_suggest_activity: {
        Args: {
          _group_id?: string
          _parent_id?: string
          _raw_text: string
          _tenant_id?: string
        }
        Returns: string
      }
      mkt_sweep_expired_listings: { Args: never; Returns: Json }
      mkt_sweep_expired_re_licenses: { Args: never; Returns: number }
      mkt_user_blocked: { Args: { _restrictions: string[] }; Returns: boolean }
      mkt_user_can: { Args: { _perm: string; _uid: string }; Returns: boolean }
      mkt_wallet_for_listing: { Args: { _id: string }; Returns: string }
      mkt_workforce_add_leave: {
        Args: {
          _ends_on: string
          _kind: string
          _note: string
          _starts_on: string
          _substitute: string
          _user_id: string
        }
        Returns: string
      }
      mkt_workforce_autoqueue: {
        Args: { _kind: string; _priority?: string; _subject_id: string }
        Returns: undefined
      }
      mkt_workforce_cancel_leave: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      mkt_workforce_close_item: {
        Args: { _kind: string; _subject_id: string }
        Returns: undefined
      }
      mkt_workforce_distribute: {
        Args: { _kind?: string; _limit?: number }
        Returns: number
      }
      mkt_workforce_enqueue: {
        Args: {
          _due_at?: string
          _kind: string
          _priority?: string
          _subject_id: string
        }
        Returns: string
      }
      mkt_workforce_manage: { Args: never; Returns: boolean }
      mkt_workforce_my_status: {
        Args: never
        Returns: {
          accepts_auto: boolean
          can_manage: boolean
          capacity_limit: number
          department: string
          done_today: number
          effective_state: string
          on_leave: boolean
          open_count: number
          user_id: string
          work_state: string
        }[]
      }
      mkt_workforce_open_count: { Args: { _uid: string }; Returns: number }
      mkt_workforce_overview: { Args: never; Returns: Json }
      mkt_workforce_pick_assignee: { Args: { _kind: string }; Returns: string }
      mkt_workforce_queue: {
        Args: { _kind?: string; _limit?: number; _scope?: string }
        Returns: {
          assignee: string
          assignee_label: string
          auto_assigned: boolean
          claimed_at: string
          created_at: string
          due_at: string
          id: string
          is_mine: boolean
          kind: string
          priority: string
          progress: string
          subject_id: string
        }[]
      }
      mkt_workforce_refresh_leave_states: { Args: never; Returns: number }
      mkt_workforce_set_priority: {
        Args: {
          _kind: string
          _priority: string
          _reason: string
          _subject_id: string
        }
        Returns: undefined
      }
      mkt_workforce_set_progress: {
        Args: { _kind: string; _progress: string; _subject_id: string }
        Returns: undefined
      }
      mkt_workforce_set_staff: {
        Args: {
          _accepts_auto: boolean
          _capacity_limit: number
          _department: string
          _note: string
          _reason: string
          _user_id: string
          _work_state: string
        }
        Returns: undefined
      }
      mkt_workforce_staff: {
        Args: never
        Returns: {
          accepts_auto: boolean
          capacity_limit: number
          department: string
          done_today: number
          effective_state: string
          email: string
          label: string
          last_assigned_at: string
          leave_ends_on: string
          note: string
          on_leave: boolean
          open_count: number
          perms: string[]
          platform_role: string
          user_id: string
          work_state: string
        }[]
      }
      my_accounts: {
        Args: never
        Returns: {
          is_current: boolean
          is_owner: boolean
          is_personal: boolean
          last_seen_at: string
          masked_ref: string
          membership_status: string
          name_ar: string
          name_en: string
          role: string
          tenant_id: string
          tenant_type: string
        }[]
      }
      my_invitations: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          id: string
          invitation_type: string
          invited_role: string
          tenant_id: string
          tenant_name_ar: string
          tenant_name_en: string
        }[]
      }
      my_tenants: {
        Args: never
        Returns: {
          is_current: boolean
          name_ar: string
          name_en: string
          role: string
          tenant_id: string
        }[]
      }
      my_workspace_state: {
        Args: never
        Returns: {
          memberships: number
          own_workspaces: number
          pending_invitations: number
        }[]
      }
      normalize_doc_no: { Args: { p_value: string }; Returns: string }
      normalize_product_name: { Args: { _name: string }; Returns: string }
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
      project_exists: { Args: { _project_id: string }; Returns: boolean }
      project_membership_end: {
        Args: { _membership_id: string; _reason: string }
        Returns: undefined
      }
      project_membership_set: {
        Args: {
          _end_date?: string
          _membership_type?: string
          _project_id: string
          _start_date?: string
          _supervisor_id: string
        }
        Returns: string
      }
      property_completion: { Args: { _project_id: string }; Returns: Json }
      property_deed_add_version: {
        Args: { _payload: Json; _previous_id: string }
        Returns: string
      }
      property_document_add_version: {
        Args: { _payload: Json; _previous_id: string }
        Returns: string
      }
      property_document_request_decide: {
        Args: { _approve: boolean; _id: string; _reason?: string }
        Returns: undefined
      }
      property_document_restore: {
        Args: { _document_id: string; _reason: string }
        Returns: undefined
      }
      property_plan_add_version: {
        Args: { _payload: Json; _previous_id: string }
        Returns: string
      }
      property_service_result_apply: { Args: { _id: string }; Returns: string }
      property_service_result_decide: {
        Args: { _approve: boolean; _id: string; _reason?: string }
        Returns: undefined
      }
      property_summary: { Args: { _project_id: string }; Returns: Json }
      rate_limit_hit: {
        Args: { _bucket: string; _key: string; _limit: number; _window: string }
        Returns: boolean
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
      request_convert_to_project: {
        Args: { _project_id: string; _reason: string; _request_id: string }
        Returns: undefined
      }
      request_decide: {
        Args: { _decision: string; _note?: string; _request_id: string }
        Returns: undefined
      }
      request_execute: {
        Args: { _note?: string; _reference?: string; _request_id: string }
        Returns: Json
      }
      request_exists: { Args: { _request_id: string }; Returns: boolean }
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
          _visibility?: string
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
      set_active_tenant: { Args: { _tenant_id: string }; Returns: string }
      shares_active_tenant: { Args: { _user_id: string }; Returns: boolean }
      submit_portal_request: {
        Args: {
          _amount?: number
          _authority?: string
          _kind: string
          _notes_ar?: string
          _project_id?: string
          _request_date?: string
          _request_type?: string
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
      tenant_members_list: {
        Args: never
        Returns: {
          email: string
          full_name: string
          joined_at: string
          membership_end: string
          membership_id: string
          membership_start: string
          permissions: string[]
          phone: string
          project_names: string[]
          role: string
          status: string
          user_id: string
        }[]
      }
      tiv_add_verification: {
        Args: { _invoice_id: string; _v: Json }
        Returns: string
      }
      tiv_check_duplicate: {
        Args: {
          _file_hash?: string
          _invoice_date?: string
          _invoice_no?: string
          _qr_hash?: string
          _supplier_id?: string
          _zatca_uuid?: string
        }
        Returns: Json
      }
      tiv_decide_invoice: {
        Args: { _decision: string; _invoice_id: string; _note?: string }
        Returns: Json
      }
      tiv_detach_catalog: {
        Args: { _catalog_id: string; _reason: string }
        Returns: undefined
      }
      tiv_exclude_price: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      tiv_link_catalog: {
        Args: { _catalog_id: string; _reason?: string; _unified_id: string }
        Returns: undefined
      }
      tiv_match_supplier: {
        Args: { _name?: string; _vat?: string }
        Returns: Json
      }
      tiv_merge_products: {
        Args: { _from: string; _into: string; _reason: string }
        Returns: Json
      }
      tiv_review_line_item: {
        Args: {
          _decision: string
          _id: string
          _patch?: Json
          _reason?: string
        }
        Returns: Json
      }
      tiv_save_verified_invoice: { Args: { _payload: Json }; Returns: Json }
      tiv_set_verification_file: {
        Args: {
          _file_hash?: string
          _storage_path: string
          _verification_id: string
        }
        Returns: undefined
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
      project_kind:
        | "real_estate"
        | "construction"
        | "maintenance"
        | "supply"
        | "general"
      project_status: "active" | "on_hold" | "completed" | "cancelled" | "draft"
      record_status:
        | "draft"
        | "under_review"
        | "returned"
        | "approved"
        | "cancelled"
        | "tech_verified"
        | "needs_review"
        | "rejected"
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
      project_kind: [
        "real_estate",
        "construction",
        "maintenance",
        "supply",
        "general",
      ],
      project_status: ["active", "on_hold", "completed", "cancelled", "draft"],
      record_status: [
        "draft",
        "under_review",
        "returned",
        "approved",
        "cancelled",
        "tech_verified",
        "needs_review",
        "rejected",
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
