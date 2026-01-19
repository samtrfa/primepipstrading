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
      accounts: {
        Row: {
          account_size: number
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          created_at: string
          current_balance: number | null
          current_phase: number | null
          daily_drawdown_percent: number | null
          daily_start_balance: number | null
          daily_start_date: string | null
          drawdown_violated: boolean | null
          high_water_mark: number | null
          id: string
          max_drawdown_percent: number | null
          payment_address: string | null
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
          created_at?: string
          current_balance?: number | null
          current_phase?: number | null
          daily_drawdown_percent?: number | null
          daily_start_balance?: number | null
          daily_start_date?: string | null
          drawdown_violated?: boolean | null
          high_water_mark?: number | null
          id?: string
          max_drawdown_percent?: number | null
          payment_address?: string | null
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
          created_at?: string
          current_balance?: number | null
          current_phase?: number | null
          daily_drawdown_percent?: number | null
          daily_start_balance?: number | null
          daily_start_date?: string | null
          drawdown_violated?: boolean | null
          high_water_mark?: number | null
          id?: string
          max_drawdown_percent?: number | null
          payment_address?: string | null
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
      [_ in never]: never
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
