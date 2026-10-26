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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_events: {
        Row: {
          created_at: string
          detail: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      active_sessions: {
        Row: {
          created_at: string | null
          id: string
          ip_hash: string | null
          last_activity: string | null
          revocation_reason: string | null
          revoked_at: string | null
          session_hash: string | null
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          last_activity?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          session_hash?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          last_activity?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          session_hash?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          details: Json
          id: string
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string | null
          id: string
          reason: string | null
          subject_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          subject_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_logs_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_campaigns: {
        Row: {
          brand_id: string
          budget: number
          caption_count: number
          created_at: string
          deadline: string
          id: string
          image_count: number
          instructions: string
          language: string
          location: string | null
          name: string
          niche: string | null
          objective: string
          preferred_creator_id: string | null
          product_description: string
          reference_urls: string[]
          revision_allowance: number
          script_count: number
          status: string
          target_audience: string
          updated_at: string
          usage_months: number
          usage_rights: string
          video_count: number
        }
        Insert: {
          brand_id: string
          budget: number
          caption_count?: number
          created_at?: string
          deadline: string
          id?: string
          image_count?: number
          instructions?: string
          language?: string
          location?: string | null
          name: string
          niche?: string | null
          objective: string
          preferred_creator_id?: string | null
          product_description: string
          reference_urls?: string[]
          revision_allowance?: number
          script_count?: number
          status?: string
          target_audience: string
          updated_at?: string
          usage_months?: number
          usage_rights?: string
          video_count?: number
        }
        Update: {
          brand_id?: string
          budget?: number
          caption_count?: number
          created_at?: string
          deadline?: string
          id?: string
          image_count?: number
          instructions?: string
          language?: string
          location?: string | null
          name?: string
          niche?: string | null
          objective?: string
          preferred_creator_id?: string | null
          product_description?: string
          reference_urls?: string[]
          revision_allowance?: number
          script_count?: number
          status?: string
          target_audience?: string
          updated_at?: string
          usage_months?: number
          usage_rights?: string
          video_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_campaigns_preferred_creator_id_fkey"
            columns: ["preferred_creator_id"]
            isOneToOne: false
            referencedRelation: "ai_creators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_creator_packages: {
        Row: {
          active: boolean
          caption_count: number
          creator_id: string
          description: string
          extended_rights_price: number | null
          extra_revision_price: number | null
          id: string
          image_count: number
          name: string
          price: number
          revisions_included: number
          script_count: number
          sort: number
          turnaround_days: number
          usage_months: number
          usage_rights: string
          video_count: number
        }
        Insert: {
          active?: boolean
          caption_count?: number
          creator_id: string
          description: string
          extended_rights_price?: number | null
          extra_revision_price?: number | null
          id?: string
          image_count?: number
          name: string
          price: number
          revisions_included?: number
          script_count?: number
          sort?: number
          turnaround_days?: number
          usage_months?: number
          usage_rights: string
          video_count?: number
        }
        Update: {
          active?: boolean
          caption_count?: number
          creator_id?: string
          description?: string
          extended_rights_price?: number | null
          extra_revision_price?: number | null
          id?: string
          image_count?: number
          name?: string
          price?: number
          revisions_included?: number
          script_count?: number
          sort?: number
          turnaround_days?: number
          usage_months?: number
          usage_rights?: string
          video_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_creator_packages_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ai_creators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_creators: {
        Row: {
          active: boolean
          audiences: string[]
          avatar_url: string | null
          bio: string
          content_styles: string[]
          created_at: string
          formats: string[]
          id: string
          languages: string[]
          max_active_orders: number
          name: string
          niches: string[]
          personality: string
          portfolio: Json
          slug: string
          style_prompt: string
          tagline: string
          updated_at: string
          usage_terms: string
          voice_prompt: string
        }
        Insert: {
          active?: boolean
          audiences?: string[]
          avatar_url?: string | null
          bio: string
          content_styles?: string[]
          created_at?: string
          formats?: string[]
          id?: string
          languages?: string[]
          max_active_orders?: number
          name: string
          niches?: string[]
          personality: string
          portfolio?: Json
          slug: string
          style_prompt: string
          tagline: string
          updated_at?: string
          usage_terms: string
          voice_prompt: string
        }
        Update: {
          active?: boolean
          audiences?: string[]
          avatar_url?: string | null
          bio?: string
          content_styles?: string[]
          created_at?: string
          formats?: string[]
          id?: string
          languages?: string[]
          max_active_orders?: number
          name?: string
          niches?: string[]
          personality?: string
          portfolio?: Json
          slug?: string
          style_prompt?: string
          tagline?: string
          updated_at?: string
          usage_terms?: string
          voice_prompt?: string
        }
        Relationships: []
      }
      ai_match_results: {
        Row: {
          campaign_id: string
          computed_at: string
          creator_id: string
          package_id: string | null
          reasons: string[]
          score: number
          warnings: string[]
        }
        Insert: {
          campaign_id: string
          computed_at?: string
          creator_id: string
          package_id?: string | null
          reasons?: string[]
          score: number
          warnings?: string[]
        }
        Update: {
          campaign_id?: string
          computed_at?: string
          creator_id?: string
          package_id?: string | null
          reasons?: string[]
          score?: number
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ai_match_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_match_results_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ai_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_match_results_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ai_creator_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_order_assets: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_sample: boolean
          kind: string
          order_id: string
          position: number
          prompt: string | null
          status: string
          storage_path: string | null
          version: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_sample?: boolean
          kind: string
          order_id: string
          position?: number
          prompt?: string | null
          status?: string
          storage_path?: string | null
          version: number
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_sample?: boolean
          kind?: string
          order_id?: string
          position?: number
          prompt?: string | null
          status?: string
          storage_path?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_order_assets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v2_ai_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_order_events: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: string
          kind: string
          order_id: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          id?: string
          kind: string
          order_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v2_ai_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_orders: {
        Row: {
          brand_id: string
          brief: string
          completed_at: string | null
          created_at: string
          creator_id: string
          delivery: Json | null
          fee: number
          id: string
          package_name: string
          package_price: number
          paid_at: string | null
          rating: number | null
          review: string | null
          revision_note: string | null
          revisions_allowed: number
          revisions_used: number
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          brief: string
          completed_at?: string | null
          created_at?: string
          creator_id: string
          delivery?: Json | null
          fee: number
          id?: string
          package_name: string
          package_price: number
          paid_at?: string | null
          rating?: number | null
          review?: string | null
          revision_note?: string | null
          revisions_allowed?: number
          revisions_used?: number
          status?: string
          total: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          brief?: string
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          delivery?: Json | null
          fee?: number
          id?: string
          package_name?: string
          package_price?: number
          paid_at?: string | null
          rating?: number | null
          review?: string | null
          revision_note?: string | null
          revisions_allowed?: number
          revisions_used?: number
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_video_jobs: {
        Row: {
          created_at: string
          gateway_job_id: string | null
          id: string
          order_id: string
          position: number
          prompt: string
          started_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          gateway_job_id?: string | null
          id?: string
          order_id: string
          position: number
          prompt: string
          started_at?: string | null
          status?: string
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          gateway_job_id?: string | null
          id?: string
          order_id?: string
          position?: number
          prompt?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_video_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v2_ai_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          id: string
          pitch: string
          quote: number | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          id?: string
          pitch?: string
          quote?: number | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          pitch?: string
          quote?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_documents: {
        Row: {
          created_at: string | null
          document_type: string
          id: string
          storage_path: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          id?: string
          storage_path: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          id?: string
          storage_path?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          about: string
          approval_status: string
          business_address: string
          business_email: string
          company_name: string
          company_size: string
          created_at: string
          details: Json
          email_check: string
          gst_format_status: string
          gst_verification_status: string
          gstin_protected: string
          industry: string
          is_agency: boolean
          logo_url: string | null
          rejection_reason: string | null
          representative_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          turnover_range: string
          user_id: string
          website: string
        }
        Insert: {
          about?: string
          approval_status?: string
          business_address?: string
          business_email?: string
          company_name?: string
          company_size?: string
          created_at?: string
          details?: Json
          email_check?: string
          gst_format_status?: string
          gst_verification_status?: string
          gstin_protected?: string
          industry?: string
          is_agency?: boolean
          logo_url?: string | null
          rejection_reason?: string | null
          representative_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          turnover_range?: string
          user_id: string
          website?: string
        }
        Update: {
          about?: string
          approval_status?: string
          business_address?: string
          business_email?: string
          company_name?: string
          company_size?: string
          created_at?: string
          details?: Json
          email_check?: string
          gst_format_status?: string
          gst_verification_status?: string
          gstin_protected?: string
          industry?: string
          is_agency?: boolean
          logo_url?: string | null
          rejection_reason?: string | null
          representative_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          turnover_range?: string
          user_id?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_subscriptions: {
        Row: {
          plan: string
          renews_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          plan?: string
          renews_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          plan?: string
          renews_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          avatar_url: string | null
          bio: string | null
          budget: number | null
          created_at: string | null
          id: string
          is_demo: boolean
          languages: string[]
          location: string
          max_followers: number
          min_followers: number
          name: string
          niches: string[]
          platforms: string[]
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          budget?: number | null
          created_at?: string | null
          id?: string
          is_demo?: boolean
          languages?: string[]
          location?: string
          max_followers?: number
          min_followers?: number
          name?: string
          niches?: string[]
          platforms?: string[]
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          budget?: number | null
          created_at?: string | null
          id?: string
          is_demo?: boolean
          languages?: string[]
          location?: string
          max_followers?: number
          min_followers?: number
          name?: string
          niches?: string[]
          platforms?: string[]
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_saves: {
        Row: {
          campaign_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_saves_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v2_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_id: string
          budget_max: number | null
          budget_min: number | null
          category: string
          created_at: string
          currency: string
          deadline: string | null
          deliverables: string
          description: string
          id: string
          min_followers: number
          platforms: string[]
          status: string
          title: string
        }
        Insert: {
          brand_id: string
          budget_max?: number | null
          budget_min?: number | null
          category?: string
          created_at?: string
          currency?: string
          deadline?: string | null
          deliverables?: string
          description?: string
          id?: string
          min_followers?: number
          platforms?: string[]
          status?: string
          title: string
        }
        Update: {
          brand_id?: string
          budget_max?: number | null
          budget_min?: number | null
          category?: string
          created_at?: string
          currency?: string
          deadline?: string | null
          deliverables?: string
          description?: string
          id?: string
          min_followers?: number
          platforms?: string[]
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_deliverables: {
        Row: {
          approved_at: string | null
          collab_id: string
          delivered_at: string | null
          id: string
          label: string
          position: number
        }
        Insert: {
          approved_at?: string | null
          collab_id: string
          delivered_at?: string | null
          id?: string
          label: string
          position?: number
        }
        Update: {
          approved_at?: string | null
          collab_id?: string
          delivered_at?: string | null
          id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "collab_deliverables_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collabs"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_messages: {
        Row: {
          body: string
          collab_id: string
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body?: string
          collab_id: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          collab_id?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_messages_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_reports: {
        Row: {
          collab_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          collab_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
        }
        Update: {
          collab_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_reports_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_requests: {
        Row: {
          created_at: string | null
          from_user: string
          id: string
          message: string
          status: string
          target_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string | null
          from_user: string
          id?: string
          message?: string
          status?: string
          target_id: string
          target_kind: string
        }
        Update: {
          created_at?: string | null
          from_user?: string
          id?: string
          message?: string
          status?: string
          target_id?: string
          target_kind?: string
        }
        Relationships: []
      }
      collab_reviews: {
        Row: {
          collab_id: string
          comment: string
          created_at: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          collab_id: string
          comment?: string
          created_at?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          collab_id?: string
          comment?: string
          created_at?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_reviews_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_settings: {
        Row: {
          creator_id: string
          daily_limit_per_brand: number
          min_budget: number
          open_to_collabs: boolean
          updated_at: string
        }
        Insert: {
          creator_id: string
          daily_limit_per_brand?: number
          min_budget?: number
          open_to_collabs?: boolean
          updated_at?: string
        }
        Update: {
          creator_id?: string
          daily_limit_per_brand?: number
          min_budget?: number
          open_to_collabs?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_settings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_activity: {
        Row: {
          actor_id: string | null
          body: string
          collaboration_id: string
          created_at: string
          id: string
          kind: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          collaboration_id: string
          created_at?: string
          id?: string
          kind?: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          collaboration_id?: string
          created_at?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_activity_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaborations"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_files: {
        Row: {
          collaboration_id: string
          created_at: string
          id: string
          mime: string | null
          name: string
          path: string
          size: number
          uploader_id: string
        }
        Insert: {
          collaboration_id: string
          created_at?: string
          id?: string
          mime?: string | null
          name: string
          path: string
          size?: number
          uploader_id?: string
        }
        Update: {
          collaboration_id?: string
          created_at?: string
          id?: string
          mime?: string | null
          name?: string
          path?: string
          size?: number
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_files_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaborations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_files_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_members: {
        Row: {
          collaboration_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          collaboration_id: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          collaboration_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_members_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaborations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborations: {
        Row: {
          brand_id: string
          campaign_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "v2_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      collabs: {
        Row: {
          accepted_at: string | null
          brand_id: string
          brief: string
          budget_max: number
          budget_min: number
          cancel_reason: string | null
          completed_at: string | null
          counter_budget_max: number | null
          counter_budget_min: number | null
          counter_deadline: string | null
          counter_note: string | null
          created_at: string
          creator_id: string
          deadline: string | null
          expires_at: string
          id: string
          message: string
          plan_type: string
          reference_links: string[]
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          brand_id: string
          brief: string
          budget_max?: number
          budget_min?: number
          cancel_reason?: string | null
          completed_at?: string | null
          counter_budget_max?: number | null
          counter_budget_min?: number | null
          counter_deadline?: string | null
          counter_note?: string | null
          created_at?: string
          creator_id: string
          deadline?: string | null
          expires_at?: string
          id?: string
          message?: string
          plan_type: string
          reference_links?: string[]
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          brand_id?: string
          brief?: string
          budget_max?: number
          budget_min?: number
          cancel_reason?: string | null
          completed_at?: string | null
          counter_budget_max?: number | null
          counter_budget_min?: number | null
          counter_deadline?: string | null
          counter_note?: string | null
          created_at?: string
          creator_id?: string
          deadline?: string | null
          expires_at?: string
          id?: string
          message?: string
          plan_type?: string
          reference_links?: string[]
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collabs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collabs_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          last_sender_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_sender_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v2_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_last_sender_id_fkey"
            columns: ["last_sender_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_ai_reviews: {
        Row: {
          id: string
          model_name: string
          report: Json
          request_id: string
          review_version: number
          reviewed_at: string
        }
        Insert: {
          id?: string
          model_name: string
          report: Json
          request_id: string
          review_version?: number
          reviewed_at?: string
        }
        Update: {
          id?: string
          model_name?: string
          report?: Json
          request_id?: string
          review_version?: number
          reviewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_ai_reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "creator_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          ai_tools: Json
          bio: string
          details: Json
          location: string
          profile_completion: number
          skills: Json
          social_links: Json
          specialization: string
          user_id: string
          verification_status: string
        }
        Insert: {
          ai_tools?: Json
          bio?: string
          details?: Json
          location?: string
          profile_completion?: number
          skills?: Json
          social_links?: Json
          specialization?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          ai_tools?: Json
          bio?: string
          details?: Json
          location?: string
          profile_completion?: number
          skills?: Json
          social_links?: Json
          specialization?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_projects: {
        Row: {
          client: string
          created_at: string
          description: string
          id: string
          link: string
          title: string
          user_id: string
          year: number | null
        }
        Insert: {
          client?: string
          created_at?: string
          description?: string
          id?: string
          link?: string
          title: string
          user_id: string
          year?: number | null
        }
        Update: {
          client?: string
          created_at?: string
          description?: string
          id?: string
          link?: string
          title?: string
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_skills: {
        Row: {
          created_at: string
          id: string
          level: string
          link: string
          name: string
          tools: string[]
          user_id: string
          years: number
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          link?: string
          name: string
          tools?: string[]
          user_id: string
          years?: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          link?: string
          name?: string
          tools?: string[]
          user_id?: string
          years?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_social_accounts: {
        Row: {
          avg_views: number | null
          follower_count: number
          handle: string
          id: string
          last_synced_at: string | null
          platform: string
          profile_url: string
          user_id: string
          verified: boolean
        }
        Insert: {
          avg_views?: number | null
          follower_count?: number
          handle?: string
          id?: string
          last_synced_at?: string | null
          platform: string
          profile_url?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          avg_views?: number | null
          follower_count?: number
          handle?: string
          id?: string
          last_synced_at?: string | null
          platform?: string
          profile_url?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "creator_social_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_verification_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          internal: boolean
          new_status: string | null
          previous_status: string | null
          reason: string
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          internal?: boolean
          new_status?: string | null
          previous_status?: string | null
          reason?: string
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          internal?: boolean
          new_status?: string | null
          previous_status?: string | null
          reason?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_verification_audit_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "creator_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_verification_evidence: {
        Row: {
          admin_note: string
          created_at: string
          creator_id: string
          evidence_type: string
          file_name: string
          id: string
          permission_to_share: boolean
          related_project_id: string | null
          related_skill: string
          review_status: string
          reviewed_at: string | null
          storage_path: string | null
          title: string
          url: string
        }
        Insert: {
          admin_note?: string
          created_at?: string
          creator_id: string
          evidence_type: string
          file_name?: string
          id?: string
          permission_to_share?: boolean
          related_project_id?: string | null
          related_skill?: string
          review_status?: string
          reviewed_at?: string | null
          storage_path?: string | null
          title: string
          url?: string
        }
        Update: {
          admin_note?: string
          created_at?: string
          creator_id?: string
          evidence_type?: string
          file_name?: string
          id?: string
          permission_to_share?: boolean
          related_project_id?: string | null
          related_skill?: string
          review_status?: string
          reviewed_at?: string | null
          storage_path?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_verification_evidence_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_verification_evidence_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "creator_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_verification_requests: {
        Row: {
          ai_review_status: string
          created_at: string
          creator_id: string
          decision_reason: string
          id: string
          missing_items: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          ai_review_status?: string
          created_at?: string
          creator_id: string
          decision_reason?: string
          id?: string
          missing_items?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_review_status?: string
          created_at?: string
          creator_id?: string
          decision_reason?: string
          id?: string
          missing_items?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_verification_requests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          engagement_rate: number
          followers: number
          handle: string | null
          id: string
          is_demo: boolean
          languages: string[]
          location: string
          name: string
          niches: string[]
          platforms: string[]
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          engagement_rate?: number
          followers?: number
          handle?: string | null
          id?: string
          is_demo?: boolean
          languages?: string[]
          location?: string
          name?: string
          niches?: string[]
          platforms?: string[]
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          engagement_rate?: number
          followers?: number
          handle?: string | null
          id?: string
          is_demo?: boolean
          languages?: string[]
          location?: string
          name?: string
          niches?: string[]
          platforms?: string[]
          user_id?: string | null
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          collaboration_id: string
          completed_at: string | null
          created_at: string
          creator_id: string | null
          due_date: string | null
          feedback: string | null
          final_url: string | null
          id: string
          link: string | null
          proof_url: string | null
          reviewed_at: string | null
          revision_limit: number
          revisions_used: number
          status: string
          submitted_at: string | null
          title: string
        }
        Insert: {
          collaboration_id: string
          completed_at?: string | null
          created_at?: string
          creator_id?: string | null
          due_date?: string | null
          feedback?: string | null
          final_url?: string | null
          id?: string
          link?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          revision_limit?: number
          revisions_used?: number
          status?: string
          submitted_at?: string | null
          title: string
        }
        Update: {
          collaboration_id?: string
          completed_at?: string | null
          created_at?: string
          creator_id?: string | null
          due_date?: string | null
          feedback?: string | null
          final_url?: string | null
          id?: string
          link?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          revision_limit?: number
          revisions_used?: number
          status?: string
          submitted_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaborations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_library: {
        Row: {
          data: Json
          key: string
          kind: string
        }
        Insert: {
          data?: Json
          key: string
          kind: string
        }
        Update: {
          data?: Json
          key?: string
          kind?: string
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          body: string
          created_at: string
          error: string | null
          folder: string
          id: string
          is_read: boolean
          owner_id: string
          sent_at: string | null
          status: string
          subject: string
          to_address: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          error?: string | null
          folder?: string
          id?: string
          is_read?: boolean
          owner_id: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_address?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          folder?: string
          id?: string
          is_read?: boolean
          owner_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_address?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_likes: {
        Row: {
          created_at: string
          post_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_likes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          image_key: string | null
          image_path: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          image_key?: string | null
          image_path?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          image_key?: string | null
          image_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_profiles: {
        Row: {
          avatar_path: string | null
          bio: string
          created_at: string
          demo_no: number | null
          display_name: string
          handle: string
          id: string
          is_demo: boolean
          kind: string
          user_id: string | null
        }
        Insert: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          demo_no?: number | null
          display_name: string
          handle: string
          id?: string
          is_demo?: boolean
          kind: string
          user_id?: string | null
        }
        Update: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          demo_no?: number | null
          display_name?: string
          handle?: string
          id?: string
          is_demo?: boolean
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      feed_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reposts: {
        Row: {
          created_at: string
          post_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_reposts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_saves: {
        Row: {
          created_at: string
          post_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_saves_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_identities: {
        Row: {
          auth_user_id: string | null
          email: string
          original_user_id: string
          profile_data: Json | null
        }
        Insert: {
          auth_user_id?: string | null
          email: string
          original_user_id: string
          profile_data?: Json | null
        }
        Update: {
          auth_user_id?: string | null
          email?: string
          original_user_id?: string
          profile_data?: Json | null
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_automated: boolean
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json
          body?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_automated?: boolean
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_automated?: boolean
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          collaboration_id: string
          created_at: string
          created_by: string | null
          done: boolean
          due_date: string | null
          id: string
          title: string
        }
        Insert: {
          collaboration_id: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          title: string
        }
        Update: {
          collaboration_id?: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaborations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          campaigns: boolean
          collaboration: boolean
          email: boolean
          in_app: boolean
          messages: boolean
          social: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          campaigns?: boolean
          collaboration?: boolean
          email?: boolean
          in_app?: boolean
          messages?: boolean
          social?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          campaigns?: boolean
          collaboration?: boolean
          email?: boolean
          in_app?: boolean
          messages?: boolean
          social?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          link: string
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          link?: string
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          link?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          brand_id: string
          budget: number | null
          campaign_id: string | null
          created_at: string
          creator_id: string
          currency: string
          id: string
          message: string
          status: string
        }
        Insert: {
          brand_id: string
          budget?: number | null
          campaign_id?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          id?: string
          message?: string
          status?: string
        }
        Update: {
          brand_id?: string
          budget?: number | null
          campaign_id?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          id?: string
          message?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_charges: {
        Row: {
          amount: number
          brand_id: string
          created_at: string
          description: string
          id: string
          kind: string
          months: number | null
          order_id: string
          paid_at: string | null
          status: string
        }
        Insert: {
          amount: number
          brand_id: string
          created_at?: string
          description: string
          id?: string
          kind: string
          months?: number | null
          order_id: string
          paid_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          brand_id?: string
          created_at?: string
          description?: string
          id?: string
          kind?: string
          months?: number | null
          order_id?: string
          paid_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_charges_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_charges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v2_ai_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          brand_id: string
          charge_id: string | null
          created_at: string
          id: string
          is_simulated: boolean
          kind: string
          order_id: string | null
          plan_id: string | null
          platform_fee: number
          processing_fee: number
          provider: string
          refunded_at: string | null
          status: string
        }
        Insert: {
          amount: number
          brand_id: string
          charge_id?: string | null
          created_at?: string
          id?: string
          is_simulated?: boolean
          kind: string
          order_id?: string | null
          plan_id?: string | null
          platform_fee?: number
          processing_fee?: number
          provider?: string
          refunded_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          brand_id?: string
          charge_id?: string | null
          created_at?: string
          id?: string
          is_simulated?: boolean
          kind?: string
          order_id?: string | null
          plan_id?: string | null
          platform_fee?: number
          processing_fee?: number
          provider?: string
          refunded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "order_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v2_ai_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          commission_pct: number
          fee_mode: string
          id: boolean
          image_cost_estimate: number
          payment_fee_pct: number
          text_cost_estimate: number
          updated_at: string
          video_cost_estimate: number
        }
        Insert: {
          commission_pct?: number
          fee_mode?: string
          id?: boolean
          image_cost_estimate?: number
          payment_fee_pct?: number
          text_cost_estimate?: number
          updated_at?: string
          video_cost_estimate?: number
        }
        Update: {
          commission_pct?: number
          fee_mode?: string
          id?: boolean
          image_cost_estimate?: number
          payment_fee_pct?: number
          text_cost_estimate?: number
          updated_at?: string
          video_cost_estimate?: number
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          created_at: string | null
          id: string
          media_type: string
          storage_path: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_type: string
          storage_path: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          media_type?: string
          storage_path?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          campaign_id: string | null
          category: string | null
          comment_count: number
          created_at: string
          edited_at: string | null
          engagement_score: number | null
          id: string
          is_demo: boolean
          like_count: number
          media: Json
          post_type: string
          repost_count: number
          visibility: string
        }
        Insert: {
          author_id: string
          body?: string
          campaign_id?: string | null
          category?: string | null
          comment_count?: number
          created_at?: string
          edited_at?: string | null
          engagement_score?: number | null
          id?: string
          is_demo?: boolean
          like_count?: number
          media?: Json
          post_type?: string
          repost_count?: number
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string
          campaign_id?: string | null
          category?: string | null
          comment_count?: number
          created_at?: string
          edited_at?: string | null
          engagement_score?: number | null
          id?: string
          is_demo?: boolean
          like_count?: number
          media?: Json
          post_type?: string
          repost_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v2_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          avatar_path: string | null
          bio: string
          company_name: string
          cover_path: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          industry: string
          location: string
          skills: string[]
          social_links: Json
          starting_rate: number | null
          tools: string[]
          username: string | null
          website: string
          whatsapp: string
        }
        Insert: {
          account_status?: string
          avatar_path?: string | null
          bio?: string
          company_name?: string
          cover_path?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          industry?: string
          location?: string
          skills?: string[]
          social_links?: Json
          starting_rate?: number | null
          tools?: string[]
          username?: string | null
          website?: string
          whatsapp?: string
        }
        Update: {
          account_status?: string
          avatar_path?: string | null
          bio?: string
          company_name?: string
          cover_path?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          industry?: string
          location?: string
          skills?: string[]
          social_links?: Json
          starting_rate?: number | null
          tools?: string[]
          username?: string | null
          website?: string
          whatsapp?: string
        }
        Relationships: []
      }
      project_briefs: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json
          id?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_briefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reposts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlist_items: {
        Row: {
          added_at: string
          creator_id: string
          note: string | null
          shortlist_id: string
        }
        Insert: {
          added_at?: string
          creator_id: string
          note?: string | null
          shortlist_id: string
        }
        Update: {
          added_at?: string
          creator_id?: string
          note?: string | null
          shortlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortlist_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlist_items_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "v2_shortlists"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlists: {
        Row: {
          creator_id: string
          user_id: string
        }
        Insert: {
          creator_id: string
          user_id: string
        }
        Update: {
          creator_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          campaign_limit: number | null
          features: string[]
          id: string
          name: string
          order_limit: number | null
          price_monthly: number
          sort: number
        }
        Insert: {
          campaign_limit?: number | null
          features?: string[]
          id: string
          name: string
          order_limit?: number | null
          price_monthly: number
          sort?: number
        }
        Update: {
          campaign_limit?: number | null
          features?: string[]
          id?: string
          name?: string
          order_limit?: number | null
          price_monthly?: number
          sort?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          collaboration_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          status: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          collaboration_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          collaboration_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_collaboration_id_fkey"
            columns: ["collaboration_id"]
            isOneToOne: false
            referencedRelation: "collaborations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      v2_ai_orders: {
        Row: {
          approved_at: string | null
          brand_id: string
          brand_total: number
          campaign_id: string
          cancelled_at: string | null
          caption_count: number
          commission_pct: number
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          creator_id: string
          current_version: number
          deadline: string
          decided_at: string | null
          decision_reason: string | null
          extra_requirements: string
          extra_revision_price: number | null
          fee_mode: string
          generating_since: string | null
          generation_cost_estimate: number
          id: string
          image_count: number
          last_feedback: string | null
          package_id: string
          package_price: number
          paid_at: string | null
          payment_fee: number
          platform_fee: number
          production_started_at: string | null
          ready_at: string | null
          revisions_allowed: number
          revisions_used: number
          script_count: number
          sent_at: string | null
          status: string
          updated_at: string
          usage_months: number
          usage_rights: string
          video_count: number
        }
        Insert: {
          approved_at?: string | null
          brand_id: string
          brand_total?: number
          campaign_id: string
          cancelled_at?: string | null
          caption_count?: number
          commission_pct?: number
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          creator_id: string
          current_version?: number
          deadline: string
          decided_at?: string | null
          decision_reason?: string | null
          extra_requirements?: string
          extra_revision_price?: number | null
          fee_mode?: string
          generating_since?: string | null
          generation_cost_estimate?: number
          id?: string
          image_count?: number
          last_feedback?: string | null
          package_id: string
          package_price?: number
          paid_at?: string | null
          payment_fee?: number
          platform_fee?: number
          production_started_at?: string | null
          ready_at?: string | null
          revisions_allowed?: number
          revisions_used?: number
          script_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
          usage_months?: number
          usage_rights?: string
          video_count?: number
        }
        Update: {
          approved_at?: string | null
          brand_id?: string
          brand_total?: number
          campaign_id?: string
          cancelled_at?: string | null
          caption_count?: number
          commission_pct?: number
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          creator_id?: string
          current_version?: number
          deadline?: string
          decided_at?: string | null
          decision_reason?: string | null
          extra_requirements?: string
          extra_revision_price?: number | null
          fee_mode?: string
          generating_since?: string | null
          generation_cost_estimate?: number
          id?: string
          image_count?: number
          last_feedback?: string | null
          package_id?: string
          package_price?: number
          paid_at?: string | null
          payment_fee?: number
          platform_fee?: number
          production_started_at?: string | null
          ready_at?: string | null
          revisions_allowed?: number
          revisions_used?: number
          script_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
          usage_months?: number
          usage_rights?: string
          video_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_ai_orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_ai_orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_ai_orders_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ai_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_ai_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ai_creator_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_applications: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          id: string
          portfolio_item_ids: string[]
          proposal: string
          proposed_price: number | null
          rate: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          id?: string
          portfolio_item_ids?: string[]
          proposal?: string
          proposed_price?: number | null
          rate?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          portfolio_item_ids?: string[]
          proposal?: string
          proposed_price?: number | null
          rate?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v2_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_applications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_brand_profiles: {
        Row: {
          campaign_categories: string[]
          collaboration_requirements: string | null
          company_description: string | null
          contact_person: string | null
          industry: string | null
          products: string | null
          target_audience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_categories?: string[]
          collaboration_requirements?: string | null
          company_description?: string | null
          contact_person?: string | null
          industry?: string | null
          products?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_categories?: string[]
          collaboration_requirements?: string | null
          company_description?: string | null
          contact_person?: string | null
          industry?: string | null
          products?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_brand_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_brand_subscriptions: {
        Row: {
          brand_id: string
          current_period_end: string | null
          current_period_start: string
          is_simulated: boolean
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          current_period_end?: string | null
          current_period_start?: string
          is_simulated?: boolean
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          current_period_end?: string | null
          current_period_start?: string
          is_simulated?: boolean
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_brand_subscriptions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_brand_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_campaigns: {
        Row: {
          application_deadline: string | null
          applications_count: number
          brand_id: string
          budget_max: number | null
          budget_min: number | null
          category: string
          compensation_type: string
          created_at: string
          creators_needed: number
          currency: string
          deadline: string | null
          deliverables: string[]
          description: string
          eligibility: string[]
          goals: string | null
          id: string
          is_demo: boolean
          location: string | null
          moderation_note: string | null
          project_type: string
          published_at: string | null
          remote: boolean
          skills: string[]
          stage: string
          status: string
          target_audience: string | null
          title: string
          updated_at: string
          usage_rights: string | null
        }
        Insert: {
          application_deadline?: string | null
          applications_count?: number
          brand_id: string
          budget_max?: number | null
          budget_min?: number | null
          category?: string
          compensation_type?: string
          created_at?: string
          creators_needed?: number
          currency?: string
          deadline?: string | null
          deliverables?: string[]
          description?: string
          eligibility?: string[]
          goals?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          moderation_note?: string | null
          project_type?: string
          published_at?: string | null
          remote?: boolean
          skills?: string[]
          stage?: string
          status?: string
          target_audience?: string | null
          title: string
          updated_at?: string
          usage_rights?: string | null
        }
        Update: {
          application_deadline?: string | null
          applications_count?: number
          brand_id?: string
          budget_max?: number | null
          budget_min?: number | null
          category?: string
          compensation_type?: string
          created_at?: string
          creators_needed?: number
          currency?: string
          deadline?: string | null
          deliverables?: string[]
          description?: string
          eligibility?: string[]
          goals?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          moderation_note?: string | null
          project_type?: string
          published_at?: string | null
          remote?: boolean
          skills?: string[]
          stage?: string
          status?: string
          target_audience?: string | null
          title?: string
          updated_at?: string
          usage_rights?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_creator_profiles: {
        Row: {
          audience_size: number
          availability: string | null
          categories: string[]
          collaboration_interests: string[]
          content_types: string[]
          engagement_rate: number | null
          experience_level: string | null
          languages: string[]
          metrics_confirmed_at: string | null
          platforms: Json
          portfolio_url: string | null
          preferred_project_types: string[]
          rate_max: number | null
          rate_min: number | null
          skills: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_size?: number
          availability?: string | null
          categories?: string[]
          collaboration_interests?: string[]
          content_types?: string[]
          engagement_rate?: number | null
          experience_level?: string | null
          languages?: string[]
          metrics_confirmed_at?: string | null
          platforms?: Json
          portfolio_url?: string | null
          preferred_project_types?: string[]
          rate_max?: number | null
          rate_min?: number | null
          skills?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_size?: number
          availability?: string | null
          categories?: string[]
          collaboration_interests?: string[]
          content_types?: string[]
          engagement_rate?: number | null
          experience_level?: string | null
          languages?: string[]
          metrics_confirmed_at?: string | null
          platforms?: Json
          portfolio_url?: string | null
          preferred_project_types?: string[]
          rate_max?: number | null
          rate_min?: number | null
          skills?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_creator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          dedupe_key: string | null
          id: string
          link: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_portfolio_items: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          tags: string[]
          title: string
          url: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          tags?: string[]
          title: string
          url?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          tags?: string[]
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_portfolio_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          bio: string | null
          collab_permission: string
          contact_email: string | null
          cover_url: string | null
          created_at: string
          display_name: string
          dm_permission: string
          engagement_rate: number | null
          followers_count: number
          following_count: number
          headline: string | null
          id: string
          is_demo: boolean
          location: string | null
          onboarded: boolean
          posts_count: number
          role_locked_at: string | null
          show_email: boolean
          social_links: Json
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
          username: string | null
          verified: boolean
          website: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          collab_permission?: string
          contact_email?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          dm_permission?: string
          engagement_rate?: number | null
          followers_count?: number
          following_count?: number
          headline?: string | null
          id: string
          is_demo?: boolean
          location?: string | null
          onboarded?: boolean
          posts_count?: number
          role_locked_at?: string | null
          show_email?: boolean
          social_links?: Json
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          username?: string | null
          verified?: boolean
          website?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          collab_permission?: string
          contact_email?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          dm_permission?: string
          engagement_rate?: number | null
          followers_count?: number
          following_count?: number
          headline?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          onboarded?: boolean
          posts_count?: number
          role_locked_at?: string | null
          show_email?: boolean
          social_links?: Json
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          username?: string | null
          verified?: boolean
          website?: string | null
        }
        Relationships: []
      }
      v2_shortlists: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_shortlists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["v2_app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["v2_app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["v2_app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          provider_reference: string | null
          reason: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          provider_reference?: string | null
          reason?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          provider_reference?: string | null
          reason?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          created_at: string
          kind: string
          note: string
          reason: string | null
          resubmissions: number
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kind?: string
          note?: string
          reason?: string | null
          resubmissions?: number
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          note?: string
          reason?: string | null
          resubmissions?: number
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_event: {
        Args: { _detail: string; _kind: string; _user: string }
        Returns: undefined
      }
      add_extended_rights: { Args: { _order: string }; Returns: string }
      admin_change_account_type: {
        Args: {
          _reason: string
          _type: Database["public"]["Enums"]["account_type"]
          _user: string
        }
        Returns: undefined
      }
      admin_confirm_metrics: {
        Args: { _confirm: boolean; _reason?: string; _user: string }
        Returns: undefined
      }
      admin_moderate_campaign: {
        Args: { _campaign: string; _reason: string; _status: string }
        Returns: undefined
      }
      admin_platform_stats: { Args: never; Returns: Json }
      admin_refund_order: {
        Args: { _order: string; _reason: string }
        Returns: undefined
      }
      admin_revenue_summary: { Args: never; Returns: Json }
      admin_review_verification: {
        Args: { _approve: boolean; _reason?: string; _user: string }
        Returns: undefined
      }
      admin_set_ai_creator: {
        Args: { _active: boolean; _creator: string; _reason: string }
        Returns: undefined
      }
      admin_set_package: {
        Args: { _active: boolean; _package: string; _price: number }
        Returns: undefined
      }
      admin_set_suspended: {
        Args: { _reason?: string; _suspend: boolean; _user: string }
        Returns: undefined
      }
      admin_set_verified: {
        Args: { _user: string; _verified: boolean }
        Returns: undefined
      }
      admin_update_settings: {
        Args: {
          _commission: number
          _fee_mode: string
          _image_cost: number
          _payment_fee_pct: number
          _text_cost: number
        }
        Returns: undefined
      }
      ai_orders_snapshot_price: {
        Args: { o: Database["public"]["Tables"]["v2_ai_orders"]["Row"] }
        Returns: {
          approved_at: string | null
          brand_id: string
          brand_total: number
          campaign_id: string
          cancelled_at: string | null
          caption_count: number
          commission_pct: number
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          creator_id: string
          current_version: number
          deadline: string
          decided_at: string | null
          decision_reason: string | null
          extra_requirements: string
          extra_revision_price: number | null
          fee_mode: string
          generating_since: string | null
          generation_cost_estimate: number
          id: string
          image_count: number
          last_feedback: string | null
          package_id: string
          package_price: number
          paid_at: string | null
          payment_fee: number
          platform_fee: number
          production_started_at: string | null
          ready_at: string | null
          revisions_allowed: number
          revisions_used: number
          script_count: number
          sent_at: string | null
          status: string
          updated_at: string
          usage_months: number
          usage_rights: string
          video_count: number
        }
        SetofOptions: {
          from: "v2_ai_orders"
          to: "v2_ai_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_content: { Args: { _order: string }; Returns: undefined }
      audit: {
        Args: {
          _action: string
          _details?: Json
          _reason: string
          _target: string
          _type: string
        }
        Returns: undefined
      }
      begin_generation: { Args: { _order: string }; Returns: number }
      brand_badges: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          verified: boolean
        }[]
      }
      brand_plan: {
        Args: { _uid: string }
        Returns: {
          campaign_limit: number | null
          features: string[]
          id: string
          name: string
          order_limit: number | null
          price_monthly: number
          sort: number
        }
        SetofOptions: {
          from: "*"
          to: "subscription_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      campaign_committed: {
        Args: { _campaign: string; _except: string }
        Returns: number
      }
      cancel_order: {
        Args: { _order: string; _reason: string }
        Returns: undefined
      }
      change_plan: { Args: { _plan: string }; Returns: undefined }
      choose_account_type: {
        Args: { _type: Database["public"]["Enums"]["account_type"] }
        Returns: undefined
      }
      choose_signup_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      cleanup_orphan_profiles: { Args: never; Returns: undefined }
      clear_demo_content: { Args: never; Returns: Json }
      collab_action: {
        Args: {
          _action: string
          _deadline?: string
          _id: string
          _max?: number
          _min?: number
          _note?: string
        }
        Returns: string
      }
      collab_role: { Args: { _collab: string; _uid: string }; Returns: string }
      collab_unlocked: { Args: { _collab: string }; Returns: boolean }
      complete_order: { Args: { _order: string }; Returns: undefined }
      compute_matches: {
        Args: { _campaign: string }
        Returns: {
          campaign_id: string
          computed_at: string
          creator_id: string
          package_id: string | null
          reasons: string[]
          score: number
          warnings: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_match_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      confirm_order: { Args: { _order: string }; Returns: undefined }
      creator_track_record: {
        Args: { _user: string }
        Returns: {
          completed: number
          on_time: number
          streak: number
          success_rate: number
        }[]
      }
      deal_contacts: {
        Args: { _id: string; _kind: string }
        Returns: {
          brand_email: string
          brand_whatsapp: string
          creator_email: string
          creator_whatsapp: string
        }[]
      }
      dedupe_demo_posts: { Args: never; Returns: number }
      deliverable_action: {
        Args: { _action: string; _id: string }
        Returns: undefined
      }
      demo_apply_library: { Args: never; Returns: Json }
      demo_fill_creator_details: { Args: never; Returns: number }
      demo_hash: { Args: { _mod: number; _seed: string }; Returns: number }
      demo_sentence_case: { Args: { _t: string }; Returns: string }
      demo_uuid: { Args: { _kind: string; _n: number }; Returns: string }
      ensure_feed_profile: { Args: never; Returns: string }
      expire_collabs: { Args: never; Returns: undefined }
      fail_generation: {
        Args: { _message: string; _order: string }
        Returns: undefined
      }
      finish_generation: {
        Args: {
          _images: number
          _order: string
          _texts: number
          _version: number
          _videos?: number
        }
        Returns: undefined
      }
      generation_window: { Args: { _videos: number }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inr: { Args: { _n: number }; Returns: string }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      is_brand: { Args: { _uid: string }; Returns: boolean }
      is_business_email: { Args: { _email: string }; Returns: boolean }
      is_campaign_owner: {
        Args: { _campaign: string; _uid: string }
        Returns: boolean
      }
      is_collab_member: {
        Args: { _collab: string; _uid: string }
        Returns: boolean
      }
      is_collab_party: { Args: { _collab: string }; Returns: boolean }
      is_conversation_member: {
        Args: { _conv: string; _uid: string }
        Returns: boolean
      }
      is_creator: { Args: { _uid: string }; Returns: boolean }
      is_order_brand: {
        Args: { _order: string; _uid: string }
        Returns: boolean
      }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      is_suspended: { Args: { _uid: string }; Returns: boolean }
      is_verified: { Args: { _uid: string }; Returns: boolean }
      is_verified_creator: { Args: { _id: string }; Returns: boolean }
      log_collab: {
        Args: { _body: string; _collab: string; _kind: string }
        Returns: undefined
      }
      make_username: { Args: { _base: string; _id: string }; Returns: string }
      mark_messages_read: { Args: { _other: string }; Returns: undefined }
      my_order: {
        Args: { _order: string }
        Returns: {
          approved_at: string | null
          brand_id: string
          brand_total: number
          campaign_id: string
          cancelled_at: string | null
          caption_count: number
          commission_pct: number
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          creator_id: string
          current_version: number
          deadline: string
          decided_at: string | null
          decision_reason: string | null
          extra_requirements: string
          extra_revision_price: number | null
          fee_mode: string
          generating_since: string | null
          generation_cost_estimate: number
          id: string
          image_count: number
          last_feedback: string | null
          package_id: string
          package_price: number
          paid_at: string | null
          payment_fee: number
          platform_fee: number
          production_started_at: string | null
          ready_at: string | null
          revisions_allowed: number
          revisions_used: number
          script_count: number
          sent_at: string | null
          status: string
          updated_at: string
          usage_months: number
          usage_rights: string
          video_count: number
        }
        SetofOptions: {
          from: "*"
          to: "v2_ai_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_unread_counts: {
        Args: never
        Returns: {
          conversation_id: string
          unread: number
        }[]
      }
      notify: {
        Args: { _body: string; _link: string; _title: string; _user: string }
        Returns: undefined
      }
      order_event: {
        Args: { _body: string; _kind: string; _order: string }
        Returns: undefined
      }
      order_notify: {
        Args: {
          _body: string
          o: Database["public"]["Tables"]["v2_ai_orders"]["Row"]
        }
        Returns: undefined
      }
      owns_shortlist: {
        Args: { _list: string; _uid: string }
        Returns: boolean
      }
      party_names: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      pay_charge: { Args: { _charge: string }; Returns: undefined }
      private_path_allowed: {
        Args: { _name: string; _uid: string; _write: boolean }
        Returns: boolean
      }
      public_campaigns: {
        Args: {
          _category?: string
          _limit?: number
          _min_budget?: number
          _offset?: number
          _q?: string
          _stage?: string
        }
        Returns: {
          application_deadline: string
          applications_count: number
          brand: Json
          budget_max: number
          budget_min: number
          category: string
          compensation_type: string
          creators_needed: number
          currency: string
          deadline: string
          deliverables: string[]
          description: string
          eligibility: string[]
          id: string
          is_demo: boolean
          published_at: string
          stage: string
          status: string
          target_audience: string
          title: string
        }[]
      }
      public_creators: {
        Args: { _id?: string }
        Returns: {
          bio: string
          categories: Json
          currency: string
          full_name: string
          headline: string
          instagram: Json
          languages: Json
          location: string
          rate: number
          skills: Json
          specialization: string
          total_reach: number
          user_id: string
          youtube: Json
        }[]
      }
      public_feed: {
        Args: {
          _category?: string
          _limit?: number
          _offset?: number
          _q?: string
          _sort?: string
        }
        Returns: {
          author: Json
          body: string
          campaign_id: string
          category: string
          comment_count: number
          created_at: string
          id: string
          is_demo: boolean
          like_count: number
          media: Json
          post_type: string
          repost_count: number
        }[]
      }
      public_profile: {
        Args: { _id?: string; _username?: string }
        Returns: {
          avatar_path: string
          bio: string
          company_name: string
          cover_path: string
          created_at: string
          full_name: string
          id: string
          industry: string
          location: string
          min_budget: number
          open_to_collabs: boolean
          rating: number
          review_count: number
          role: string
          skills: string[]
          social_links: Json
          starting_rate: number
          tools: string[]
          username: string
          website: string
        }[]
      }
      rate_limit: {
        Args: {
          _col: string
          _max: number
          _table: string
          _uid: string
          _window: string
        }
        Returns: undefined
      }
      report_blocked_action: { Args: { _action: string }; Returns: undefined }
      request_revision: {
        Args: { _feedback: string; _order: string }
        Returns: Json
      }
      revise_offer: { Args: { _order: string }; Returns: undefined }
      search_creators: {
        Args: {
          _available_only?: boolean
          _content_type?: string
          _language?: string
          _limit?: number
          _location?: string
          _max_rate?: number
          _min_audience?: number
          _min_engagement?: number
          _niche?: string
          _offset?: number
          _platform?: string
          _q?: string
          _sort?: string
          _verified_only?: boolean
        }
        Returns: {
          audience_size: number
          availability: string
          avatar_url: string
          bio: string
          categories: string[]
          content_types: string[]
          display_name: string
          engagement_rate: number
          followers_count: number
          headline: string
          id: string
          is_demo: boolean
          languages: string[]
          location: string
          metrics_confirmed: boolean
          platforms: Json
          portfolio_count: number
          portfolio_url: string
          rate_max: number
          rate_min: number
          skills: string[]
          username: string
          verified: boolean
        }[]
      }
      seed_demo_content: { Args: never; Returns: Json }
      seed_demo_content_base: { Args: never; Returns: Json }
      send_collab: {
        Args: {
          _brief: string
          _creator: string
          _deadline: string
          _deliverables: string[]
          _links: string[]
          _max: number
          _message: string
          _min: number
          _plan: string
          _title: string
        }
        Returns: string
      }
      send_deadline_reminders: { Args: never; Returns: undefined }
      send_offer: { Args: { _order: string }; Returns: Json }
      set_feed_avatar: { Args: { _path: string }; Returns: undefined }
      settings: {
        Args: never
        Returns: {
          commission_pct: number
          fee_mode: string
          id: boolean
          image_cost_estimate: number
          payment_fee_pct: number
          text_cost_estimate: number
          updated_at: string
          video_cost_estimate: number
        }
        SetofOptions: {
          from: "*"
          to: "platform_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      simulate_payment: { Args: { _order: string }; Returns: undefined }
      start_campaign_conversation: {
        Args: { _campaign: string; _other: string }
        Returns: string
      }
      start_conversation: { Args: { _other: string }; Returns: string }
      trending_post_ids: {
        Args: { _category?: string; _limit?: number; _offset?: number }
        Returns: string[]
      }
      username_available: { Args: { _username: string }; Returns: boolean }
      v2_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["v2_app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      v2_notify: {
        Args: {
          _actor: string
          _body: string
          _key: string
          _link: string
          _type: string
          _user: string
        }
        Returns: undefined
      }
      verification_editable: { Args: { _uid: string }; Returns: boolean }
      verification_missing: { Args: { _uid: string }; Returns: string[] }
    }
    Enums: {
      account_type: "creator" | "brand"
      app_role: "creator" | "brand" | "admin"
      v2_app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: ["creator", "brand"],
      app_role: ["creator", "brand", "admin"],
      v2_app_role: ["admin", "moderator", "user"],
    },
  },
} as const
