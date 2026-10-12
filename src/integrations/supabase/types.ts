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
      profiles: {
        Row: {
          account_status: string
          avatar_path: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          whatsapp: string
        }
        Insert: {
          account_status?: string
          avatar_path?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          whatsapp?: string
        }
        Update: {
          account_status?: string
          avatar_path?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      brand_badges: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          verified: boolean
        }[]
      }
      choose_signup_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify: {
        Args: { _body: string; _link: string; _title: string; _user: string }
        Returns: undefined
      }
      party_names: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          name: string
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
    }
    Enums: {
      app_role: "creator" | "brand" | "admin"
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
      app_role: ["creator", "brand", "admin"],
    },
  },
} as const
