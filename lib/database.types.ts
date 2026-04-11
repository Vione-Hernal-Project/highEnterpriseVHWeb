export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          role: "user" | "admin" | "owner" | string;
          wallet_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          role?: "user" | "admin" | "owner" | string;
          wallet_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          role?: "user" | "admin" | "owner" | string;
          wallet_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string | null;
          user_id: string | null;
          email: string | null;
          product_id: string | null;
          product_name: string | null;
          quantity: number;
          unit_price: string;
          customer_name: string;
          phone: string;
          shipping_address: string;
          amount: string;
          currency: string;
          status: string;
          notes: string | null;
          confirmation_email_status: string;
          confirmation_email_sent_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string | null;
          user_id?: string | null;
          email?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          quantity?: number;
          unit_price?: string;
          customer_name?: string;
          phone?: string;
          shipping_address?: string;
          amount: string;
          currency?: string;
          status?: string;
          notes?: string | null;
          confirmation_email_status?: string;
          confirmation_email_sent_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string | null;
          user_id?: string | null;
          email?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          quantity?: number;
          unit_price?: string;
          customer_name?: string;
          phone?: string;
          shipping_address?: string;
          amount?: string;
          currency?: string;
          status?: string;
          notes?: string | null;
          confirmation_email_status?: string;
          confirmation_email_sent_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fund_allocation_rules: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          color: string;
          percentage_basis_points: number;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          color?: string;
          percentage_basis_points: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          color?: string;
          percentage_basis_points?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_allocations: {
        Row: {
          id: string;
          payment_id: string;
          allocation_rule_id: string | null;
          allocation_code: string;
          allocation_name: string;
          allocation_description: string | null;
          allocation_color: string;
          percentage_basis_points: number;
          base_amount: string;
          currency: string;
          allocated_amount: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          allocation_rule_id?: string | null;
          allocation_code: string;
          allocation_name: string;
          allocation_description?: string | null;
          allocation_color?: string;
          percentage_basis_points: number;
          base_amount?: string;
          currency: string;
          allocated_amount?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          allocation_rule_id?: string | null;
          allocation_code?: string;
          allocation_name?: string;
          allocation_description?: string | null;
          allocation_color?: string;
          percentage_basis_points?: number;
          base_amount?: string;
          currency?: string;
          allocated_amount?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string | null;
          user_id: string | null;
          payment_method: string;
          tx_hash: string | null;
          wallet_address: string | null;
          recipient_address: string | null;
          chain_id: number | null;
          amount_expected: string;
          amount_expected_fiat: string | null;
          fiat_currency: string | null;
          conversion_rate: string | null;
          quote_source: string | null;
          quote_updated_at: string | null;
          amount_received: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          user_id?: string | null;
          payment_method?: string;
          tx_hash?: string | null;
          wallet_address?: string | null;
          recipient_address?: string | null;
          chain_id?: number | null;
          amount_expected: string;
          amount_expected_fiat?: string | null;
          fiat_currency?: string | null;
          conversion_rate?: string | null;
          quote_source?: string | null;
          quote_updated_at?: string | null;
          amount_received?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          user_id?: string | null;
          payment_method?: string;
          tx_hash?: string | null;
          wallet_address?: string | null;
          recipient_address?: string | null;
          chain_id?: number | null;
          amount_expected?: string;
          amount_expected_fiat?: string | null;
          fiat_currency?: string | null;
          conversion_rate?: string | null;
          quote_source?: string | null;
          quote_updated_at?: string | null;
          amount_received?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
