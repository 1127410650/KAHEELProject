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
      mkt_ad_campaign_events: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          kind: string
          session_key: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          kind: string
          session_key?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          kind?: string
          session_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_ad_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mkt_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_ad_campaigns: {
        Row: {
          asset_height: number
          asset_kind: string
          asset_path: string
          asset_width: number
          badge_ar: string
          badge_en: string
          click_url: string
          clicks: number
          created_at: string
          created_by: string | null
          cta_ar: string
          cta_en: string
          ends_at: string | null
          id: string
          impressions: number
          placement: string
          popup_mascot: string
          popup_side: string
          poster_path: string | null
          priority: number
          slug: string
          starts_at: string
          status: string
          subtitle_ar: string
          subtitle_en: string
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          asset_height?: number
          asset_kind?: string
          asset_path: string
          asset_width?: number
          badge_ar?: string
          badge_en?: string
          click_url?: string
          clicks?: number
          created_at?: string
          created_by?: string | null
          cta_ar?: string
          cta_en?: string
          ends_at?: string | null
          id?: string
          impressions?: number
          placement?: string
          popup_mascot?: string
          popup_side?: string
          poster_path?: string | null
          priority?: number
          slug: string
          starts_at?: string
          status?: string
          subtitle_ar?: string
          subtitle_en?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Update: {
          asset_height?: number
          asset_kind?: string
          asset_path?: string
          asset_width?: number
          badge_ar?: string
          badge_en?: string
          click_url?: string
          clicks?: number
          created_at?: string
          created_by?: string | null
          cta_ar?: string
          cta_en?: string
          ends_at?: string | null
          id?: string
          impressions?: number
          placement?: string
          popup_mascot?: string
          popup_side?: string
          poster_path?: string | null
          priority?: number
          slug?: string
          starts_at?: string
          status?: string
          subtitle_ar?: string
          subtitle_en?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      mkt_ad_credit_entries: {
        Row: {
          actor_user_id: string | null
          amount: number
          balance_after: number | null
          created_at: string
          id: string
          kind: string
          note: string | null
          payment_ref: string | null
          price_sar: number | null
          reference_id: string | null
          reference_type: string | null
          status: string
          wallet_id: string
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          balance_after?: number | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          payment_ref?: string | null
          price_sar?: number | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          wallet_id: string
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          balance_after?: number | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          payment_ref?: string | null
          price_sar?: number | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_ad_credit_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mkt_ad_credit_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_ad_credit_topups: {
        Row: {
          amount: number | null
          created_at: string
          credits: number
          currency: string
          entry_id: string | null
          id: string
          method: string
          paid_at: string | null
          provider: string | null
          provider_payment_id: string | null
          provider_session_id: string | null
          receipt_path: string | null
          reject_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          sender_note: string | null
          status: string
          transfer_ref: string | null
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          credits: number
          currency?: string
          entry_id?: string | null
          id?: string
          method: string
          paid_at?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          provider_session_id?: string | null
          receipt_path?: string | null
          reject_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_note?: string | null
          status?: string
          transfer_ref?: string | null
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          credits?: number
          currency?: string
          entry_id?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          provider_session_id?: string | null
          receipt_path?: string | null
          reject_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_note?: string | null
          status?: string
          transfer_ref?: string | null
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_ad_credit_topups_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "mkt_ad_credit_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_ad_credit_topups_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "mkt_ad_credit_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_ad_credit_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          owner_user_id: string
          tenant_id: string | null
          total_consumed: number
          total_purchased: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          owner_user_id: string
          tenant_id?: string | null
          total_consumed?: number
          total_purchased?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          owner_user_id?: string
          tenant_id?: string | null
          total_consumed?: number
          total_purchased?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_ad_credit_wallets_tenant_id_fkey"
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
          reopen_count: number
          reopened_at: string | null
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
          reopen_count?: number
          reopened_at?: string | null
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
          reopen_count?: number
          reopened_at?: string | null
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
      mkt_ai_image_jobs: {
        Row: {
          asset_path: string | null
          bytes: number
          cost_credits: number
          created_at: string
          detail: string | null
          finished_at: string | null
          id: string
          model: string
          preset: string | null
          prompt: string
          size_key: string
          status: string
          user_id: string
        }
        Insert: {
          asset_path?: string | null
          bytes?: number
          cost_credits?: number
          created_at?: string
          detail?: string | null
          finished_at?: string | null
          id?: string
          model: string
          preset?: string | null
          prompt: string
          size_key: string
          status?: string
          user_id: string
        }
        Update: {
          asset_path?: string | null
          bytes?: number
          cost_credits?: number
          created_at?: string
          detail?: string | null
          finished_at?: string | null
          id?: string
          model?: string
          preset?: string | null
          prompt?: string
          size_key?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_analytics_events: {
        Row: {
          browser: string | null
          category_id: string | null
          city_id: string | null
          city_name: string | null
          country_code: string | null
          device: string | null
          duration_ms: number | null
          event_type: string
          id: number
          listing_id: string | null
          message: string | null
          meta: Json
          occurred_at: string
          path: string | null
          query_text: string | null
          result_count: number | null
          session_id: string
          severity: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          category_id?: string | null
          city_id?: string | null
          city_name?: string | null
          country_code?: string | null
          device?: string | null
          duration_ms?: number | null
          event_type: string
          id?: never
          listing_id?: string | null
          message?: string | null
          meta?: Json
          occurred_at?: string
          path?: string | null
          query_text?: string | null
          result_count?: number | null
          session_id: string
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          category_id?: string | null
          city_id?: string | null
          city_name?: string | null
          country_code?: string | null
          device?: string | null
          duration_ms?: number | null
          event_type?: string
          id?: never
          listing_id?: string | null
          message?: string | null
          meta?: Json
          occurred_at?: string
          path?: string | null
          query_text?: string | null
          result_count?: number | null
          session_id?: string
          severity?: string | null
          user_id?: string | null
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
      mkt_attendance: {
        Row: {
          actual_minutes: number
          approved_at: string | null
          approved_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          created_by: string | null
          early_leave_minutes: number
          id: string
          late_minutes: number
          note: string | null
          overtime_minutes: number
          planned_minutes: number
          remote: boolean
          source: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          actual_minutes?: number
          approved_at?: string | null
          approved_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          created_by?: string | null
          early_leave_minutes?: number
          id?: string
          late_minutes?: number
          note?: string | null
          overtime_minutes?: number
          planned_minutes?: number
          remote?: boolean
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_date: string
        }
        Update: {
          actual_minutes?: number
          approved_at?: string | null
          approved_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          created_by?: string | null
          early_leave_minutes?: number
          id?: string
          late_minutes?: number
          note?: string | null
          overtime_minutes?: number
          planned_minutes?: number
          remote?: boolean
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      mkt_attendance_edits: {
        Row: {
          actor: string | null
          after_value: Json | null
          attendance_id: string
          before_value: Json | null
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          actor?: string | null
          after_value?: Json | null
          attendance_id: string
          before_value?: Json | null
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          actor?: string | null
          after_value?: Json | null
          attendance_id?: string
          before_value?: Json | null
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_attendance_edits_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "mkt_attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_bank_accounts: {
        Row: {
          bank_name: string
          beneficiary_name: string
          created_at: string
          deleted_at: string | null
          iban: string
          id: string
          owner_user_id: string
          status: string
          tenant_id: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bank_name: string
          beneficiary_name: string
          created_at?: string
          deleted_at?: string | null
          iban: string
          id?: string
          owner_user_id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bank_name?: string
          beneficiary_name?: string
          created_at?: string
          deleted_at?: string | null
          iban?: string
          id?: string
          owner_user_id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          qa_batch_id: string | null
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
          qa_batch_id?: string | null
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
          qa_batch_id?: string | null
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
          qa_batch_id: string | null
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
          qa_batch_id?: string | null
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
          qa_batch_id?: string | null
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
      mkt_call_requests: {
        Row: {
          call_id: string | null
          closed_reason: string | null
          created_at: string
          id: string
          listing_id: string
          owner_user_id: string
          requester_user_id: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          call_id?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          listing_id: string
          owner_user_id: string
          requester_user_id: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          call_id?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          owner_user_id?: string
          requester_user_id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_call_requests_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "mkt_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_call_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_call_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          call_mode: string
          calls_enabled: boolean
          created_at: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          call_mode?: string
          calls_enabled?: boolean
          created_at?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          call_mode?: string
          calls_enabled?: boolean
          created_at?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_call_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      mkt_cart_item_addons: {
        Row: {
          addon_id: string
          addon_price_snapshot: number
          cart_item_id: string
          created_at: string
          id: string
        }
        Insert: {
          addon_id: string
          addon_price_snapshot?: number
          cart_item_id: string
          created_at?: string
          id?: string
        }
        Update: {
          addon_id?: string
          addon_price_snapshot?: number
          cart_item_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_cart_item_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_cart_item_addons_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "mkt_cart_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          notes: string | null
          quantity: number
          store_item_id: string
          unit_price_snapshot: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          store_item_id: string
          unit_price_snapshot?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          store_item_id?: string
          unit_price_snapshot?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "mkt_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_cart_items_store_item_id_fkey"
            columns: ["store_item_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_item_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_carts: {
        Row: {
          active_account_id: string | null
          branch_id: string | null
          created_at: string
          customer_user_id: string
          expires_at: string
          id: string
          status: string
          storefront_id: string
          updated_at: string
        }
        Insert: {
          active_account_id?: string | null
          branch_id?: string | null
          created_at?: string
          customer_user_id?: string
          expires_at?: string
          id?: string
          status?: string
          storefront_id: string
          updated_at?: string
        }
        Update: {
          active_account_id?: string | null
          branch_id?: string | null
          created_at?: string
          customer_user_id?: string
          expires_at?: string
          id?: string
          status?: string
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_carts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_carts_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
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
      mkt_category_aliases: {
        Row: {
          alias: string
          alias_norm: string | null
          category_id: string
          created_at: string
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          alias: string
          alias_norm?: string | null
          category_id: string
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          alias?: string
          alias_norm?: string | null
          category_id?: string
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_category_aliases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mkt_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_chat_audit: {
        Row: {
          actor_user_id: string | null
          conversation_id: string | null
          created_at: string
          event: string
          id: string
          message_id: string | null
          meta: Json
        }
        Insert: {
          actor_user_id?: string | null
          conversation_id?: string | null
          created_at?: string
          event: string
          id?: string
          message_id?: string | null
          meta?: Json
        }
        Update: {
          actor_user_id?: string | null
          conversation_id?: string | null
          created_at?: string
          event?: string
          id?: string
          message_id?: string | null
          meta?: Json
        }
        Relationships: []
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
      mkt_conversation_state: {
        Row: {
          conversation_id: string
          hidden_at: string | null
          last_read_at: string | null
          muted: boolean
          user_id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string | null
          last_read_at?: string | null
          muted?: boolean
          user_id?: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string | null
          last_read_at?: string | null
          muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_conversation_state_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mkt_conversations"
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
          qa_batch_id: string | null
          seller_tenant_id: string | null
          seller_user_id: string | null
        }
        Insert: {
          buyer_user_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id: string
          qa_batch_id?: string | null
          seller_tenant_id?: string | null
          seller_user_id?: string | null
        }
        Update: {
          buyer_user_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string
          qa_batch_id?: string | null
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
      mkt_errand_captains: {
        Row: {
          city_id: string | null
          created_at: string
          display_name: string
          id: string
          is_online: boolean
          jobs_done: number
          last_lat: number | null
          last_lng: number | null
          last_seen_at: string | null
          phone: string | null
          rating_avg: number
          rating_count: number
          status: string
          updated_at: string
          user_id: string
          vehicle: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_online?: boolean
          jobs_done?: number
          last_lat?: number | null
          last_lng?: number | null
          last_seen_at?: string | null
          phone?: string | null
          rating_avg?: number
          rating_count?: number
          status?: string
          updated_at?: string
          user_id: string
          vehicle?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_online?: boolean
          jobs_done?: number
          last_lat?: number | null
          last_lng?: number | null
          last_seen_at?: string | null
          phone?: string | null
          rating_avg?: number
          rating_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_errand_captains_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_errand_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          request_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          request_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_errand_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mkt_errand_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_errand_offers: {
        Row: {
          captain_id: string
          created_at: string
          eta_minutes: number | null
          fee: number
          id: string
          note: string | null
          request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          captain_id: string
          created_at?: string
          eta_minutes?: number | null
          fee: number
          id?: string
          note?: string | null
          request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          captain_id?: string
          created_at?: string
          eta_minutes?: number | null
          fee?: number
          id?: string
          note?: string | null
          request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_errand_offers_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "mkt_errand_captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_errand_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mkt_errand_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_errand_requests: {
        Row: {
          accepted_at: string | null
          accepted_offer_id: string | null
          budget_estimate: number | null
          cancel_reason: string | null
          captain_id: string | null
          city_id: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          delivery_fee: number | null
          details: string
          dropoff_details: string | null
          dropoff_label: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          id: string
          offers_count: number
          photo_path: string | null
          pickup_details: string | null
          pickup_label: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          rating: number | null
          rating_comment: string | null
          service_slug: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_offer_id?: string | null
          budget_estimate?: number | null
          cancel_reason?: string | null
          captain_id?: string | null
          city_id?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivery_fee?: number | null
          details: string
          dropoff_details?: string | null
          dropoff_label: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          id?: string
          offers_count?: number
          photo_path?: string | null
          pickup_details?: string | null
          pickup_label?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          rating?: number | null
          rating_comment?: string | null
          service_slug: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_offer_id?: string | null
          budget_estimate?: number | null
          cancel_reason?: string | null
          captain_id?: string | null
          city_id?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivery_fee?: number | null
          details?: string
          dropoff_details?: string | null
          dropoff_label?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          id?: string
          offers_count?: number
          photo_path?: string | null
          pickup_details?: string | null
          pickup_label?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          rating?: number | null
          rating_comment?: string | null
          service_slug?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_errand_requests_accepted_offer_fkey"
            columns: ["accepted_offer_id"]
            isOneToOne: false
            referencedRelation: "mkt_errand_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_errand_requests_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "mkt_errand_captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_errand_requests_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_errand_requests_service_slug_fkey"
            columns: ["service_slug"]
            isOneToOne: false
            referencedRelation: "mkt_errand_services"
            referencedColumns: ["slug"]
          },
        ]
      }
      mkt_errand_services: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          kind: string
          name_ar: string
          name_en: string
          needs_pickup: boolean
          slug: string
          sort_order: number
          tagline_ar: string
          tagline_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          kind?: string
          name_ar: string
          name_en: string
          needs_pickup?: boolean
          slug: string
          sort_order?: number
          tagline_ar?: string
          tagline_en?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          kind?: string
          name_ar?: string
          name_en?: string
          needs_pickup?: boolean
          slug?: string
          sort_order?: number
          tagline_ar?: string
          tagline_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      mkt_external_integrations: {
        Row: {
          config_public: Json
          created_at: string
          created_by: string
          credentials_state: string
          direction: string
          display_name: string
          id: string
          integration_code: string
          last_connected_at: string | null
          last_error_code: string | null
          secret_ref: string | null
          status: string
          storefront_id: string
          updated_at: string
        }
        Insert: {
          config_public?: Json
          created_at?: string
          created_by?: string
          credentials_state?: string
          direction?: string
          display_name: string
          id?: string
          integration_code: string
          last_connected_at?: string | null
          last_error_code?: string | null
          secret_ref?: string | null
          status?: string
          storefront_id: string
          updated_at?: string
        }
        Update: {
          config_public?: Json
          created_at?: string
          created_by?: string
          credentials_state?: string
          direction?: string
          display_name?: string
          id?: string
          integration_code?: string
          last_connected_at?: string | null
          last_error_code?: string | null
          secret_ref?: string | null
          status?: string
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_external_integrations_integration_code_fkey"
            columns: ["integration_code"]
            isOneToOne: false
            referencedRelation: "mkt_integration_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "mkt_external_integrations_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_favorites: {
        Row: {
          created_at: string
          listing_id: string
          qa_batch_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          qa_batch_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          qa_batch_id?: string | null
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
      mkt_guide_outreach: {
        Row: {
          batch_id: string | null
          channel: string
          created_at: string
          id: string
          note: string | null
          place_id: string | null
          place_slug: string
          sent_by: string
        }
        Insert: {
          batch_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          note?: string | null
          place_id?: string | null
          place_slug: string
          sent_by?: string
        }
        Update: {
          batch_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          note?: string | null
          place_id?: string | null
          place_slug?: string
          sent_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_guide_outreach_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "mkt_guide_places"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_guide_place_claims: {
        Row: {
          contact: string | null
          created_at: string
          evidence: string | null
          id: string
          place_id: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          place_id: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          place_id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_guide_place_claims_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "mkt_guide_places"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_guide_place_photos: {
        Row: {
          bytes: number | null
          caption: string | null
          created_at: string
          height: number | null
          id: string
          kind: string
          mime: string | null
          place_id: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string
          width: number | null
        }
        Insert: {
          bytes?: number | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          mime?: string | null
          place_id: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by: string
          width?: number | null
        }
        Update: {
          bytes?: number | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          mime?: string | null
          place_id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_guide_place_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "mkt_guide_places"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_guide_place_promo_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          place_id: string
          promotion_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          place_id: string
          promotion_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          place_id?: string
          promotion_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_guide_place_promo_events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "mkt_guide_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_guide_place_promo_events_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "mkt_guide_place_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_guide_place_promotions: {
        Row: {
          clicks: number
          created_at: string
          credits_spent: number
          days: number
          ends_at: string
          id: string
          impressions: number
          owner_user_id: string
          place_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          credits_spent?: number
          days?: number
          ends_at: string
          id?: string
          impressions?: number
          owner_user_id: string
          place_id: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          clicks?: number
          created_at?: string
          credits_spent?: number
          days?: number
          ends_at?: string
          id?: string
          impressions?: number
          owner_user_id?: string
          place_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_guide_place_promotions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "mkt_guide_places"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_guide_place_reviews: {
        Row: {
          comment: string | null
          created_at: string
          display_name: string | null
          id: string
          place_id: string
          rating: number
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          place_id: string
          rating: number
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          place_id?: string
          rating?: number
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_guide_place_reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "mkt_guide_places"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_guide_places: {
        Row: {
          address: string | null
          address_status: string | null
          alt_names: string | null
          category: string | null
          city: string | null
          completeness: number | null
          created_at: string
          district: string | null
          email: string | null
          governorate: string | null
          id: string
          is_published: boolean
          latitude: number | null
          longitude: number | null
          map_url: string | null
          map_url_status: string | null
          name_ar: string
          name_en: string | null
          notes: string | null
          opening_hours: string | null
          operational_status: string | null
          ownership: string | null
          phone: string | null
          phone_status: string | null
          region: string | null
          retrieved_at: string | null
          sector: string | null
          services: string | null
          slug: string
          source_date: string | null
          source_extra: string | null
          source_label: string | null
          source_ref: string | null
          source_type: string | null
          stars: number | null
          subcategory: string | null
          subdistrict: string | null
          updated_at: string
          verification_note: string | null
          verification_status: string
          website: string | null
          whatsapp: string | null
          whatsapp_link: string | null
          whatsapp_status: string | null
        }
        Insert: {
          address?: string | null
          address_status?: string | null
          alt_names?: string | null
          category?: string | null
          city?: string | null
          completeness?: number | null
          created_at?: string
          district?: string | null
          email?: string | null
          governorate?: string | null
          id?: string
          is_published?: boolean
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          map_url_status?: string | null
          name_ar: string
          name_en?: string | null
          notes?: string | null
          opening_hours?: string | null
          operational_status?: string | null
          ownership?: string | null
          phone?: string | null
          phone_status?: string | null
          region?: string | null
          retrieved_at?: string | null
          sector?: string | null
          services?: string | null
          slug: string
          source_date?: string | null
          source_extra?: string | null
          source_label?: string | null
          source_ref?: string | null
          source_type?: string | null
          stars?: number | null
          subcategory?: string | null
          subdistrict?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          website?: string | null
          whatsapp?: string | null
          whatsapp_link?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          address?: string | null
          address_status?: string | null
          alt_names?: string | null
          category?: string | null
          city?: string | null
          completeness?: number | null
          created_at?: string
          district?: string | null
          email?: string | null
          governorate?: string | null
          id?: string
          is_published?: boolean
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          map_url_status?: string | null
          name_ar?: string
          name_en?: string | null
          notes?: string | null
          opening_hours?: string | null
          operational_status?: string | null
          ownership?: string | null
          phone?: string | null
          phone_status?: string | null
          region?: string | null
          retrieved_at?: string | null
          sector?: string | null
          services?: string | null
          slug?: string
          source_date?: string | null
          source_extra?: string | null
          source_label?: string | null
          source_ref?: string | null
          source_type?: string | null
          stars?: number | null
          subcategory?: string | null
          subdistrict?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          website?: string | null
          whatsapp?: string | null
          whatsapp_link?: string | null
          whatsapp_status?: string | null
        }
        Relationships: []
      }
      mkt_integration_catalog: {
        Row: {
          code: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          integration_kind: string
          is_active: boolean
          name_ar: string
          name_en: string
          sort_order: number
          supported_directions: string[]
        }
        Insert: {
          code: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          integration_kind: string
          is_active?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
          supported_directions?: string[]
        }
        Update: {
          code?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          integration_kind?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
          supported_directions?: string[]
        }
        Relationships: []
      }
      mkt_integration_events: {
        Row: {
          attempt_count: number
          created_at: string
          direction: string
          event_type: string
          external_id: string | null
          id: string
          idempotency_key: string
          integration_id: string
          last_error_code: string | null
          next_attempt_at: string | null
          payload_summary: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          direction: string
          event_type: string
          external_id?: string | null
          id?: string
          idempotency_key: string
          integration_id: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          payload_summary?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          direction?: string
          event_type?: string
          external_id?: string | null
          id?: string
          idempotency_key?: string
          integration_id?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          payload_summary?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_integration_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "mkt_external_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_job_runs: {
        Row: {
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          job: string
          ok: boolean
          result: Json
          source: string
          started_at: string
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job: string
          ok?: boolean
          result?: Json
          source?: string
          started_at?: string
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job?: string
          ok?: boolean
          result?: Json
          source?: string
          started_at?: string
        }
        Relationships: []
      }
      mkt_join_application_documents: {
        Row: {
          application_id: string
          created_at: string
          document_kind: string
          file_name: string
          id: string
          mime_type: string
          owner_user_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_kind: string
          file_name: string
          id?: string
          mime_type: string
          owner_user_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_kind?: string
          file_name?: string
          id?: string
          mime_type?: string
          owner_user_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_join_application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "mkt_join_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_join_application_events: {
        Row: {
          actor_user_id: string | null
          application_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          application_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          application_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_join_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "mkt_join_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_join_applications: {
        Row: {
          applicant_user_id: string
          application_kind: string
          application_number: string
          approved_at: string | null
          created_at: string
          decision_reason: string | null
          id: string
          payload: Json
          provider_category_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          applicant_user_id?: string
          application_kind: string
          application_number?: string
          approved_at?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          payload?: Json
          provider_category_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string
          application_kind?: string
          application_number?: string
          approved_at?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          payload?: Json
          provider_category_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_join_applications_provider_category_code_fkey"
            columns: ["provider_category_code"]
            isOneToOne: false
            referencedRelation: "mkt_provider_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "mkt_join_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          qa_batch_id: string | null
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
          qa_batch_id?: string | null
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
          qa_batch_id?: string | null
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
          qa_batch_id: string | null
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
          storefront_id: string | null
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
          qa_batch_id?: string | null
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
          storefront_id?: string | null
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
          qa_batch_id?: string | null
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
          storefront_id?: string | null
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
            foreignKeyName: "mkt_listings_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
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
      mkt_message_hides: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_message_hides_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mkt_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_messages: {
        Row: {
          attachment_path: string | null
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          delivered_at: string | null
          id: string
          kind: string
          moderation_state: string
          payload: Json
          qa_batch_id: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_user_id: string
        }
        Insert: {
          attachment_path?: string | null
          body?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivered_at?: string | null
          id?: string
          kind?: string
          moderation_state?: string
          payload?: Json
          qa_batch_id?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_user_id?: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivered_at?: string | null
          id?: string
          kind?: string
          moderation_state?: string
          payload?: Json
          qa_batch_id?: string | null
          read_at?: string | null
          reply_to_id?: string | null
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
          {
            foreignKeyName: "mkt_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "mkt_messages"
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
          qa_batch_id: string | null
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
          qa_batch_id?: string | null
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
          qa_batch_id?: string | null
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
      mkt_order_item_addons: {
        Row: {
          addon_name_snapshot: string
          created_at: string
          id: string
          order_item_id: string
          price_snapshot: number
        }
        Insert: {
          addon_name_snapshot: string
          created_at?: string
          id?: string
          order_item_id: string
          price_snapshot?: number
        }
        Update: {
          addon_name_snapshot?: string
          created_at?: string
          id?: string
          order_item_id?: string
          price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "mkt_order_item_addons_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "mkt_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_order_items: {
        Row: {
          addons_total: number
          created_at: string
          customer_notes: string | null
          id: string
          item_name_snapshot: string
          line_total: number
          order_id: string
          quantity: number
          store_item_id: string | null
          unit_price: number
          variant_name_snapshot: string | null
        }
        Insert: {
          addons_total?: number
          created_at?: string
          customer_notes?: string | null
          id?: string
          item_name_snapshot: string
          line_total: number
          order_id: string
          quantity: number
          store_item_id?: string | null
          unit_price: number
          variant_name_snapshot?: string | null
        }
        Update: {
          addons_total?: number
          created_at?: string
          customer_notes?: string | null
          id?: string
          item_name_snapshot?: string
          line_total?: number
          order_id?: string
          quantity?: number
          store_item_id?: string | null
          unit_price?: number
          variant_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "mkt_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_order_items_store_item_id_fkey"
            columns: ["store_item_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_order_status_history: {
        Row: {
          changed_by_account_id: string | null
          changed_by_user_id: string | null
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          order_id: string
        }
        Insert: {
          changed_by_account_id?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          order_id: string
        }
        Update: {
          changed_by_account_id?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "mkt_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_orders: {
        Row: {
          accepted_at: string | null
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          currency_code: string
          customer_account_id: string | null
          customer_name_snapshot: string | null
          customer_notes: string | null
          customer_phone_snapshot: string | null
          customer_user_id: string
          delivery_address_text: string | null
          delivery_city_id: string | null
          delivery_district: string | null
          delivery_fee: number
          delivery_latitude: number | null
          delivery_longitude: number | null
          fulfillment_type: string
          id: string
          idempotency_key: string
          location_precision: string
          merchant_account_id: string | null
          merchant_notes: string | null
          merchant_tenant_id: string | null
          merchant_user_id: string
          order_number: string
          order_status: string
          payment_method: string
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          qa_batch_id: string | null
          share_phone_with_merchant: boolean
          storefront_id: string
          submitted_at: string | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          currency_code?: string
          customer_account_id?: string | null
          customer_name_snapshot?: string | null
          customer_notes?: string | null
          customer_phone_snapshot?: string | null
          customer_user_id?: string
          delivery_address_text?: string | null
          delivery_city_id?: string | null
          delivery_district?: string | null
          delivery_fee?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          fulfillment_type: string
          id?: string
          idempotency_key: string
          location_precision?: string
          merchant_account_id?: string | null
          merchant_notes?: string | null
          merchant_tenant_id?: string | null
          merchant_user_id: string
          order_number: string
          order_status?: string
          payment_method?: string
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          qa_batch_id?: string | null
          share_phone_with_merchant?: boolean
          storefront_id: string
          submitted_at?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          currency_code?: string
          customer_account_id?: string | null
          customer_name_snapshot?: string | null
          customer_notes?: string | null
          customer_phone_snapshot?: string | null
          customer_user_id?: string
          delivery_address_text?: string | null
          delivery_city_id?: string | null
          delivery_district?: string | null
          delivery_fee?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          fulfillment_type?: string
          id?: string
          idempotency_key?: string
          location_precision?: string
          merchant_account_id?: string | null
          merchant_notes?: string | null
          merchant_tenant_id?: string | null
          merchant_user_id?: string
          order_number?: string
          order_status?: string
          payment_method?: string
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          qa_batch_id?: string | null
          share_phone_with_merchant?: boolean
          storefront_id?: string
          submitted_at?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mkt_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_orders_delivery_city_id_fkey"
            columns: ["delivery_city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_orders_merchant_tenant_id_fkey"
            columns: ["merchant_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_orders_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
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
      mkt_provider_categories: {
        Row: {
          capabilities: string[]
          code: string
          created_at: string
          default_store_type: string
          default_theme_id: string
          description_ar: string | null
          description_en: string | null
          icon: string
          is_active: boolean
          name_ar: string
          name_en: string
          parent_code: string | null
          requires_professional_license: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          code: string
          created_at?: string
          default_store_type?: string
          default_theme_id?: string
          description_ar?: string | null
          description_en?: string | null
          icon?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          parent_code?: string | null
          requires_professional_license?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          code?: string
          created_at?: string
          default_store_type?: string
          default_theme_id?: string
          description_ar?: string | null
          description_en?: string | null
          icon?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          parent_code?: string | null
          requires_professional_license?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_provider_categories_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "mkt_provider_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      mkt_provider_profiles: {
        Row: {
          accepts_partner_requests: boolean
          category_code: string
          created_at: string
          created_by: string
          headline_ar: string | null
          headline_en: string | null
          status: string
          storefront_id: string
          updated_at: string
        }
        Insert: {
          accepts_partner_requests?: boolean
          category_code?: string
          created_at?: string
          created_by?: string
          headline_ar?: string | null
          headline_en?: string | null
          status?: string
          storefront_id: string
          updated_at?: string
        }
        Update: {
          accepts_partner_requests?: boolean
          category_code?: string
          created_at?: string
          created_by?: string
          headline_ar?: string | null
          headline_en?: string | null
          status?: string
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_provider_profiles_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "mkt_provider_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "mkt_provider_profiles_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: true
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_provider_relations: {
        Row: {
          accepted_at: string | null
          created_at: string
          ended_at: string | null
          id: string
          provider_storefront_id: string
          relation_type: string
          request_message: string | null
          requested_by: string
          requester_storefront_id: string
          responded_by: string | null
          response_note: string | null
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          provider_storefront_id: string
          relation_type: string
          request_message?: string | null
          requested_by?: string
          requester_storefront_id: string
          responded_by?: string | null
          response_note?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          provider_storefront_id?: string
          relation_type?: string
          request_message?: string | null
          requested_by?: string
          requester_storefront_id?: string
          responded_by?: string | null
          response_note?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_provider_relations_provider_storefront_id_fkey"
            columns: ["provider_storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_provider_relations_requester_storefront_id_fkey"
            columns: ["requester_storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
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
      mkt_service_availability: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          professional_id: string
          starts_at: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          professional_id: string
          starts_at: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          professional_id?: string
          starts_at?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "mkt_service_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mkt_service_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_service_booking_status_history: {
        Row: {
          booking_id: string
          changed_by_account_key: string | null
          changed_by_user_id: string | null
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
        }
        Insert: {
          booking_id: string
          changed_by_account_key?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
        }
        Update: {
          booking_id?: string
          changed_by_account_key?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_service_booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "mkt_service_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_service_bookings: {
        Row: {
          address_text: string | null
          booking_number: string
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          currency_code: string
          customer_account_key: string
          customer_name_snapshot: string | null
          customer_notes: string | null
          customer_phone_snapshot: string | null
          customer_user_id: string
          district: string | null
          ends_at: string
          id: string
          idempotency_key: string
          latitude: number | null
          longitude: number | null
          payment_method: string
          payment_status: string
          professional_id: string
          provider_name_snapshot: string
          provider_notes: string | null
          provider_tenant_id: string | null
          provider_user_id: string
          service_item_id: string
          service_mode: string
          service_name_snapshot: string
          started_at: string | null
          starts_at: string
          status: string
          storefront_id: string
          subtotal: number
          timezone: string
          total: number
          updated_at: string
          visit_fee: number
        }
        Insert: {
          address_text?: string | null
          booking_number: string
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency_code?: string
          customer_account_key: string
          customer_name_snapshot?: string | null
          customer_notes?: string | null
          customer_phone_snapshot?: string | null
          customer_user_id?: string
          district?: string | null
          ends_at: string
          id?: string
          idempotency_key: string
          latitude?: number | null
          longitude?: number | null
          payment_method?: string
          payment_status?: string
          professional_id: string
          provider_name_snapshot: string
          provider_notes?: string | null
          provider_tenant_id?: string | null
          provider_user_id: string
          service_item_id: string
          service_mode: string
          service_name_snapshot: string
          started_at?: string | null
          starts_at: string
          status?: string
          storefront_id: string
          subtotal: number
          timezone: string
          total: number
          updated_at?: string
          visit_fee?: number
        }
        Update: {
          address_text?: string | null
          booking_number?: string
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency_code?: string
          customer_account_key?: string
          customer_name_snapshot?: string | null
          customer_notes?: string | null
          customer_phone_snapshot?: string | null
          customer_user_id?: string
          district?: string | null
          ends_at?: string
          id?: string
          idempotency_key?: string
          latitude?: number | null
          longitude?: number | null
          payment_method?: string
          payment_status?: string
          professional_id?: string
          provider_name_snapshot?: string
          provider_notes?: string | null
          provider_tenant_id?: string | null
          provider_user_id?: string
          service_item_id?: string
          service_mode?: string
          service_name_snapshot?: string
          started_at?: string | null
          starts_at?: string
          status?: string
          storefront_id?: string
          subtotal?: number
          timezone?: string
          total?: number
          updated_at?: string
          visit_fee?: number
        }
        Relationships: [
          {
            foreignKeyName: "mkt_service_bookings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_service_bookings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mkt_service_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_service_bookings_provider_tenant_id_fkey"
            columns: ["provider_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_service_bookings_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_service_bookings_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_service_categories: {
        Row: {
          code: string
          color: string
          created_at: string
          icon: string
          is_active: boolean
          name_ar: string
          name_en: string
          sort_order: number
        }
        Insert: {
          code: string
          color: string
          created_at?: string
          icon: string
          is_active?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          icon?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
        }
        Relationships: []
      }
      mkt_service_professional_items: {
        Row: {
          created_at: string
          professional_id: string
          service_item_id: string
        }
        Insert: {
          created_at?: string
          professional_id: string
          service_item_id: string
        }
        Update: {
          created_at?: string
          professional_id?: string
          service_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_service_professional_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mkt_service_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_service_professional_items_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_service_professionals: {
        Row: {
          accepts_bookings: boolean
          avatar_path: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          is_active: boolean
          is_primary: boolean
          sort_order: number
          storefront_id: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepts_bookings?: boolean
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          sort_order?: number
          storefront_id: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepts_bookings?: boolean
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          sort_order?: number
          storefront_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_service_professionals_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_service_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          customer_user_id: string
          id: string
          professional_id: string
          rating: number
          status: string
          storefront_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          customer_user_id?: string
          id?: string
          professional_id: string
          rating: number
          status?: string
          storefront_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          customer_user_id?: string
          id?: string
          professional_id?: string
          rating?: number
          status?: string
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_service_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "mkt_service_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_service_reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mkt_service_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_service_reviews_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_service_settings: {
        Row: {
          accepts_bookings: boolean
          buffer_minutes: number
          cancellation_window_hours: number
          category_code: string
          confirmation_mode: string
          created_at: string
          max_advance_days: number
          min_notice_minutes: number
          service_modes: string[]
          slot_interval_minutes: number
          storefront_id: string
          timezone: string
          updated_at: string
          visit_fee: number
        }
        Insert: {
          accepts_bookings?: boolean
          buffer_minutes?: number
          cancellation_window_hours?: number
          category_code?: string
          confirmation_mode?: string
          created_at?: string
          max_advance_days?: number
          min_notice_minutes?: number
          service_modes?: string[]
          slot_interval_minutes?: number
          storefront_id: string
          timezone?: string
          updated_at?: string
          visit_fee?: number
        }
        Update: {
          accepts_bookings?: boolean
          buffer_minutes?: number
          cancellation_window_hours?: number
          category_code?: string
          confirmation_mode?: string
          created_at?: string
          max_advance_days?: number
          min_notice_minutes?: number
          service_modes?: string[]
          slot_interval_minutes?: number
          storefront_id?: string
          timezone?: string
          updated_at?: string
          visit_fee?: number
        }
        Relationships: [
          {
            foreignKeyName: "mkt_service_settings_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "mkt_service_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "mkt_service_settings_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: true
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_service_time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          professional_id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          professional_id: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          professional_id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_service_time_off_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "mkt_service_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_shift_templates: {
        Row: {
          break_minutes: number
          code: string
          created_at: string
          end_time: string | null
          is_active: boolean
          kind: string
          name_ar: string
          name_en: string
          sort_order: number
          start_time: string | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          code: string
          created_at?: string
          end_time?: string | null
          is_active?: boolean
          kind?: string
          name_ar: string
          name_en: string
          sort_order?: number
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          code?: string
          created_at?: string
          end_time?: string | null
          is_active?: boolean
          kind?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mkt_staff_departments: {
        Row: {
          created_at: string
          created_by: string | null
          department_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_staff_departments_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "mkt_workforce_departments"
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
      mkt_staff_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          planned_end: string | null
          planned_minutes: number
          planned_start: string | null
          remote: boolean
          template_code: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          planned_end?: string | null
          planned_minutes?: number
          planned_start?: string | null
          remote?: boolean
          template_code?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          planned_end?: string | null
          planned_minutes?: number
          planned_start?: string | null
          remote?: boolean
          template_code?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_staff_shifts_template_code_fkey"
            columns: ["template_code"]
            isOneToOne: false
            referencedRelation: "mkt_shift_templates"
            referencedColumns: ["code"]
          },
        ]
      }
      mkt_staff_specialties: {
        Row: {
          created_at: string
          created_by: string | null
          level: number
          specialty_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          level?: number
          specialty_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          level?: number
          specialty_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_staff_specialties_specialty_code_fkey"
            columns: ["specialty_code"]
            isOneToOne: false
            referencedRelation: "mkt_workforce_specialties"
            referencedColumns: ["code"]
          },
        ]
      }
      mkt_staff_status: {
        Row: {
          accepts_auto: boolean
          assign_priority: number
          assigned_today: number
          assigned_today_at: string | null
          capacity_limit: number
          created_at: string
          department: string | null
          eligibility_level: number
          last_assigned_at: string | null
          note: string | null
          pre_leave_state: string | null
          substitute_user_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          work_state: string
        }
        Insert: {
          accepts_auto?: boolean
          assign_priority?: number
          assigned_today?: number
          assigned_today_at?: string | null
          capacity_limit?: number
          created_at?: string
          department?: string | null
          eligibility_level?: number
          last_assigned_at?: string | null
          note?: string | null
          pre_leave_state?: string | null
          substitute_user_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_state?: string
        }
        Update: {
          accepts_auto?: boolean
          assign_priority?: number
          assigned_today?: number
          assigned_today_at?: string | null
          capacity_limit?: number
          created_at?: string
          department?: string | null
          eligibility_level?: number
          last_assigned_at?: string | null
          note?: string | null
          pre_leave_state?: string | null
          substitute_user_id?: string | null
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
      mkt_store_addon_groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_required: boolean
          item_id: string
          maximum_choices: number | null
          minimum_choices: number
          name_ar: string
          name_en: string | null
          selection_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_required?: boolean
          item_id: string
          maximum_choices?: number | null
          minimum_choices?: number
          name_ar: string
          name_en?: string | null
          selection_type?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_required?: boolean
          item_id?: string
          maximum_choices?: number | null
          minimum_choices?: number
          name_ar?: string
          name_en?: string | null
          selection_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_addon_groups_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_addons: {
        Row: {
          addon_group_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_available: boolean
          name_ar: string
          name_en: string | null
          price_delta: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          addon_group_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_available?: boolean
          name_ar: string
          name_en?: string | null
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          addon_group_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_available?: boolean
          name_ar?: string
          name_en?: string | null
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_addons_addon_group_id_fkey"
            columns: ["addon_group_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_audit: {
        Row: {
          action: string
          actor_account_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          is_admin_action: boolean
          new_value: Json | null
          old_value: Json | null
          order_id: string | null
          reason: string | null
          storefront_id: string | null
        }
        Insert: {
          action: string
          actor_account_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          is_admin_action?: boolean
          new_value?: Json | null
          old_value?: Json | null
          order_id?: string | null
          reason?: string | null
          storefront_id?: string | null
        }
        Update: {
          action?: string
          actor_account_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          is_admin_action?: boolean
          new_value?: Json | null
          old_value?: Json | null
          order_id?: string | null
          reason?: string | null
          storefront_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "mkt_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_store_audit_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_branches: {
        Row: {
          address_text: string | null
          city_id: string | null
          country_id: string | null
          created_at: string
          deleted_at: string | null
          delivery_enabled: boolean
          district: string | null
          id: string
          is_primary: boolean
          latitude: number | null
          longitude: number | null
          name: string
          pickup_enabled: boolean
          public_phone: string | null
          status: string
          storefront_id: string
          updated_at: string
        }
        Insert: {
          address_text?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_enabled?: boolean
          district?: string | null
          id?: string
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          pickup_enabled?: boolean
          public_phone?: string | null
          status?: string
          storefront_id: string
          updated_at?: string
        }
        Update: {
          address_text?: string | null
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_enabled?: boolean
          district?: string | null
          id?: string
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          pickup_enabled?: boolean
          public_phone?: string | null
          status?: string
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_branches_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_store_branches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_store_branches_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_cuisines: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mkt_store_delivery_zones: {
        Row: {
          branch_id: string
          city_id: string | null
          created_at: string
          delivery_fee: number
          district: string | null
          estimated_minutes_max: number | null
          estimated_minutes_min: number | null
          id: string
          is_active: boolean
          minimum_order_amount: number
          radius_km: number | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          city_id?: string | null
          created_at?: string
          delivery_fee?: number
          district?: string | null
          estimated_minutes_max?: number | null
          estimated_minutes_min?: number | null
          id?: string
          is_active?: boolean
          minimum_order_amount?: number
          radius_km?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          city_id?: string | null
          created_at?: string
          delivery_fee?: number
          district?: string | null
          estimated_minutes_max?: number | null
          estimated_minutes_min?: number | null
          id?: string
          is_active?: boolean
          minimum_order_amount?: number
          radius_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_delivery_zones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_store_delivery_zones_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_hours: {
        Row: {
          branch_id: string
          closes_at: string | null
          created_at: string
          id: string
          is_closed: boolean
          opens_at: string | null
          second_closes_at: string | null
          second_opens_at: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          branch_id: string
          closes_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          second_closes_at?: string | null
          second_opens_at?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          branch_id?: string
          closes_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          second_closes_at?: string | null
          second_opens_at?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_hours_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_item_variants: {
        Row: {
          created_at: string
          deleted_at: string | null
          fixed_price: number | null
          id: string
          is_available: boolean
          item_id: string
          name_ar: string
          name_en: string | null
          price_delta: number
          sort_order: number
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          fixed_price?: number | null
          id?: string
          is_available?: boolean
          item_id: string
          name_ar: string
          name_en?: string | null
          price_delta?: number
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fixed_price?: number | null
          id?: string
          is_available?: boolean
          item_id?: string
          name_ar?: string
          name_en?: string | null
          price_delta?: number
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_item_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_items: {
        Row: {
          allow_notes: boolean
          base_price: number
          compare_at_price: number | null
          created_at: string
          currency_code: string
          deleted_at: string | null
          description_ar: string | null
          description_en: string | null
          duration_minutes: number | null
          id: string
          image_path: string | null
          is_available: boolean
          is_featured: boolean
          item_type: string
          name_ar: string
          name_en: string | null
          preparation_minutes: number | null
          qa_batch_id: string | null
          section_id: string | null
          sort_order: number
          source_listing_id: string | null
          stock_quantity: number | null
          storefront_id: string
          track_inventory: boolean
          updated_at: string
        }
        Insert: {
          allow_notes?: boolean
          base_price?: number
          compare_at_price?: number | null
          created_at?: string
          currency_code?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration_minutes?: number | null
          id?: string
          image_path?: string | null
          is_available?: boolean
          is_featured?: boolean
          item_type?: string
          name_ar: string
          name_en?: string | null
          preparation_minutes?: number | null
          qa_batch_id?: string | null
          section_id?: string | null
          sort_order?: number
          source_listing_id?: string | null
          stock_quantity?: number | null
          storefront_id: string
          track_inventory?: boolean
          updated_at?: string
        }
        Update: {
          allow_notes?: boolean
          base_price?: number
          compare_at_price?: number | null
          created_at?: string
          currency_code?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration_minutes?: number | null
          id?: string
          image_path?: string | null
          is_available?: boolean
          is_featured?: boolean
          item_type?: string
          name_ar?: string
          name_en?: string | null
          preparation_minutes?: number | null
          qa_batch_id?: string | null
          section_id?: string | null
          sort_order?: number
          source_listing_id?: string | null
          stock_quantity?: number | null
          storefront_id?: string
          track_inventory?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_store_items_source_listing_id_fkey"
            columns: ["source_listing_id"]
            isOneToOne: false
            referencedRelation: "mkt_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_store_items_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_offer_items: {
        Row: {
          created_at: string
          item_id: string
          offer_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          offer_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_offer_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_store_offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_offers: {
        Row: {
          applies_to_all: boolean
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          sort_order: number
          starts_at: string
          storefront_id: string
          title: string
          updated_at: string
        }
        Insert: {
          applies_to_all?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string
          storefront_id: string
          title: string
          updated_at?: string
        }
        Update: {
          applies_to_all?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string
          storefront_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_offers_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_private: {
        Row: {
          contact_phone: string | null
          created_at: string
          delivery_declaration_accepted_at: string | null
          delivery_permit_doc_path: string | null
          delivery_permit_expires_on: string | null
          delivery_permit_number: string | null
          delivery_phone: string | null
          permit_review_note: string | null
          permit_review_status: string
          storefront_id: string
          updated_at: string
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string
          delivery_declaration_accepted_at?: string | null
          delivery_permit_doc_path?: string | null
          delivery_permit_expires_on?: string | null
          delivery_permit_number?: string | null
          delivery_phone?: string | null
          permit_review_note?: string | null
          permit_review_status?: string
          storefront_id: string
          updated_at?: string
        }
        Update: {
          contact_phone?: string | null
          created_at?: string
          delivery_declaration_accepted_at?: string | null
          delivery_permit_doc_path?: string | null
          delivery_permit_expires_on?: string | null
          delivery_permit_number?: string | null
          delivery_phone?: string | null
          permit_review_note?: string | null
          permit_review_status?: string
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_private_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: true
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_store_sections: {
        Row: {
          created_at: string
          deleted_at: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          sort_order: number
          storefront_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          sort_order?: number
          storefront_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          sort_order?: number
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_store_sections_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "mkt_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_storefronts: {
        Row: {
          accepts_orders: boolean
          address_text: string | null
          call_enabled: boolean
          chat_enabled: boolean
          city_id: string | null
          country_id: string | null
          cover_path: string | null
          created_at: string
          cuisine_id: string | null
          currency_code: string
          deleted_at: string | null
          delivery_fee: number
          district: string | null
          draft_step: number
          estimated_delivery_minutes_max: number | null
          estimated_delivery_minutes_min: number | null
          id: string
          idempotency_key: string | null
          is_open_manually: boolean
          latitude: number | null
          location_precision: string
          logo_path: string | null
          longitude: number | null
          merchant_delivery_enabled: boolean
          minimum_order_amount: number
          name_ar: string
          name_en: string | null
          orders_count: number
          owner_user_id: string
          pickup_enabled: boolean
          platform_delivery_enabled: boolean
          public_phone_enabled: boolean
          qa_batch_id: string | null
          short_description_ar: string | null
          short_description_en: string | null
          slug: string
          status: string
          store_type: string
          suspension_reason: string | null
          tenant_id: string | null
          theme_id: string
          updated_at: string
          verification_status: string
          views_count: number
        }
        Insert: {
          accepts_orders?: boolean
          address_text?: string | null
          call_enabled?: boolean
          chat_enabled?: boolean
          city_id?: string | null
          country_id?: string | null
          cover_path?: string | null
          created_at?: string
          cuisine_id?: string | null
          currency_code?: string
          deleted_at?: string | null
          delivery_fee?: number
          district?: string | null
          draft_step?: number
          estimated_delivery_minutes_max?: number | null
          estimated_delivery_minutes_min?: number | null
          id?: string
          idempotency_key?: string | null
          is_open_manually?: boolean
          latitude?: number | null
          location_precision?: string
          logo_path?: string | null
          longitude?: number | null
          merchant_delivery_enabled?: boolean
          minimum_order_amount?: number
          name_ar: string
          name_en?: string | null
          orders_count?: number
          owner_user_id?: string
          pickup_enabled?: boolean
          platform_delivery_enabled?: boolean
          public_phone_enabled?: boolean
          qa_batch_id?: string | null
          short_description_ar?: string | null
          short_description_en?: string | null
          slug: string
          status?: string
          store_type?: string
          suspension_reason?: string | null
          tenant_id?: string | null
          theme_id?: string
          updated_at?: string
          verification_status?: string
          views_count?: number
        }
        Update: {
          accepts_orders?: boolean
          address_text?: string | null
          call_enabled?: boolean
          chat_enabled?: boolean
          city_id?: string | null
          country_id?: string | null
          cover_path?: string | null
          created_at?: string
          cuisine_id?: string | null
          currency_code?: string
          deleted_at?: string | null
          delivery_fee?: number
          district?: string | null
          draft_step?: number
          estimated_delivery_minutes_max?: number | null
          estimated_delivery_minutes_min?: number | null
          id?: string
          idempotency_key?: string | null
          is_open_manually?: boolean
          latitude?: number | null
          location_precision?: string
          logo_path?: string | null
          longitude?: number | null
          merchant_delivery_enabled?: boolean
          minimum_order_amount?: number
          name_ar?: string
          name_en?: string | null
          orders_count?: number
          owner_user_id?: string
          pickup_enabled?: boolean
          platform_delivery_enabled?: boolean
          public_phone_enabled?: boolean
          qa_batch_id?: string | null
          short_description_ar?: string | null
          short_description_en?: string | null
          slug?: string
          status?: string
          store_type?: string
          suspension_reason?: string | null
          tenant_id?: string | null
          theme_id?: string
          updated_at?: string
          verification_status?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "mkt_storefronts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_storefronts_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_storefronts_cuisine_id_fkey"
            columns: ["cuisine_id"]
            isOneToOne: false
            referencedRelation: "mkt_store_cuisines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_storefronts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_stories: {
        Row: {
          body_ar: string
          body_en: string
          click_url: string
          clicks: number
          created_at: string
          created_by: string | null
          cta_ar: string
          cta_en: string
          ends_at: string | null
          gradient: string
          id: string
          image_height: number
          image_path: string | null
          image_width: number
          mascot: string
          mascot_pose: string
          priority: number
          slug: string
          starts_at: string
          status: string
          title_ar: string
          title_en: string
          updated_at: string
          views: number
        }
        Insert: {
          body_ar?: string
          body_en?: string
          click_url?: string
          clicks?: number
          created_at?: string
          created_by?: string | null
          cta_ar?: string
          cta_en?: string
          ends_at?: string | null
          gradient?: string
          id?: string
          image_height?: number
          image_path?: string | null
          image_width?: number
          mascot?: string
          mascot_pose?: string
          priority?: number
          slug: string
          starts_at?: string
          status?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
          views?: number
        }
        Update: {
          body_ar?: string
          body_en?: string
          click_url?: string
          clicks?: number
          created_at?: string
          created_by?: string | null
          cta_ar?: string
          cta_en?: string
          ends_at?: string | null
          gradient?: string
          id?: string
          image_height?: number
          image_path?: string | null
          image_width?: number
          mascot?: string
          mascot_pose?: string
          priority?: number
          slug?: string
          starts_at?: string
          status?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      mkt_story_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          session_key: string | null
          story_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          session_key?: string | null
          story_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          session_key?: string | null
          story_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mkt_story_events_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "mkt_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_structure_guard: {
        Row: {
          disabled_at: string | null
          disabled_by: string | null
          disabled_reason: string | null
          disabled_until: string | null
          enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          disabled_until?: string | null
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          disabled_until?: string | null
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      mkt_structure_guard_events: {
        Row: {
          command_tag: string
          created_at: string
          id: string
          object_identity: string
          outcome: string
          performed_by: string
          performed_by_uid: string | null
          reason: string | null
        }
        Insert: {
          command_tag: string
          created_at?: string
          id?: string
          object_identity: string
          outcome: string
          performed_by: string
          performed_by_uid?: string | null
          reason?: string | null
        }
        Update: {
          command_tag?: string
          created_at?: string
          id?: string
          object_identity?: string
          outcome?: string
          performed_by?: string
          performed_by_uid?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      mkt_structure_guard_rejections: {
        Row: {
          attempted_by: string
          attempted_by_uid: string | null
          command_tag: string
          created_at: string
          id: string
          object_identity: string
        }
        Insert: {
          attempted_by: string
          attempted_by_uid?: string | null
          command_tag: string
          created_at?: string
          id?: string
          object_identity: string
        }
        Update: {
          attempted_by?: string
          attempted_by_uid?: string | null
          command_tag?: string
          created_at?: string
          id?: string
          object_identity?: string
        }
        Relationships: []
      }
      mkt_syria_directory_entries: {
        Row: {
          address: string | null
          address_status: string | null
          aliases: string | null
          category: string
          city: string | null
          completeness_score: number
          created_at: string
          district: string | null
          governorate: string | null
          id: string
          latitude: number | null
          longitude: number | null
          map_status: string | null
          map_url: string | null
          name_ar: string
          name_en: string | null
          neighborhood: string | null
          notes: string | null
          operational_status: string | null
          ownership: string | null
          publication_status: string
          published_at: string | null
          retrieved_on: string | null
          review_note: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          search_text: string
          sector: string
          source_date: string | null
          source_primary: string | null
          source_record_id: string
          source_secondary: string | null
          source_type: string
          specialties_services: string | null
          subcategory: string | null
          subdistrict: string | null
          updated_at: string
          verification_status: string
          website: string | null
        }
        Insert: {
          address?: string | null
          address_status?: string | null
          aliases?: string | null
          category: string
          city?: string | null
          completeness_score?: number
          created_at?: string
          district?: string | null
          governorate?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          map_status?: string | null
          map_url?: string | null
          name_ar: string
          name_en?: string | null
          neighborhood?: string | null
          notes?: string | null
          operational_status?: string | null
          ownership?: string | null
          publication_status?: string
          published_at?: string | null
          retrieved_on?: string | null
          review_note?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_text?: string
          sector: string
          source_date?: string | null
          source_primary?: string | null
          source_record_id: string
          source_secondary?: string | null
          source_type: string
          specialties_services?: string | null
          subcategory?: string | null
          subdistrict?: string | null
          updated_at?: string
          verification_status: string
          website?: string | null
        }
        Update: {
          address?: string | null
          address_status?: string | null
          aliases?: string | null
          category?: string
          city?: string | null
          completeness_score?: number
          created_at?: string
          district?: string | null
          governorate?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          map_status?: string | null
          map_url?: string | null
          name_ar?: string
          name_en?: string | null
          neighborhood?: string | null
          notes?: string | null
          operational_status?: string | null
          ownership?: string | null
          publication_status?: string
          published_at?: string | null
          retrieved_on?: string | null
          review_note?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_text?: string
          sector?: string
          source_date?: string | null
          source_primary?: string | null
          source_record_id?: string
          source_secondary?: string | null
          source_type?: string
          specialties_services?: string | null
          subcategory?: string | null
          subdistrict?: string | null
          updated_at?: string
          verification_status?: string
          website?: string | null
        }
        Relationships: []
      }
      mkt_syria_technical_institutes: {
        Row: {
          academic_year: string | null
          affiliated_entity: string | null
          created_at: string
          governorate: string | null
          id: string
          institute_name: string
          location: string | null
          notes: string | null
          search_text: string
          source_institute_id: string
          source_type: string | null
          source_url: string | null
          specialties: string | null
          updated_at: string
          verification_status: string | null
        }
        Insert: {
          academic_year?: string | null
          affiliated_entity?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          institute_name: string
          location?: string | null
          notes?: string | null
          search_text?: string
          source_institute_id: string
          source_type?: string | null
          source_url?: string | null
          specialties?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Update: {
          academic_year?: string | null
          affiliated_entity?: string | null
          created_at?: string
          governorate?: string | null
          id?: string
          institute_name?: string
          location?: string | null
          notes?: string | null
          search_text?: string
          source_institute_id?: string
          source_type?: string | null
          source_url?: string | null
          specialties?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      mkt_syria_university_programs: {
        Row: {
          academic_year: string | null
          admission_track: string | null
          created_at: string
          faculty_institute: string | null
          governorate: string | null
          id: string
          institution: string
          ownership: string | null
          program_name: string
          search_text: string
          source_program_id: string
          source_type: string | null
          source_url: string | null
          study_location: string | null
          updated_at: string
          verification_status: string | null
        }
        Insert: {
          academic_year?: string | null
          admission_track?: string | null
          created_at?: string
          faculty_institute?: string | null
          governorate?: string | null
          id?: string
          institution: string
          ownership?: string | null
          program_name: string
          search_text?: string
          source_program_id: string
          source_type?: string | null
          source_url?: string | null
          study_location?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Update: {
          academic_year?: string | null
          admission_track?: string | null
          created_at?: string
          faculty_institute?: string | null
          governorate?: string | null
          id?: string
          institution?: string
          ownership?: string | null
          program_name?: string
          search_text?: string
          source_program_id?: string
          source_type?: string | null
          source_url?: string | null
          study_location?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      mkt_typing: {
        Row: {
          conversation_id: string
          typing_until: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          typing_until?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          typing_until?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_typing_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mkt_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_user_activity: {
        Row: {
          ad_id: string | null
          category_id: string | null
          city_id: string | null
          created_at: string
          event_type: string
          id: string
          qa_batch_id: string | null
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
          qa_batch_id?: string | null
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
          qa_batch_id?: string | null
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
      mkt_user_addresses: {
        Row: {
          city_id: string | null
          country_id: string | null
          created_at: string
          details: string | null
          district: string | null
          id: string
          is_default: boolean
          label: string
          lat: number | null
          lng: number | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          details?: string | null
          district?: string | null
          id?: string
          is_default?: boolean
          label: string
          lat?: number | null
          lng?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          city_id?: string | null
          country_id?: string | null
          created_at?: string
          details?: string | null
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_user_addresses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "mkt_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_user_addresses_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "mkt_countries"
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
          description: string | null
          is_active: boolean
          name_ar: string
          name_en: string
          pause_auto_when_off: boolean
          queue_kinds: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          name_ar: string
          name_en: string
          pause_auto_when_off?: boolean
          queue_kinds?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string
          pause_auto_when_off?: boolean
          queue_kinds?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mkt_workforce_kinds: {
        Row: {
          allow_general: boolean
          created_at: string
          default_priority: string
          department_code: string | null
          is_active: boolean
          kind: string
          name_ar: string
          name_en: string
          required_specialty: string | null
          sla_minutes: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          allow_general?: boolean
          created_at?: string
          default_priority?: string
          department_code?: string | null
          is_active?: boolean
          kind: string
          name_ar: string
          name_en: string
          required_specialty?: string | null
          sla_minutes?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allow_general?: boolean
          created_at?: string
          default_priority?: string
          department_code?: string | null
          is_active?: boolean
          kind?: string
          name_ar?: string
          name_en?: string
          required_specialty?: string | null
          sla_minutes?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_workforce_kinds_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "mkt_workforce_departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "mkt_workforce_kinds_required_specialty_fkey"
            columns: ["required_specialty"]
            isOneToOne: false
            referencedRelation: "mkt_workforce_specialties"
            referencedColumns: ["code"]
          },
        ]
      }
      mkt_workforce_specialties: {
        Row: {
          code: string
          created_at: string
          department_code: string | null
          is_active: boolean
          name_ar: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_code?: string | null
          is_active?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_code?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_workforce_specialties_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "mkt_workforce_departments"
            referencedColumns: ["code"]
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
      current_tenant_id: { Args: never; Returns: string }
      current_tenant_ids: { Args: never; Returns: string[] }
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
      is_accountant: { Args: never; Returns: boolean }
      is_active_member: {
        Args: { _tenant_id: string; _user_id?: string }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
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
      mkt_ad_campaign_track: {
        Args: { _campaign_id: string; _kind: string; _session_key?: string }
        Returns: undefined
      }
      mkt_ad_credit_admin_grant: {
        Args: {
          _amount: number
          _kind?: string
          _note?: string
          _price_sar?: number
          _wallet_id: string
        }
        Returns: number
      }
      mkt_ad_credit_admin_settle: {
        Args: { _entry_id: string; _payment_ref?: string }
        Returns: number
      }
      mkt_ad_credit_cancel_request: {
        Args: { _entry_id: string }
        Returns: boolean
      }
      mkt_ad_credit_consume: {
        Args: {
          _amount: number
          _reference_id?: string
          _reference_type?: string
          _tenant_id?: string
        }
        Returns: number
      }
      mkt_ad_credit_request_purchase: {
        Args: { _amount: number; _price_sar?: number; _tenant_id?: string }
        Returns: string
      }
      mkt_ad_credit_topup_cancel: {
        Args: { _topup_id: string }
        Returns: boolean
      }
      mkt_ad_credit_topup_card_attach: {
        Args: { _session_id: string; _topup_id: string }
        Returns: boolean
      }
      mkt_ad_credit_topup_card_fail: {
        Args: { _reason?: string; _session_id: string; _status?: string }
        Returns: boolean
      }
      mkt_ad_credit_topup_card_refund: {
        Args: { _payment_id: string; _reason?: string }
        Returns: Json
      }
      mkt_ad_credit_topup_card_settle: {
        Args: {
          _amount?: number
          _currency?: string
          _payment_id?: string
          _session_id: string
        }
        Returns: Json
      }
      mkt_ad_credit_topup_card_start: {
        Args: { _credits: number; _tenant_id?: string }
        Returns: Json
      }
      mkt_ad_credit_topup_methods: { Args: never; Returns: Json }
      mkt_ad_credit_topup_review: {
        Args: {
          _approve: boolean
          _credits_override?: number
          _payment_ref?: string
          _reject_reason?: string
          _topup_id: string
        }
        Returns: number
      }
      mkt_ad_credit_topup_submit: {
        Args: {
          _amount: number
          _credits: number
          _currency?: string
          _method: string
          _receipt_path?: string
          _sender_note?: string
          _tenant_id?: string
          _transfer_ref?: string
        }
        Returns: string
      }
      mkt_ad_credit_wallet: {
        Args: { _tenant_id?: string }
        Returns: {
          balance: number
          created_at: string
          id: string
          owner_user_id: string
          tenant_id: string | null
          total_consumed: number
          total_purchased: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mkt_ad_credit_wallets"
          isOneToOne: true
          isSetofReturn: false
        }
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
      mkt_admin_join_application_review: {
        Args: { _action: string; _application_id: string; _reason?: string }
        Returns: undefined
      }
      mkt_admin_join_applications: {
        Args: { _kind?: string; _limit?: number; _status?: string }
        Returns: {
          applicant_name: string
          applicant_user_id: string
          application_kind: string
          application_number: string
          created_at: string
          decision_reason: string
          documents_count: number
          id: string
          payload: Json
          provider_category_code: string
          provider_category_name: string
          reviewed_at: string
          status: string
          tenant_id: string
          tenant_name: string
        }[]
      }
      mkt_admin_join_documents: {
        Args: { _application_id: string }
        Returns: {
          created_at: string
          document_kind: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }[]
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
      mkt_admin_run_tick: { Args: never; Returns: Json }
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
      mkt_admin_store_action: {
        Args: { _action: string; _reason?: string; _storefront_id: string }
        Returns: Json
      }
      mkt_admin_store_audit: {
        Args: { _limit?: number; _storefront_id: string }
        Returns: {
          action: string
          created_at: string
          is_admin_action: boolean
          new_value: Json
          old_value: Json
          reason: string
        }[]
      }
      mkt_admin_stores: {
        Args: {
          _limit?: number
          _offset?: number
          _q?: string
          _status?: string
          _store_type?: string
        }
        Returns: {
          city_name_ar: string
          country_iso2: string
          created_at: string
          id: string
          items_count: number
          name_ar: string
          owner_kind: string
          owner_label: string
          reports_count: number
          slug: string
          status: string
          store_type: string
          suspension_reason: string
          verification_status: string
        }[]
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
      mkt_admin_syria_directory_queue: {
        Args: { _limit?: number; _q?: string; _status?: string }
        Returns: Json
      }
      mkt_admin_syria_directory_review: {
        Args: {
          _action: string
          _corrected_name_ar?: string
          _corrected_name_en?: string
          _entry_id: string
          _note?: string
        }
        Returns: Json
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
      mkt_ai_image_claim: {
        Args: {
          _model: string
          _preset?: string
          _prompt: string
          _size_key: string
        }
        Returns: Json
      }
      mkt_ai_image_finish: {
        Args: {
          _asset_path?: string
          _bytes?: number
          _cost?: number
          _detail?: string
          _job_id: string
          _status: string
        }
        Returns: undefined
      }
      mkt_analytics_fields: { Args: { _days?: number }; Returns: Json }
      mkt_analytics_funnel: { Args: { _days?: number }; Returns: Json }
      mkt_analytics_geo: { Args: { _limit?: number }; Returns: Json }
      mkt_analytics_guard: { Args: never; Returns: undefined }
      mkt_analytics_health: { Args: { _days?: number }; Returns: Json }
      mkt_analytics_listings: { Args: { _limit?: number }; Returns: Json }
      mkt_analytics_ops: { Args: { _days?: number }; Returns: Json }
      mkt_analytics_overview: { Args: never; Returns: Json }
      mkt_analytics_people: {
        Args: { _days?: number; _limit?: number }
        Returns: Json
      }
      mkt_analytics_search: {
        Args: { _days?: number; _limit?: number }
        Returns: Json
      }
      mkt_analytics_timeseries: { Args: { _days?: number }; Returns: Json }
      mkt_attendance_admin_set: {
        Args: {
          _checked_in: string
          _checked_out: string
          _note: string
          _reason: string
          _remote: boolean
          _status: string
          _user_id: string
          _work_date: string
        }
        Returns: string
      }
      mkt_attendance_approve: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      mkt_attendance_can_approve: { Args: never; Returns: boolean }
      mkt_attendance_can_manage: { Args: never; Returns: boolean }
      mkt_attendance_can_view: { Args: never; Returns: boolean }
      mkt_attendance_check_in: {
        Args: { _note?: string; _remote?: boolean }
        Returns: string
      }
      mkt_attendance_check_out: { Args: { _note?: string }; Returns: string }
      mkt_attendance_edits_list: {
        Args: { _attendance_id: string }
        Returns: {
          after_value: Json
          before_value: Json
          created_at: string
          id: string
          reason: string
        }[]
      }
      mkt_attendance_list: {
        Args: { _from: string; _to: string; _user_id?: string }
        Returns: {
          actual_minutes: number
          approved_at: string
          checked_in_at: string
          checked_out_at: string
          early_leave_minutes: number
          edits_count: number
          id: string
          label: string
          late_minutes: number
          note: string
          overtime_minutes: number
          planned_minutes: number
          remote: boolean
          shift_kind: string
          shift_template: string
          source: string
          status: string
          user_id: string
          work_date: string
        }[]
      }
      mkt_attendance_my: {
        Args: { _from?: string; _to?: string }
        Returns: {
          actual_minutes: number
          checked_in_at: string
          checked_out_at: string
          early_leave_minutes: number
          id: string
          late_minutes: number
          note: string
          overtime_minutes: number
          planned_minutes: number
          remote: boolean
          shift_kind: string
          shift_template: string
          source: string
          status: string
          work_date: string
        }[]
      }
      mkt_attendance_recompute: { Args: { _id: string }; Returns: undefined }
      mkt_bank_accounts_for: {
        Args: { _account_key: string }
        Returns: {
          bank_name: string
          beneficiary_name: string
          id: string
          last4: string
          owner_label: string
        }[]
      }
      mkt_bank_request_respond: {
        Args: { _action: string; _message_id: string }
        Returns: undefined
      }
      mkt_bank_request_send: {
        Args: { _account_key: string; _conversation_id: string }
        Returns: string
      }
      mkt_bank_share: {
        Args: {
          _account_key: string
          _bank_account_id: string
          _conversation_id: string
          _request_message_id?: string
        }
        Returns: string
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
      mkt_call_can_call_conv: {
        Args: { _conversation_id: string }
        Returns: Json
      }
      mkt_call_missed: {
        Args: { _call_id: string; _reason?: string }
        Returns: undefined
      }
      mkt_call_mode: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: string
      }
      mkt_call_mode_set: {
        Args: { _mode: string; _tenant_id: string }
        Returns: string
      }
      mkt_call_peer: { Args: { _call_id: string }; Returns: Json }
      mkt_call_request_close: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      mkt_call_request_create: {
        Args: { _listing_id: string }
        Returns: string
      }
      mkt_call_request_start: { Args: { _request_id: string }; Returns: Json }
      mkt_call_start: { Args: { _listing_id: string }; Returns: Json }
      mkt_call_start_conv: { Args: { _conversation_id: string }; Returns: Json }
      mkt_call_stop_receiving: { Args: never; Returns: undefined }
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
      mkt_cart_item_owner: { Args: { _cart_item_id: string }; Returns: boolean }
      mkt_cart_owner: { Args: { _cart_id: string }; Returns: boolean }
      mkt_chat_block_set: {
        Args: { _blocked: boolean; _conversation_id: string }
        Returns: undefined
      }
      mkt_chat_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      mkt_chat_peer: { Args: { _conversation_id: string }; Returns: string }
      mkt_commerce_flags: { Args: never; Returns: Json }
      mkt_conversation_context: {
        Args: { _conversation_id: string }
        Returns: Json
      }
      mkt_conversation_mark_delivered: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      mkt_conversation_mark_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      mkt_conversation_open: { Args: { _listing_id: string }; Returns: string }
      mkt_conversation_state_set: {
        Args: { _conversation_id: string; _hidden?: boolean; _muted?: boolean }
        Returns: undefined
      }
      mkt_conversations_list: {
        Args: never
        Returns: {
          id: string
          last_body: string
          last_kind: string
          last_message_at: string
          last_mine: boolean
          listing_cover: string
          listing_id: string
          listing_slug: string
          listing_title: string
          muted: boolean
          peer_name: string
          unread_count: number
        }[]
      }
      mkt_departments_manage: { Args: never; Returns: boolean }
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
      mkt_errand_advance: {
        Args: { _request_id: string; _to_status: string }
        Returns: undefined
      }
      mkt_errand_cancel: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      mkt_errand_contact: {
        Args: { _request_id: string }
        Returns: {
          display_name: string
          phone: string
          role: string
        }[]
      }
      mkt_errand_decide_offer: {
        Args: { _accept: boolean; _offer_id: string }
        Returns: undefined
      }
      mkt_errand_photo_can_read: { Args: { _name: string }; Returns: boolean }
      mkt_errand_place_offer: {
        Args: {
          _eta_minutes?: number
          _fee: number
          _note?: string
          _request_id: string
        }
        Returns: string
      }
      mkt_errand_rate: {
        Args: { _comment?: string; _rating: number; _request_id: string }
        Returns: undefined
      }
      mkt_expire_re_licenses: { Args: never; Returns: number }
      mkt_external_integration_save: {
        Args: {
          _account_key: string
          _config_public?: Json
          _direction: string
          _display_name: string
          _integration_code: string
          _integration_id: string
        }
        Returns: string
      }
      mkt_external_integrations_list: {
        Args: { _account_key: string }
        Returns: {
          config_public: Json
          created_at: string
          credentials_state: string
          direction: string
          display_name: string
          id: string
          integration_code: string
          last_connected_at: string
          last_error_code: string
          status: string
          storefront_id: string
          updated_at: string
        }[]
      }
      mkt_guide_featured_places: {
        Args: { _limit?: number }
        Returns: {
          category: string
          city: string
          governorate: string
          name_ar: string
          name_en: string
          place_id: string
          promotion_id: string
          rating: number
          rating_total: number
          sector: string
          slug: string
        }[]
      }
      mkt_guide_place_is_owner: {
        Args: { _place_id: string }
        Returns: boolean
      }
      mkt_guide_place_rating: {
        Args: { _place_id: string }
        Returns: {
          average: number
          total: number
        }[]
      }
      mkt_guide_promo_track: {
        Args: { _kind: string; _promotion_id: string }
        Returns: undefined
      }
      mkt_guide_promote_place: {
        Args: { _days?: number; _place_id: string; _tenant_id?: string }
        Returns: string
      }
      mkt_guide_review_claim: {
        Args: { _approve: boolean; _claim_id: string; _reason?: string }
        Returns: undefined
      }
      mkt_guide_review_photo: {
        Args: { _approve: boolean; _photo_id: string; _reason?: string }
        Returns: undefined
      }
      mkt_guide_review_review: {
        Args: { _approve: boolean; _reason?: string; _review_id: string }
        Returns: undefined
      }
      mkt_has_restriction: {
        Args: {
          _restrictions: string[]
          _subject_id: string
          _subject_type: string
        }
        Returns: boolean
      }
      mkt_increment_views: { Args: { _listing_id: string }; Returns: undefined }
      mkt_integration_catalog_public: {
        Args: never
        Returns: {
          code: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          integration_kind: string
          is_active: boolean
          name_ar: string
          name_en: string
          sort_order: number
          supported_directions: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "mkt_integration_catalog"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mkt_is_auto_publish_op: { Args: never; Returns: boolean }
      mkt_is_business_principal: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      mkt_is_call_party: { Args: { _call_id: string }; Returns: boolean }
      mkt_is_errand_captain: { Args: never; Returns: boolean }
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
      mkt_join_application_document_add: {
        Args: {
          _application_id: string
          _document_kind: string
          _file_name: string
          _mime_type: string
          _size_bytes: number
          _storage_path: string
        }
        Returns: string
      }
      mkt_join_application_finalize: {
        Args: {
          _application_id: string
          _payload?: Json
          _provider_category_code?: string
        }
        Returns: string
      }
      mkt_join_application_mark_incomplete: {
        Args: { _application_id: string }
        Returns: undefined
      }
      mkt_join_application_submit: {
        Args: {
          _application_kind: string
          _payload?: Json
          _provider_category_code?: string
          _tenant_id?: string
        }
        Returns: string
      }
      mkt_join_workspace_prepare: {
        Args: {
          _activity?: string
          _application_kind: string
          _city?: string
          _cr_number?: string
          _email?: string
          _legal_name?: string
          _name_ar: string
          _name_en?: string
          _phone?: string
          _provider_category_code: string
          _unified_number?: string
        }
        Returns: string
      }
      mkt_lift_expired_restrictions: { Args: never; Returns: number }
      mkt_lift_restriction: {
        Args: { _reason: string; _restriction_id: string }
        Returns: undefined
      }
      mkt_listing_archive: { Args: { _id: string }; Returns: string }
      mkt_listing_commerce_action: {
        Args: { _listing_id: string }
        Returns: Json
      }
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
      mkt_merchant_order_action: {
        Args: {
          _account_key: string
          _action: string
          _note?: string
          _order_id: string
        }
        Returns: string
      }
      mkt_merchant_orders_list: {
        Args: { _account_key: string; _limit?: number; _status?: string }
        Returns: Json
      }
      mkt_merge_activities: {
        Args: { _note?: string; _source_id: string; _target_id: string }
        Returns: undefined
      }
      mkt_message_delete: {
        Args: { _message_id: string; _scope?: string }
        Returns: undefined
      }
      mkt_message_send: {
        Args: {
          _body?: string
          _conversation_id: string
          _kind?: string
          _payload?: Json
          _reply_to_id?: string
        }
        Returns: string
      }
      mkt_messages_list: {
        Args: { _conversation_id: string; _limit?: number }
        Returns: {
          body: string
          created_at: string
          deleted_at: string
          delivered_at: string
          id: string
          kind: string
          mine: boolean
          payload: Json
          read_at: string
          reply_to_id: string
          sender_user_id: string
        }[]
      }
      mkt_moderation_check_text: { Args: { _t: string }; Returns: Json }
      mkt_moderation_normalize: { Args: { _t: string }; Returns: string }
      mkt_moderation_scan_listing: {
        Args: { _id: string; _trigger?: string }
        Returns: Json
      }
      mkt_my_account_classifications: {
        Args: never
        Returns: {
          account_key: string
          classification: string
        }[]
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
      mkt_my_join_applications: {
        Args: never
        Returns: {
          account_key: string
          application_kind: string
          application_number: string
          created_at: string
          decision_reason: string
          documents_count: number
          id: string
          payload: Json
          provider_category_code: string
          provider_category_name_ar: string
          provider_category_name_en: string
          reviewed_at: string
          status: string
          tenant_id: string
          tenant_name: string
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
      mkt_my_storefront: {
        Args: { _account_key?: string }
        Returns: {
          accepts_orders: boolean
          cover_path: string
          id: string
          is_open_manually: boolean
          logo_path: string
          name_ar: string
          name_en: string
          slug: string
          status: string
          store_type: string
          tenant_id: string
        }[]
      }
      mkt_norm_activity_text: { Args: { _t: string }; Returns: string }
      mkt_norm_digits: { Args: { _t: string }; Returns: string }
      mkt_norm_label: { Args: { _v: string }; Returns: string }
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
      mkt_operational_access: { Args: { _account_key: string }; Returns: Json }
      mkt_order_item_party: {
        Args: { _order_item_id: string }
        Returns: boolean
      }
      mkt_order_party: { Args: { _order_id: string }; Returns: boolean }
      mkt_perm_aliases: { Args: { _perm: string }; Returns: string[] }
      mkt_person_is_restricted: { Args: { _user_id: string }; Returns: boolean }
      mkt_promotion_prices: { Args: never; Returns: Json }
      mkt_provider_categories_public: {
        Args: never
        Returns: {
          capabilities: string[]
          code: string
          created_at: string
          default_store_type: string
          default_theme_id: string
          description_ar: string | null
          description_en: string | null
          icon: string
          is_active: boolean
          name_ar: string
          name_en: string
          parent_code: string | null
          requires_professional_license: boolean
          sort_order: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mkt_provider_categories"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mkt_provider_directory: {
        Args: { _category_code?: string; _limit?: number; _q?: string }
        Returns: {
          accepts_partner_requests: boolean
          capabilities: string[]
          category_code: string
          category_name_ar: string
          category_name_en: string
          city_name_ar: string
          city_name_en: string
          headline_ar: string
          headline_en: string
          logo_path: string
          name_ar: string
          name_en: string
          slug: string
          storefront_id: string
          verification_status: string
        }[]
      }
      mkt_provider_operations_overview: {
        Args: { _account_key: string }
        Returns: Json
      }
      mkt_provider_profile_context: {
        Args: { _account_key: string }
        Returns: Json
      }
      mkt_provider_profile_save: {
        Args: {
          _accepts_partner_requests?: boolean
          _account_key: string
          _category_code: string
          _headline_ar?: string
          _headline_en?: string
        }
        Returns: Json
      }
      mkt_provider_relation_request: {
        Args: {
          _account_key: string
          _message?: string
          _relation_type: string
          _scopes?: string[]
          _target_storefront_id: string
        }
        Returns: string
      }
      mkt_provider_relation_respond: {
        Args: {
          _account_key: string
          _action: string
          _note?: string
          _relation_id: string
        }
        Returns: undefined
      }
      mkt_provider_relations_list: {
        Args: { _account_key: string }
        Returns: {
          created_at: string
          direction: string
          id: string
          other_category_code: string
          other_store_name: string
          other_store_slug: string
          other_storefront_id: string
          relation_type: string
          request_message: string
          response_note: string
          scopes: string[]
          status: string
          updated_at: string
        }[]
      }
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
      mkt_qa_cleanup: { Args: { _batch_id: string }; Returns: Json }
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
      mkt_root_category: { Args: { _id: string }; Returns: string }
      mkt_run_scheduled_jobs: { Args: { _source?: string }; Returns: Json }
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
      mkt_search_stores: {
        Args: { _country_iso2?: string; _limit?: number; _q?: string }
        Returns: {
          city_name_ar: string
          city_name_en: string
          cover_path: string
          id: string
          logo_path: string
          matched_items: number
          name_ar: string
          name_en: string
          slug: string
          store_type: string
        }[]
      }
      mkt_service_booking_action: {
        Args: {
          _account_key: string
          _action: string
          _booking_id: string
          _note?: string
        }
        Returns: Json
      }
      mkt_service_booking_context: {
        Args: { _service_item_id: string; _store_slug: string }
        Returns: Json
      }
      mkt_service_booking_party: {
        Args: { _booking_id: string }
        Returns: boolean
      }
      mkt_service_bookings_list: {
        Args: {
          _account_key: string
          _limit?: number
          _side?: string
          _status?: string
        }
        Returns: Json
      }
      mkt_service_categories_public: { Args: never; Returns: Json }
      mkt_service_create_booking: {
        Args: {
          _account_key: string
          _address_text?: string
          _customer_phone?: string
          _district?: string
          _idempotency_key?: string
          _latitude?: number
          _longitude?: number
          _notes?: string
          _professional_id?: string
          _service_item_id: string
          _service_mode?: string
          _starts_at: string
        }
        Returns: Json
      }
      mkt_service_directory: {
        Args: {
          _category_code?: string
          _city_id?: string
          _limit?: number
          _q?: string
        }
        Returns: Json
      }
      mkt_service_provider_save: {
        Args: { _account_key: string; _availability?: Json; _patch: Json }
        Returns: Json
      }
      mkt_service_provider_setup: {
        Args: { _account_key: string }
        Returns: Json
      }
      mkt_service_review_save: {
        Args: { _booking_id: string; _comment?: string; _rating: number }
        Returns: string
      }
      mkt_service_slots: {
        Args: {
          _date: string
          _professional_id?: string
          _service_item_id: string
        }
        Returns: Json
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
      mkt_shift_for: {
        Args: { _date: string; _user_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          planned_end: string | null
          planned_minutes: number
          planned_start: string | null
          remote: boolean
          template_code: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "mkt_staff_shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mkt_shift_set: {
        Args: {
          _note: string
          _planned_end: string
          _planned_start: string
          _reason: string
          _remote: boolean
          _template: string
          _user_id: string
          _work_date: string
        }
        Returns: string
      }
      mkt_shifts_list: {
        Args: { _from: string; _to: string; _user_id?: string }
        Returns: {
          id: string
          kind: string
          label: string
          note: string
          planned_end: string
          planned_minutes: number
          planned_start: string
          remote: boolean
          template_code: string
          user_id: string
          work_date: string
        }[]
      }
      mkt_slugify: { Args: { _text: string }; Returns: string }
      mkt_staff_eligible: {
        Args: { _kind: string; _user_id: string }
        Returns: boolean
      }
      mkt_staff_has: { Args: { _perm: string }; Returns: boolean }
      mkt_staff_on_leave: { Args: { _uid: string }; Returns: boolean }
      mkt_staff_on_leave_at: {
        Args: { _date: string; _user_id: string }
        Returns: boolean
      }
      mkt_staff_on_shift: { Args: { _user_id: string }; Returns: boolean }
      mkt_staff_specialist: {
        Args: { _kind: string; _user_id: string }
        Returns: boolean
      }
      mkt_store_addon_group_manage: {
        Args: { _group_id: string }
        Returns: boolean
      }
      mkt_store_addon_group_visible: {
        Args: { _group_id: string }
        Returns: boolean
      }
      mkt_store_admin: { Args: never; Returns: boolean }
      mkt_store_branch_manage: {
        Args: { _branch_id: string }
        Returns: boolean
      }
      mkt_store_branch_visible: {
        Args: { _branch_id: string }
        Returns: boolean
      }
      mkt_store_draft: { Args: { _account_key?: string }; Returns: Json }
      mkt_store_hours_save: {
        Args: { _rows: Json; _storefront_id: string }
        Returns: undefined
      }
      mkt_store_item_linked_listings: {
        Args: { _storefront_id: string }
        Returns: {
          cover_image_url: string
          id: string
          slug: string
          status: string
          storefront_id: string
          title: string
        }[]
      }
      mkt_store_item_manage: { Args: { _item_id: string }; Returns: boolean }
      mkt_store_item_visible: { Args: { _item_id: string }; Returns: boolean }
      mkt_store_linkable_listings: {
        Args: { _account_key?: string }
        Returns: {
          cover_image_url: string
          id: string
          slug: string
          status: string
          storefront_id: string
          title: string
        }[]
      }
      mkt_store_manage: { Args: { _storefront_id: string }; Returns: boolean }
      mkt_store_open_state: { Args: { _storefront_id: string }; Returns: Json }
      mkt_store_overview: { Args: { _account_key?: string }; Returns: Json }
      mkt_store_public: { Args: { _slug: string }; Returns: Json }
      mkt_store_public_phone: {
        Args: { _storefront_id: string }
        Returns: string
      }
      mkt_store_qa_cleanup: { Args: { _batch: string }; Returns: Json }
      mkt_store_save: {
        Args: {
          _account_key: string
          _idempotency_key?: string
          _patch: Json
          _step?: number
        }
        Returns: string
      }
      mkt_store_submit: { Args: { _storefront_id: string }; Returns: Json }
      mkt_store_theme_public: { Args: { _slug: string }; Returns: string }
      mkt_store_theme_save: {
        Args: { _account_key: string; _theme_id: string }
        Returns: string
      }
      mkt_store_visible: { Args: { _storefront_id: string }; Returns: boolean }
      mkt_store_zones_save: {
        Args: { _rows: Json; _storefront_id: string }
        Returns: undefined
      }
      mkt_story_track: {
        Args: { _kind: string; _session_key?: string; _story_id: string }
        Returns: undefined
      }
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
      mkt_sweep_promotion_notices: { Args: never; Returns: number }
      mkt_syria_directory_name_requires_review: {
        Args: { _aliases?: string; _name_ar: string; _name_en?: string }
        Returns: boolean
      }
      mkt_syria_guide_facets_v1: { Args: never; Returns: Json }
      mkt_syria_guide_search_v1: {
        Args: {
          _governorate?: string
          _kind?: string
          _limit?: number
          _offset?: number
          _q?: string
          _sector?: string
        }
        Returns: Json
      }
      mkt_syria_normalize: { Args: { _value: string }; Returns: string }
      mkt_tenant_operational_allowed: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      mkt_track: { Args: { _events: Json }; Returns: number }
      mkt_typing_peer: { Args: { _conversation_id: string }; Returns: boolean }
      mkt_typing_ping: {
        Args: { _conversation_id: string; _seconds?: number }
        Returns: undefined
      }
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
      mkt_workforce_assigned_today: {
        Args: { _user_id: string }
        Returns: number
      }
      mkt_workforce_autoqueue: {
        Args: { _kind: string; _priority?: string; _subject_id: string }
        Returns: undefined
      }
      mkt_workforce_can_take: {
        Args: { _kind: string; _user_id: string }
        Returns: string
      }
      mkt_workforce_cancel_leave: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      mkt_workforce_close_item: {
        Args: { _kind: string; _subject_id: string }
        Returns: undefined
      }
      mkt_workforce_department_save: {
        Args: {
          _code: string
          _description: string
          _is_active: boolean
          _name_ar: string
          _name_en: string
          _pause_auto: boolean
          _queue_kinds: string[]
          _sort: number
        }
        Returns: undefined
      }
      mkt_workforce_departments_overview: {
        Args: never
        Returns: {
          code: string
          description: string
          is_active: boolean
          kinds: Json
          name_ar: string
          name_en: string
          open_count: number
          overdue_count: number
          pause_auto_when_off: boolean
          queue_kinds: string[]
          sort_order: number
          specialties: Json
          staff_count: number
          unassigned_count: number
        }[]
      }
      mkt_workforce_distribute: {
        Args: { _kind?: string; _limit?: number }
        Returns: number
      }
      mkt_workforce_done_today: { Args: { _user_id: string }; Returns: number }
      mkt_workforce_enqueue: {
        Args: {
          _due_at?: string
          _kind: string
          _priority?: string
          _subject_id: string
        }
        Returns: string
      }
      mkt_workforce_is_staff: { Args: never; Returns: boolean }
      mkt_workforce_kind_save: {
        Args: {
          _allow_general: boolean
          _default_priority: string
          _department: string
          _is_active: boolean
          _kind: string
          _name_ar: string
          _name_en: string
          _required_specialty: string
          _sla_minutes: number
        }
        Returns: undefined
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
      mkt_workforce_overdue_count: {
        Args: { _user_id: string }
        Returns: number
      }
      mkt_workforce_override_assign: {
        Args: {
          _kind: string
          _reason: string
          _subject_id: string
          _user_id: string
        }
        Returns: string
      }
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
      mkt_workforce_reassign_from: {
        Args: { _reason: string; _user_id: string }
        Returns: number
      }
      mkt_workforce_refresh_leave_states: { Args: never; Returns: number }
      mkt_workforce_reopen_item: {
        Args: { _kind: string; _priority?: string; _subject_id: string }
        Returns: string
      }
      mkt_workforce_require_attendance: { Args: never; Returns: boolean }
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
      mkt_workforce_set_staff_profile: {
        Args: {
          _assign_priority: number
          _eligibility_level: number
          _extra_departments: string[]
          _primary_department: string
          _reason: string
          _specialties: string[]
          _substitute: string
          _user_id: string
        }
        Returns: undefined
      }
      mkt_workforce_specialty_save: {
        Args: {
          _code: string
          _department: string
          _is_active: boolean
          _name_ar: string
          _name_en: string
          _sort: number
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
      profile_completion_get: {
        Args: never
        Returns: {
          ad_personalization_consent: boolean
          birth_year: number
          email: string
          email_verified_at: string
          full_name: string
          gender: string
          is_complete: boolean
          phone: string
          phone_verified_at: string
        }[]
      }
      profile_completion_save: {
        Args: {
          _ad_personalization_consent: boolean
          _birth_year: number
          _email: string
          _gender: string
          _phone: string
        }
        Returns: undefined
      }
      profile_seed_public_signup: {
        Args: {
          _email: string
          _name: string
          _phone: string
          _user_id: string
        }
        Returns: undefined
      }
      profile_sync_verification: {
        Args: never
        Returns: {
          email_verified: boolean
          is_complete: boolean
          phone_verified: boolean
        }[]
      }
      rate_limit_hit: {
        Args: { _bucket: string; _key: string; _limit: number; _window: string }
        Returns: boolean
      }
      register_login_result: {
        Args: { _identifier: string; _success: boolean }
        Returns: boolean
      }
      resolve_login_identity: {
        Args: { _identifier: string }
        Returns: {
          email: string
          is_active: boolean
          locked: boolean
        }[]
      }
      set_active_tenant: { Args: { _tenant_id: string }; Returns: string }
      shares_active_tenant: { Args: { _user_id: string }; Returns: boolean }
      structure_guard_allows_bucket: {
        Args: { _name: string }
        Returns: boolean
      }
      structure_guard_allows_table: {
        Args: { _name: string }
        Returns: boolean
      }
      structure_guard_disable: {
        Args: { _minutes?: number; _reason: string }
        Returns: string
      }
      structure_guard_enable: { Args: never; Returns: undefined }
      structure_guard_is_enabled: { Args: never; Returns: boolean }
      structure_guard_log_rejection: {
        Args: { _command: string; _object: string; _reason?: string }
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
    }
    Enums: {
      app_locale: "ar" | "en"
      app_role: "accountant" | "employee" | "supervisor"
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
