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
      admin_cash_outs: {
        Row: {
          id: string;
          request_id: string;
          created_by: string;
          payment_method: string;
          chain_id: number;
          source_mode: string;
          source_allocation_code: string | null;
          source_allocation_name: string | null;
          amount: string;
          amount_input_mode: string;
          amount_php_equivalent: string | null;
          quote_php_per_eth: string | null;
          quote_source: string | null;
          quote_updated_at: string | null;
          sender_wallet_address: string;
          destination_wallet_address: string;
          tx_hash: string;
          available_before: string;
          available_after: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          created_by: string;
          payment_method: string;
          chain_id?: number;
          source_mode?: string;
          source_allocation_code?: string | null;
          source_allocation_name?: string | null;
          amount: string;
          amount_input_mode?: string;
          amount_php_equivalent?: string | null;
          quote_php_per_eth?: string | null;
          quote_source?: string | null;
          quote_updated_at?: string | null;
          sender_wallet_address: string;
          destination_wallet_address: string;
          tx_hash: string;
          available_before?: string;
          available_after?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          created_by?: string;
          payment_method?: string;
          chain_id?: number;
          source_mode?: string;
          source_allocation_code?: string | null;
          source_allocation_name?: string | null;
          amount?: string;
          amount_input_mode?: string;
          amount_php_equivalent?: string | null;
          quote_php_per_eth?: string | null;
          quote_source?: string | null;
          quote_updated_at?: string | null;
          sender_wallet_address?: string;
          destination_wallet_address?: string;
          tx_hash?: string;
          available_before?: string;
          available_after?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_cash_out_breakdowns: {
        Row: {
          id: string;
          cash_out_id: string;
          allocation_rule_id: string | null;
          allocation_code: string;
          allocation_name: string;
          allocation_color: string;
          amount: string;
          available_before: string;
          available_after: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cash_out_id: string;
          allocation_rule_id?: string | null;
          allocation_code: string;
          allocation_name: string;
          allocation_color?: string;
          amount?: string;
          available_before?: string;
          available_after?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cash_out_id?: string;
          allocation_rule_id?: string | null;
          allocation_code?: string;
          allocation_name?: string;
          allocation_color?: string;
          amount?: string;
          available_before?: string;
          available_after?: string;
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
    Functions: {
      rebuild_payment_allocations: {
        Args: {
          target_payment_id: string;
        };
        Returns: undefined;
      };
      record_admin_cash_out_transfer: {
        Args: {
          p_amount: string;
          p_payment_method: string;
          p_request_id: string;
          p_created_by: string;
          p_chain_id: number;
          p_source_mode: string;
          p_source_allocation_code?: string | null;
          p_amount_input_mode?: string;
          p_amount_php_equivalent?: string | null;
          p_quote_php_per_eth?: string | null;
          p_quote_source?: string | null;
          p_quote_updated_at?: string | null;
          p_sender_wallet_address: string;
          p_destination_wallet_address: string;
          p_tx_hash: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
