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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_campaigns: {
        Row: {
          advertiser: string
          body: string
          created_at: string
          created_by: string | null
          cta_label: string
          cta_type: string
          cta_url: string
          description: string
          end_at: string | null
          header: string
          id: string
          media_path: string | null
          media_url: string | null
          placements: string[]
          start_at: string | null
          status: string
          tier: string
          title: string
          updated_at: string
        }
        Insert: {
          advertiser: string
          body?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_type?: string
          cta_url?: string
          description?: string
          end_at?: string | null
          header?: string
          id?: string
          media_path?: string | null
          media_url?: string | null
          placements?: string[]
          start_at?: string | null
          status?: string
          tier: string
          title: string
          updated_at?: string
        }
        Update: {
          advertiser?: string
          body?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_type?: string
          cta_url?: string
          description?: string
          end_at?: string | null
          header?: string
          id?: string
          media_path?: string | null
          media_url?: string | null
          placements?: string[]
          start_at?: string | null
          status?: string
          tier?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          audience: string
          body: string
          channels: string[]
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body: string
          channels?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string
          channels?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          target_id: string | null
          target_kind: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_kind?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_kind?: string | null
        }
        Relationships: []
      }
      bounties: {
        Row: {
          applicant_limit: number
          category: string
          cover_path: string | null
          created_at: string
          deadline_at: string | null
          description: string
          end_at: string | null
          id: string
          poster_id: string
          price_usd: number
          start_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          applicant_limit?: number
          category?: string
          cover_path?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string
          end_at?: string | null
          id?: string
          poster_id: string
          price_usd: number
          start_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          applicant_limit?: number
          category?: string
          cover_path?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string
          end_at?: string | null
          id?: string
          poster_id?: string
          price_usd?: number
          start_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      circle_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["circle_status"]
          target_slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["circle_status"]
          target_slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["circle_status"]
          target_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_pct: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_pct: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_pct?: number
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          amount_paid_usd: number
          cashback_usd: number | null
          completed_at: string | null
          coupon_code: string | null
          course_id: string
          created_at: string
          discount_usd: number | null
          display_currency: string | null
          display_total: number | null
          id: string
          paid_at: string | null
          payment_method: string | null
          user_id: string
        }
        Insert: {
          amount_paid_usd?: number
          cashback_usd?: number | null
          completed_at?: string | null
          coupon_code?: string | null
          course_id: string
          created_at?: string
          discount_usd?: number | null
          display_currency?: string | null
          display_total?: number | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          user_id: string
        }
        Update: {
          amount_paid_usd?: number
          cashback_usd?: number | null
          completed_at?: string | null
          coupon_code?: string | null
          course_id?: string
          created_at?: string
          discount_usd?: number | null
          display_currency?: string | null
          display_total?: number | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string
          duration_min: number
          id: string
          is_preview: boolean
          position: number
          title: string
          updated_at: string
          video_provider: string
          video_url: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          is_preview?: boolean
          position?: number
          title: string
          updated_at?: string
          video_provider?: string
          video_url: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          is_preview?: boolean
          position?: number
          title?: string
          updated_at?: string
          video_provider?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed_at: string
          course_id: string
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          course_id: string
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          course_id?: string
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          cover_path: string | null
          created_at: string
          description: string
          id: string
          instructor_name: string | null
          is_free: boolean
          is_published: boolean
          level: string
          owner_id: string
          price_usd: number
          promoted: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          cover_path?: string | null
          created_at?: string
          description?: string
          id?: string
          instructor_name?: string | null
          is_free?: boolean
          is_published?: boolean
          level?: string
          owner_id: string
          price_usd?: number
          promoted?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          cover_path?: string | null
          created_at?: string
          description?: string
          id?: string
          instructor_name?: string | null
          is_free?: boolean
          is_published?: boolean
          level?: string
          owner_id?: string
          price_usd?: number
          promoted?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          scope: string
          target_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          scope?: string
          target_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          scope?: string
          target_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      marketplace_categories: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          from_user_id: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string
          display_currency: Database["public"]["Enums"]["wallet_currency"]
          display_total: number
          download_token: string
          fx_rate: number
          id: string
          paid_at: string | null
          payment_method: string
          product_id: string
          quantity: number
          seller_id: string
          status: string
          total_usd: number
          unit_price_usd: number
        }
        Insert: {
          buyer_id: string
          created_at?: string
          display_currency?: Database["public"]["Enums"]["wallet_currency"]
          display_total: number
          download_token?: string
          fx_rate?: number
          id?: string
          paid_at?: string | null
          payment_method: string
          product_id: string
          quantity?: number
          seller_id: string
          status?: string
          total_usd: number
          unit_price_usd: number
        }
        Update: {
          buyer_id?: string
          created_at?: string
          display_currency?: Database["public"]["Enums"]["wallet_currency"]
          display_total?: number
          download_token?: string
          fx_rate?: number
          id?: string
          paid_at?: string | null
          payment_method?: string
          product_id?: string
          quantity?: number
          seller_id?: string
          status?: string
          total_usd?: number
          unit_price_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          base_currency: string
          fx_rates: Json
          fx_updated_at: string | null
          id: number
          live_fx_enabled: boolean
          meta: Json
          updated_at: string
        }
        Insert: {
          base_currency?: string
          fx_rates?: Json
          fx_updated_at?: string | null
          id?: number
          live_fx_enabled?: boolean
          meta?: Json
          updated_at?: string
        }
        Update: {
          base_currency?: string
          fx_rates?: Json
          fx_updated_at?: string | null
          id?: number
          live_fx_enabled?: boolean
          meta?: Json
          updated_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_id: string
          author_name: string
          created_at: string
          id: string
          initials: string
          post_id: string
          text: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name: string
          created_at?: string
          id?: string
          initials: string
          post_id: string
          text: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          created_at?: string
          id?: string
          initials?: string
          post_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
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
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_kind?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_kind?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          created_at: string
          id: string
          media_path: string | null
          media_type: string | null
          text: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          media_path?: string | null
          media_type?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          media_path?: string | null
          media_type?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          cover_path: string | null
          created_at: string
          description: string
          external_url: string | null
          file_path: string | null
          hue: string
          id: string
          name: string
          price_usd: number
          promoted: boolean
          rating: number
          reviews: number
          seller_id: string
          updated_at: string
          vendor: string
        }
        Insert: {
          category: string
          cover_path?: string | null
          created_at?: string
          description?: string
          external_url?: string | null
          file_path?: string | null
          hue?: string
          id?: string
          name: string
          price_usd: number
          promoted?: boolean
          rating?: number
          reviews?: number
          seller_id: string
          updated_at?: string
          vendor?: string
        }
        Update: {
          category?: string
          cover_path?: string | null
          created_at?: string
          description?: string
          external_url?: string | null
          file_path?: string | null
          hue?: string
          id?: string
          name?: string
          price_usd?: number
          promoted?: boolean
          rating?: number
          reviews?: number
          seller_id?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          country: string | null
          created_at: string
          display_name: string | null
          kyc_completed_at: string | null
          kyc_id_path: string | null
          kyc_selfie_path: string | null
          phone: string | null
          profile_completed_at: string | null
          reputation_stars: number
          slug: string
          updated_at: string
          user_id: string
          username: string | null
          verification_tier: string
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          kyc_completed_at?: string | null
          kyc_id_path?: string | null
          kyc_selfie_path?: string | null
          phone?: string | null
          profile_completed_at?: string | null
          reputation_stars?: number
          slug: string
          updated_at?: string
          user_id: string
          username?: string | null
          verification_tier?: string
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          kyc_completed_at?: string | null
          kyc_id_path?: string | null
          kyc_selfie_path?: string | null
          phone?: string | null
          profile_completed_at?: string | null
          reputation_stars?: number
          slug?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          verification_tier?: string
        }
        Relationships: []
      }
      system_wallet_transactions: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          kind: string
          meta: Json
          ref_id: string | null
          source: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          ref_id?: string | null
          source: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          ref_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_wallet_transactions_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "system_wallets"
            referencedColumns: ["kind"]
          },
        ]
      }
      system_wallets: {
        Row: {
          balance_usd: number
          kind: string
          updated_at: string
        }
        Insert: {
          balance_usd?: number
          kind: string
          updated_at?: string
        }
        Update: {
          balance_usd?: number
          kind?: string
          updated_at?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["wallet_currency"]
          id: string
          inflow: boolean
          occurred_at: string
          status: Database["public"]["Enums"]["wallet_tx_status"]
          tx_hash: string
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["wallet_currency"]
          id?: string
          inflow: boolean
          occurred_at?: string
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          tx_hash: string
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["wallet_currency"]
          id?: string
          inflow?: boolean
          occurred_at?: string
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          tx_hash?: string
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          accumulated_cashback: number
          available_balance: number
          created_at: string
          currency: string
          escrow_balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accumulated_cashback?: number
          available_balance?: number
          created_at?: string
          currency: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accumulated_cashback?: number
          available_balance?: number
          created_at?: string
          currency?: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_slug: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      system_wallet_credit: {
        Args: {
          _amount: number
          _kind: string
          _meta?: Json
          _ref?: string
          _source: string
        }
        Returns: undefined
      }
      wallet_credit: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      wallet_debit: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      circle_status: "pending" | "accepted"
      report_reason: "spam" | "harassment" | "ip" | "scam"
      report_status: "pending" | "approved" | "hidden"
      wallet_currency: "USD" | "NGN" | "GHS"
      wallet_tx_status: "success" | "pending" | "failed"
      wallet_tx_type:
        | "Marketplace Purchase"
        | "Gig Bounty Escrowed"
        | "Ad Injection Charge"
        | "Affiliate Cashback Payout"
        | "Wallet Top-Up"
        | "Payout Withdrawal"
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
      app_role: ["admin", "moderator", "user"],
      circle_status: ["pending", "accepted"],
      report_reason: ["spam", "harassment", "ip", "scam"],
      report_status: ["pending", "approved", "hidden"],
      wallet_currency: ["USD", "NGN", "GHS"],
      wallet_tx_status: ["success", "pending", "failed"],
      wallet_tx_type: [
        "Marketplace Purchase",
        "Gig Bounty Escrowed",
        "Ad Injection Charge",
        "Affiliate Cashback Payout",
        "Wallet Top-Up",
        "Payout Withdrawal",
      ],
    },
  },
} as const
