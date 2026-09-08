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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      payment_orders: {
        Row: {
          id: string
          user_id: string | null
          account_id: string | null
          provider: string
          provider_reference: string
          amount: number
          currency: string
          status: string
          checkout_at: string
          verified_at: string | null
          webhook_at: string | null
          failure_reason: string | null
          refund_amount: number | null
          refunded_at: string | null
          refund_reference: string | null
          provider_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          account_id?: string | null
          provider: string
          provider_reference: string
          amount: number
          currency: string
          status?: string
          checkout_at?: string
          verified_at?: string | null
          webhook_at?: string | null
          failure_reason?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          refund_reference?: string | null
          provider_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          account_id?: string | null
          provider?: string
          provider_reference?: string
          amount?: number
          currency?: string
          status?: string
          checkout_at?: string
          verified_at?: string | null
          webhook_at?: string | null
          failure_reason?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          refund_reference?: string | null
          provider_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          user_id: string
          marketing_enabled: boolean
          updated_at: string
        }
        Insert: {
          user_id?: string
          marketing_enabled?: boolean
          updated_at?: string
        }
        Update: {
          user_id?: string
          marketing_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          read: boolean
          metadata: Json
          event_key: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          read?: boolean
          metadata?: Json
          event_key: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          read?: boolean
          metadata?: Json
          event_key?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_applications: {
        Row: {
          desired_code: string
          id: string
          user_id: string
          phone: string
          country: string
          website: string | null
          instagram: string | null
          tiktok: string | null
          youtube: string | null
          x_handle: string | null
          audience_size: string
          promotion_channels: string
          affiliate_experience: string | null
          promotion_plan: string
          status: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          desired_code: string
          id?: string
          user_id: string
          phone: string
          country: string
          website?: string | null
          instagram?: string | null
          tiktok?: string | null
          youtube?: string | null
          x_handle?: string | null
          audience_size: string
          promotion_channels: string
          affiliate_experience?: string | null
          promotion_plan: string
          status?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          desired_code?: string
          id?: string
          user_id?: string
          phone?: string
          country?: string
          website?: string | null
          instagram?: string | null
          tiktok?: string | null
          youtube?: string | null
          x_handle?: string | null
          audience_size?: string
          promotion_channels?: string
          affiliate_experience?: string | null
          promotion_plan?: string
          status?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_codes: {
        Row: {
          id: string
          user_id: string
          code: string
          discount_percent: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          code: string
          discount_percent?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code?: string
          discount_percent?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          id: string
          referrer_id: string
          referred_user_id: string
          status: string
          commission_earned: number
          referred_at: string
          account_purchased: boolean
        }
        Insert: {
          id?: string
          referrer_id: string
          referred_user_id: string
          status?: string
          commission_earned?: number
          referred_at?: string
          account_purchased?: boolean
        }
        Update: {
          id?: string
          referrer_id?: string
          referred_user_id?: string
          status?: string
          commission_earned?: number
          referred_at?: string
          account_purchased?: boolean
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_size: number
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          best_trading_day_profit: number | null
          closed_profit_total: number | null
          consistency_score: number | null
          coupon_code: string | null
          created_at: string
          current_balance: number | null
          current_phase: number | null
          funded_started_at: string | null
          funded_profit_loss: number
          daily_drawdown_percent: number | null
          daily_start_balance: number | null
          daily_start_date: string | null
          discount_percent: number
          drawdown_violated: boolean | null
          high_water_mark: number | null
          id: string
          max_drawdown_percent: number | null
          payment_address: string | null
          payment_amount_local: number | null
          payment_currency: string | null
          payment_provider: string | null
          payment_reference: string | null
          payment_tx_hash: string | null
          phase_passed: boolean | null
          price: number
          profit_loss: number | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          user_id: string
          violation_type: string | null
        }
        Insert: {
          account_size: number
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          best_trading_day_profit?: number | null
          closed_profit_total?: number | null
          consistency_score?: number | null
          coupon_code?: string | null
          created_at?: string
          current_balance?: number | null
          current_phase?: number | null
          funded_started_at?: string | null
          funded_profit_loss?: number
          daily_drawdown_percent?: number | null
          daily_start_balance?: number | null
          daily_start_date?: string | null
          discount_percent?: number
          drawdown_violated?: boolean | null
          high_water_mark?: number | null
          id?: string
          max_drawdown_percent?: number | null
          payment_address?: string | null
          payment_amount_local?: number | null
          payment_currency?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_tx_hash?: string | null
          phase_passed?: boolean | null
          price: number
          profit_loss?: number | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id: string
          violation_type?: string | null
        }
        Update: {
          account_size?: number
          challenge_type?: Database["public"]["Enums"]["challenge_type"]
          best_trading_day_profit?: number | null
          closed_profit_total?: number | null
          consistency_score?: number | null
          coupon_code?: string | null
          created_at?: string
          current_balance?: number | null
          current_phase?: number | null
          funded_started_at?: string | null
          funded_profit_loss?: number
          daily_drawdown_percent?: number | null
          daily_start_balance?: number | null
          daily_start_date?: string | null
          discount_percent?: number
          drawdown_violated?: boolean | null
          high_water_mark?: number | null
          id?: string
          max_drawdown_percent?: number | null
          payment_address?: string | null
          payment_amount_local?: number | null
          payment_currency?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_tx_hash?: string | null
          phase_passed?: boolean | null
          price?: number
          profit_loss?: number | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id?: string
          violation_type?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          id: string
          user_id: string
          account_id: string | null
          challenge_type: Database["public"]["Enums"]["challenge_type"] | null
          account_size: number | null
          phase_number: number | null
          phase_name: string | null
          payout_id: string | null
          payout_amount: number | null
          payout_method: string | null
          recipient_name: string | null
          awarded_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id?: string | null
          challenge_type?: Database["public"]["Enums"]["challenge_type"] | null
          account_size?: number | null
          phase_number?: number | null
          phase_name?: string | null
          payout_id?: string | null
          payout_amount?: number | null
          payout_method?: string | null
          recipient_name?: string | null
          awarded_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string | null
          challenge_type?: Database["public"]["Enums"]["challenge_type"] | null
          account_size?: number | null
          phase_number?: number | null
          phase_name?: string | null
          payout_id?: string | null
          payout_amount?: number | null
          payout_method?: string | null
          recipient_name?: string | null
          awarded_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_type: string
          base_currency: string | null
          created_at: string
          id: string
          is_active: boolean | null
          lot_size: number | null
          name: string
          pip_value: number | null
          quote_currency: string | null
          symbol: string
        }
        Insert: {
          asset_type?: string
          base_currency?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          lot_size?: number | null
          name: string
          pip_value?: number | null
          quote_currency?: string | null
          symbol: string
        }
        Update: {
          asset_type?: string
          base_currency?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          lot_size?: number | null
          name?: string
          pip_value?: number | null
          quote_currency?: string | null
          symbol?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          challenge_types:
            | Database["public"]["Enums"]["challenge_type"][]
            | null
          code: string
          created_at: string
          discount_percent: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          times_used: number
          updated_at: string
        }
        Insert: {
          challenge_types?:
            | Database["public"]["Enums"]["challenge_type"][]
            | null
          code: string
          created_at?: string
          discount_percent: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          times_used?: number
          updated_at?: string
        }
        Update: {
          challenge_types?:
            | Database["public"]["Enums"]["challenge_type"][]
            | null
          code?: string
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          times_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          account_id: string
          asset_id: string
          closed_at: string | null
          created_at: string
          entry_price: number
          exit_price: number | null
          id: string
          lot_size: number
          opened_at: string
          position_type: string
          profit_loss: number | null
          status: string
          stop_loss: number | null
          take_profit: number | null
        }
        Insert: {
          account_id: string
          asset_id: string
          closed_at?: string | null
          created_at?: string
          entry_price: number
          exit_price?: number | null
          id?: string
          lot_size?: number
          opened_at?: string
          position_type: string
          profit_loss?: number | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
        }
        Update: {
          account_id?: string
          asset_id?: string
          closed_at?: string | null
          created_at?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          lot_size?: number
          opened_at?: string
          position_type?: string
          profit_loss?: number | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          address_document_path: string | null
          address_document_type: string | null
          address_submitted_at: string | null
          created_at: string
          id: string
          identity_document_path: string | null
          identity_document_type: string | null
          identity_submitted_at: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_document_path?: string | null
          address_document_type?: string | null
          address_submitted_at?: string | null
          created_at?: string
          id?: string
          identity_document_path?: string | null
          identity_document_type?: string | null
          identity_submitted_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_document_path?: string | null
          address_document_type?: string | null
          address_submitted_at?: string | null
          created_at?: string
          id?: string
          identity_document_path?: string | null
          identity_document_type?: string | null
          identity_submitted_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount: number
          account_id: string | null
          created_at: string
          destination: string
          certificate_account_size: number | null
          certificate_challenge_type: Database["public"]["Enums"]["challenge_type"] | null
          payout_date: string | null
          id: string
          method: string
          rejection_reason: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          account_id?: string | null
          created_at?: string
          destination: string
          certificate_account_size?: number | null
          certificate_challenge_type?: Database["public"]["Enums"]["challenge_type"] | null
          payout_date?: string | null
          id?: string
          method: string
          rejection_reason?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          account_id?: string
          created_at?: string
          destination?: string
          certificate_account_size?: number | null
          certificate_challenge_type?: Database["public"]["Enums"]["challenge_type"] | null
          payout_date?: string | null
          id?: string
          method?: string
          rejection_reason?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          id: string
          user_id: string
          method_type: string
          network: string
          wallet_address: string
          label: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          method_type?: string
          network: string
          wallet_address: string
          label?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          method_type?: string
          network?: string
          wallet_address?: string
          label?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_balances: {
        Row: {
          user_id: string
          available: number
          reserved: number
          paid: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          available?: number
          reserved?: number
          paid?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          available?: number
          reserved?: number
          paid?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          account_id: string
          action: string
          created_at: string
          id: string
          lot_size: number
          notes: string | null
          position_id: string | null
          price: number
          profit_loss: number | null
          symbol: string
          request_id: string | null
        }
        Insert: {
          account_id: string
          action: string
          created_at?: string
          id?: string
          lot_size: number
          notes?: string | null
          position_id?: string | null
          price: number
          profit_loss?: number | null
          symbol: string
          request_id?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          created_at?: string
          id?: string
          lot_size?: number
          notes?: string | null
          position_id?: string | null
          price?: number
          profit_loss?: number | null
          symbol?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_history_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      submit_affiliate_application: {
        Args: {
          p_phone: string
          p_country: string
          p_website: string
          p_instagram: string
          p_tiktok: string
          p_youtube: string
          p_x_handle: string
          p_audience_size: string
          p_promotion_channels: string
          p_affiliate_experience: string
          p_promotion_plan: string
          p_desired_code: string
        }
        Returns: Database["public"]["Tables"]["affiliate_applications"]["Row"]
      }
      reconcile_paystack_payment: {
        Args: {
          p_reference: string
          p_status: string
          p_amount?: number | null
          p_currency?: string | null
          p_provider_user_id?: string | null
          p_metadata?: Json
          p_source?: string
          p_refund_amount?: number | null
          p_refund_reference?: string | null
        }
        Returns: Json
      }
      place_trade: {
        Args: {
          p_account_id: string
          p_asset_id: string
          p_position_type: string
          p_lot_size: number
          p_entry_price: number
          p_stop_loss?: number | null
          p_take_profit?: number | null
          p_request_id?: string
        }
        Returns: Json
      }
      close_trade: {
        Args: {
          p_account_id: string
          p_position_id: string
          p_exit_price: number
          p_action?: string
          p_request_id?: string
        }
        Returns: Json
      }
      modify_trade: {
        Args: {
          p_account_id: string
          p_position_id: string
          p_stop_loss: number | null
          p_take_profit: number | null
          p_request_id?: string
        }
        Returns: Json
      }
      modify_trades_by_asset: {
        Args: {
          p_account_id: string
          p_position_id: string
          p_stop_loss: number | null
          p_take_profit: number | null
          p_request_id?: string
        }
        Returns: Json
      }
      advance_trade_phase: {
        Args: {
          p_account_id: string
          p_request_id?: string
        }
        Returns: Json
      }
      create_commission_payout: {
        Args: {
          payout_amount: number
          payout_destination: string
        }
        Returns: Database["public"]["Tables"]["payout_requests"]["Row"]
      }
      submit_kyc: {
        Args: {
          p_identity_document_type: string
          p_identity_document_path: string
          p_address_document_type: string
          p_address_document_path: string
        }
        Returns: Database["public"]["Tables"]["kyc_verifications"]["Row"]
      }
      review_kyc: {
        Args: {
          p_kyc_id: string
          p_status: string
          p_rejection_reason?: string | null
        }
        Returns: Database["public"]["Tables"]["kyc_verifications"]["Row"]
      }
    }
    Enums: {
      account_status:
        | "pending_payment"
        | "active"
        | "failed"
        | "passed"
        | "funded"
      challenge_type: "three_step" | "two_step" | "one_step" | "instant"
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
      account_status: [
        "pending_payment",
        "active",
        "failed",
        "passed",
        "funded",
      ],
      challenge_type: ["three_step", "two_step", "one_step", "instant"],
    },
  },
} as const
