export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          color: string
          created_at: string
          credit_limit: number | null
          currency: string
          due_day: number | null
          icon: string | null
          id: string
          is_active: boolean
          last_payment_amount: number | null
          last_payment_date: string | null
          loan_due_day: number | null
          loan_due_day_secondary: number | null
          loan_due_days: number[] | null
          loan_due_weekday: number | null
          loan_original_amount: number | null
          loan_pay_period: string | null
          name: string
          notes: string | null
          payment_reminder_days: number | null
          sort_order: number
          statement_balance: number | null
          statement_balance_locked_at: string | null
          statement_day: number | null
          statement_paid_amount: number | null
          type: string
          updated_at: string
          user_id: string
          utilization_target_pct: number | null
        }
        Insert: {
          balance?: number
          color?: string
          created_at?: string
          credit_limit?: number | null
          currency?: string
          due_day?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          last_payment_amount?: number | null
          last_payment_date?: string | null
          loan_due_day?: number | null
          loan_due_day_secondary?: number | null
          loan_due_days?: number[] | null
          loan_due_weekday?: number | null
          loan_original_amount?: number | null
          loan_pay_period?: string | null
          name: string
          notes?: string | null
          payment_reminder_days?: number | null
          sort_order?: number
          statement_balance?: number | null
          statement_balance_locked_at?: string | null
          statement_day?: number | null
          statement_paid_amount?: number | null
          type: string
          updated_at?: string
          user_id: string
          utilization_target_pct?: number | null
        }
        Update: {
          balance?: number
          color?: string
          created_at?: string
          credit_limit?: number | null
          currency?: string
          due_day?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          last_payment_amount?: number | null
          last_payment_date?: string | null
          loan_due_day?: number | null
          loan_due_day_secondary?: number | null
          loan_due_days?: number[] | null
          loan_due_weekday?: number | null
          loan_original_amount?: number | null
          loan_pay_period?: string | null
          name?: string
          notes?: string | null
          payment_reminder_days?: number | null
          sort_order?: number
          statement_balance?: number | null
          statement_balance_locked_at?: string | null
          statement_day?: number | null
          statement_paid_amount?: number | null
          type?: string
          updated_at?: string
          user_id?: string
          utilization_target_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          currency: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          period: string
          rollover_enabled: boolean
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          period: string
          rollover_enabled?: boolean
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          period?: string
          rollover_enabled?: boolean
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_reminders_sent: {
        Row: {
          reminder_key: string
          sent_on: string
          user_id: string
        }
        Insert: {
          reminder_key: string
          sent_on?: string
          user_id: string
        }
        Update: {
          reminder_key?: string
          sent_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_reminders_sent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          counts_as_salary: boolean
          created_at: string
          icon: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          counts_as_salary?: boolean
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          counts_as_salary?: boolean
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_payments: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          release: string
          route: string
          stack: string | null
          user_agent: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          release: string
          route: string
          stack?: string | null
          user_agent: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          release?: string
          route?: string
          stack?: string | null
          user_agent?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          as_of: string | null
          base: string
          fetched_at: string | null
          overrides: Json
          rates: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          as_of?: string | null
          base?: string
          fetched_at?: string | null
          overrides?: Json
          rates?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          as_of?: string | null
          base?: string
          fetched_at?: string | null
          overrides?: Json
          rates?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contribution_ops: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          op_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          goal_id: string
          op_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          op_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contribution_ops_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contribution_ops_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_purchase_id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          loan_purchase_id: string
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_purchase_id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payment_allocations_loan_purchase_id_fkey"
            columns: ["loan_purchase_id"]
            isOneToOne: false
            referencedRelation: "loan_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payment_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payment_allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_purchases: {
        Row: {
          account_id: string
          category_id: string | null
          created_at: string
          first_due_date: string
          id: string
          monthly_installment: number
          monthly_interest_rate: number
          name: string
          notes: string | null
          opening_installments_paid: number
          opening_paid_amount: number
          principal_amount: number
          term_months: number
          total_payable: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          category_id?: string | null
          created_at?: string
          first_due_date: string
          id?: string
          monthly_installment: number
          monthly_interest_rate?: number
          name: string
          notes?: string | null
          opening_installments_paid?: number
          opening_paid_amount?: number
          principal_amount: number
          term_months: number
          total_payable: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          category_id?: string | null
          created_at?: string
          first_due_date?: string
          id?: string
          monthly_installment?: number
          monthly_interest_rate?: number
          name?: string
          notes?: string | null
          opening_installments_paid?: number
          opening_paid_amount?: number
          principal_amount?: number
          term_months?: number
          total_payable?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_purchases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_purchases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_group_order: Json
          account_view_mode: string
          avatar_url: string | null
          budget_deficit_behaviour: string
          created_at: string
          dashboard_hidden_widgets: Json | null
          dashboard_widget_order: Json
          default_currency: string
          email: string
          exchange_rate_refresh: string
          full_name: string | null
          id: string
          month_start_day: number
          pay_cycle_confirmed_at: string | null
          preferences: Json
          setup_checklist_dismissed_at: string | null
          updated_at: string
        }
        Insert: {
          account_group_order?: Json
          account_view_mode?: string
          avatar_url?: string | null
          budget_deficit_behaviour?: string
          created_at?: string
          dashboard_hidden_widgets?: Json | null
          dashboard_widget_order?: Json
          default_currency?: string
          email: string
          exchange_rate_refresh?: string
          full_name?: string | null
          id: string
          month_start_day?: number
          pay_cycle_confirmed_at?: string | null
          preferences?: Json
          setup_checklist_dismissed_at?: string | null
          updated_at?: string
        }
        Update: {
          account_group_order?: Json
          account_view_mode?: string
          avatar_url?: string | null
          budget_deficit_behaviour?: string
          created_at?: string
          dashboard_hidden_widgets?: Json | null
          dashboard_widget_order?: Json
          default_currency?: string
          email?: string
          exchange_rate_refresh?: string
          full_name?: string | null
          id?: string
          month_start_day?: number
          pay_cycle_confirmed_at?: string | null
          preferences?: Json
          setup_checklist_dismissed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          filter: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          color: string
          created_at: string
          currency: string
          current_amount: number
          deadline: string | null
          icon: string
          id: string
          is_completed: boolean
          name: string
          notes: string | null
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          currency?: string
          current_amount?: number
          deadline?: string | null
          icon?: string
          id?: string
          is_completed?: boolean
          name: string
          notes?: string | null
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          currency?: string
          current_amount?: number
          deadline?: string | null
          icon?: string
          id?: string
          is_completed?: boolean
          name?: string
          notes?: string | null
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thirteenth_month_picks: {
        Row: {
          transaction_id: string
          user_id: string
          year: number
        }
        Insert: {
          transaction_id: string
          user_id: string
          year: number
        }
        Update: {
          transaction_id?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "thirteenth_month_picks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thirteenth_month_picks_user_id_year_fkey"
            columns: ["user_id", "year"]
            isOneToOne: false
            referencedRelation: "thirteenth_month_selections"
            referencedColumns: ["user_id", "year"]
          },
        ]
      }
      thirteenth_month_selections: {
        Row: {
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "thirteenth_month_selections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_rules: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          keyword: string
          priority: number
          type_hint: string | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          keyword: string
          priority?: number
          type_hint?: string | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          keyword?: string
          priority?: number
          type_hint?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_templates: {
        Row: {
          created_at: string
          fields: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fields: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          date: string
          description: string
          destination_amount: number | null
          exchange_rate: number
          goal_id: string | null
          id: string
          is_recurring: boolean
          notes: string | null
          original_amount: number | null
          original_currency: string | null
          receipt_url: string | null
          recurrence_end_date: string | null
          recurrence_interval: string | null
          recurrence_next_posted: boolean
          subcategory_id: string | null
          tags: string[]
          to_account_id: string | null
          transfer_fee: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description: string
          destination_amount?: number | null
          exchange_rate?: number
          goal_id?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          original_amount?: number | null
          original_currency?: string | null
          receipt_url?: string | null
          recurrence_end_date?: string | null
          recurrence_interval?: string | null
          recurrence_next_posted?: boolean
          subcategory_id?: string | null
          tags?: string[]
          to_account_id?: string | null
          transfer_fee?: number | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description?: string
          destination_amount?: number | null
          exchange_rate?: number
          goal_id?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          original_amount?: number | null
          original_currency?: string | null
          receipt_url?: string | null
          recurrence_end_date?: string | null
          recurrence_interval?: string | null
          recurrence_next_posted?: boolean
          subcategory_id?: string | null
          tags?: string[]
          to_account_id?: string | null
          transfer_fee?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
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
      add_goal_contribution: {
        Args: { p_amount: number; p_goal_id: string; p_op_id: string }
        Returns: number
      }
      add_unitemised_purchase: {
        Args: { p_account_id: string; p_purchase: Json }
        Returns: {
          account_id: string
          category_id: string | null
          created_at: string
          first_due_date: string
          id: string
          monthly_installment: number
          monthly_interest_rate: number
          name: string
          notes: string | null
          opening_installments_paid: number
          opening_paid_amount: number
          principal_amount: number
          term_months: number
          total_payable: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "loan_purchases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      card_statement_refresh_last: {
        Args: {
          p_card_id: string
          p_removed_amount: number
          p_removed_date: string
        }
        Returns: undefined
      }
      card_statement_shift: {
        Args: { p_card_id: string; p_delta: number }
        Returns: undefined
      }
      delete_user: { Args: never; Returns: undefined }
      loan_purchase_due_amount: {
        Args: { as_of_date: string; purchase_uuid: string }
        Returns: number
      }
      loan_purchase_paid_amount: {
        Args: { purchase_uuid: string }
        Returns: number
      }
      merge_category: {
        Args: { p_source: string; p_target: string }
        Returns: Json
      }
      merge_profile_preferences: {
        Args: { p_only_if_empty?: boolean; p_patch: Json }
        Returns: Json
      }
      post_recurring_transaction: {
        Args: { p_date: string; p_source: string }
        Returns: string
      }
      set_account_balance: {
        Args: {
          p_account_id: string
          p_balance: number
          p_date: string
          p_description: string
        }
        Returns: number
      }
      set_thirteenth_month_picks: {
        Args: { p_ids: string[]; p_only_if_absent?: boolean; p_year: number }
        Returns: boolean
      }
      split_transaction: {
        Args: { lines: Json; original_id: string }
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

