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
      accounts: {
        Row: {
          cashflow_class: string | null
          category: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_postable: boolean
          level: number
          metadata: Json
          name: string
          name_en: string | null
          notes: string | null
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          updated_by: string | null
          vat_applicable: boolean
        }
        Insert: {
          cashflow_class?: string | null
          category?: string | null
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_postable?: boolean
          level?: number
          metadata?: Json
          name: string
          name_en?: string | null
          notes?: string | null
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          updated_by?: string | null
          vat_applicable?: boolean
        }
        Update: {
          cashflow_class?: string | null
          category?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_postable?: boolean
          level?: number
          metadata?: Json
          name?: string
          name_en?: string | null
          notes?: string | null
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          updated_by?: string | null
          vat_applicable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          client_info: Json | null
          company_id: string | null
          id: number
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          client_info?: Json | null
          company_id?: string | null
          id?: number
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          client_info?: Json | null
          company_id?: string | null
          id?: number
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string
          bank_code: string | null
          bank_name: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          gl_account_id: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          notes: string | null
          opening_balance: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_number: string
          bank_code?: string | null
          bank_name: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          gl_account_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_number?: string
          bank_code?: string | null
          bank_name?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          gl_account_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      cash_category_rules: {
        Row: {
          category: string
          company_id: string
          contra_account_id: string
          created_at: string
          direction: Database["public"]["Enums"]["cash_direction"]
          id: string
          is_active: boolean
          pattern: string | null
          priority: number
        }
        Insert: {
          category: string
          company_id: string
          contra_account_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["cash_direction"]
          id?: string
          is_active?: boolean
          pattern?: string | null
          priority?: number
        }
        Update: {
          category?: string
          company_id?: string
          contra_account_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["cash_direction"]
          id?: string
          is_active?: boolean
          pattern?: string | null
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_category_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_category_rules_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_category_rules_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "cash_category_rules_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "cash_category_rules_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "cash_category_rules_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          category: string | null
          company_id: string
          contra_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          direction: Database["public"]["Enums"]["cash_direction"]
          exchange_rate: number
          id: string
          is_reconciled: boolean
          journal_id: string | null
          metadata: Json
          notes: string | null
          partner_acc: string | null
          partner_id: string | null
          partner_name: string | null
          raw_data: Json | null
          reference: string | null
          source_row_num: number | null
          txn_date: string
          txn_timestamp: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          bank_account_id: string
          category?: string | null
          company_id: string
          contra_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["cash_direction"]
          exchange_rate?: number
          id?: string
          is_reconciled?: boolean
          journal_id?: string | null
          metadata?: Json
          notes?: string | null
          partner_acc?: string | null
          partner_id?: string | null
          partner_name?: string | null
          raw_data?: Json | null
          reference?: string | null
          source_row_num?: number | null
          txn_date: string
          txn_timestamp?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string
          category?: string | null
          company_id?: string
          contra_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["cash_direction"]
          exchange_rate?: number
          id?: string
          is_reconciled?: boolean
          journal_id?: string | null
          metadata?: Json
          notes?: string | null
          partner_acc?: string | null
          partner_id?: string | null
          partner_name?: string | null
          raw_data?: Json | null
          reference?: string | null
          source_row_num?: number | null
          txn_date?: string
          txn_timestamp?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "cash_transactions_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "cash_transactions_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "cash_transactions_contra_account_id_fkey"
            columns: ["contra_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "cash_transactions_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
          {
            foreignKeyName: "cash_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          base_currency: string
          created_at: string
          deleted_at: string | null
          email: string | null
          fiscal_year_start_month: number
          id: string
          is_active: boolean
          legal_name: string | null
          metadata: Json
          name: string
          phone: string | null
          register: string | null
          tin: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          base_currency?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          is_active?: boolean
          legal_name?: string | null
          metadata?: Json
          name: string
          phone?: string | null
          register?: string | null
          tin?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          base_currency?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          is_active?: boolean
          legal_name?: string | null
          metadata?: Json
          name?: string
          phone?: string | null
          register?: string | null
          tin?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      depreciation_schedule: {
        Row: {
          accumulated_after: number
          accumulated_before: number
          asset_id: string
          company_id: string
          created_at: string
          depreciation_amount: number
          id: string
          journal_id: string | null
          month: number
          net_book_value_after: number
          notes: string | null
          period_id: string
          posted_at: string | null
          posted_by: string | null
          year: number
        }
        Insert: {
          accumulated_after: number
          accumulated_before: number
          asset_id: string
          company_id: string
          created_at?: string
          depreciation_amount: number
          id?: string
          journal_id?: string | null
          month: number
          net_book_value_after: number
          notes?: string | null
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          year: number
        }
        Update: {
          accumulated_after?: number
          accumulated_before?: number
          asset_id?: string
          company_id?: string
          created_at?: string
          depreciation_amount?: number
          id?: string
          journal_id?: string | null
          month?: number
          net_book_value_after?: number
          notes?: string | null
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_schedule_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "v_fixed_asset_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_schedule_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
          {
            foreignKeyName: "depreciation_schedule_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          advance_base: number
          bank_account: string | null
          bank_name: string | null
          base_salary: number
          color: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department: string | null
          email: string | null
          employee_code: string | null
          experience_years: number
          first_name: string
          full_name: string | null
          hire_date: string | null
          id: string
          is_active: boolean
          last_name: string | null
          metadata: Json
          notes: string | null
          partner_id: string | null
          phone: string | null
          phone_allowance: number
          termination_date: string | null
          tin: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          advance_base?: number
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          color?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          experience_years?: number
          first_name: string
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          metadata?: Json
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          phone_allowance?: number
          termination_date?: string | null
          tin?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          advance_base?: number
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          experience_years?: number
          first_name?: string
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          metadata?: Json
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          phone_allowance?: number
          termination_date?: string | null
          tin?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          asset_account_id: string
          category: string | null
          code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          depreciation_account_id: string | null
          depreciation_method: Database["public"]["Enums"]["depreciation_method"]
          disposal_amount: number | null
          disposal_journal_id: string | null
          disposed_at: string | null
          expense_account_id: string | null
          id: string
          location: string | null
          metadata: Json
          monthly_depreciation: number | null
          name: string
          net_book_value: number | null
          notes: string | null
          purchase_amount: number
          purchase_date: string
          responsible_person: string | null
          salvage_value: number
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          supplier_id: string | null
          supplier_invoice: string | null
          updated_at: string
          updated_by: string | null
          useful_life_months: number
        }
        Insert: {
          accumulated_depreciation?: number
          asset_account_id: string
          category?: string | null
          code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          depreciation_account_id?: string | null
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          disposal_amount?: number | null
          disposal_journal_id?: string | null
          disposed_at?: string | null
          expense_account_id?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          monthly_depreciation?: number | null
          name: string
          net_book_value?: number | null
          notes?: string | null
          purchase_amount: number
          purchase_date: string
          responsible_person?: string | null
          salvage_value?: number
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          supplier_invoice?: string | null
          updated_at?: string
          updated_by?: string | null
          useful_life_months: number
        }
        Update: {
          accumulated_depreciation?: number
          asset_account_id?: string
          category?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          depreciation_account_id?: string | null
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          disposal_amount?: number | null
          disposal_journal_id?: string | null
          disposed_at?: string | null
          expense_account_id?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          monthly_depreciation?: number | null
          name?: string
          net_book_value?: number | null
          notes?: string | null
          purchase_amount?: number
          purchase_date?: string
          responsible_person?: string | null
          salvage_value?: number
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          supplier_invoice?: string | null
          updated_at?: string
          updated_by?: string | null
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_account_id_fkey"
            columns: ["depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_account_id_fkey"
            columns: ["depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_account_id_fkey"
            columns: ["depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_account_id_fkey"
            columns: ["depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_account_id_fkey"
            columns: ["depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_disposal_journal_id_fkey"
            columns: ["disposal_journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_disposal_journal_id_fkey"
            columns: ["disposal_journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
          {
            foreignKeyName: "fixed_assets_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          cash_txn_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payable_id: string | null
          payment_date: string
          receivable_id: string | null
        }
        Insert: {
          amount: number
          cash_txn_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payable_id?: string | null
          payment_date: string
          receivable_id?: string | null
        }
        Update: {
          amount?: number
          cash_txn_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payable_id?: string | null
          payment_date?: string
          receivable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_cash_txn_id_fkey"
            columns: ["cash_txn_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "v_aging_receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          currency: string
          debit: number
          description: string | null
          fx_credit: number | null
          fx_debit: number | null
          id: string
          journal_id: string
          line_no: number
          metadata: Json
          partner_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          currency?: string
          debit?: number
          description?: string | null
          fx_credit?: number | null
          fx_debit?: number | null
          id?: string
          journal_id: string
          line_no: number
          metadata?: Json
          partner_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          currency?: string
          debit?: number
          description?: string | null
          fx_credit?: number | null
          fx_debit?: number | null
          id?: string
          journal_id?: string
          line_no?: number
          metadata?: Json
          partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
          {
            foreignKeyName: "journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      journals: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          date: string
          deleted_at: string | null
          description: string | null
          exchange_rate: number
          id: string
          metadata: Json
          notes: string | null
          number: string
          period_id: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by_journal_id: string | null
          source: Database["public"]["Enums"]["journal_source"]
          source_ref: string | null
          status: Database["public"]["Enums"]["journal_status"]
          total_credit: number
          total_debit: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date: string
          deleted_at?: string | null
          description?: string | null
          exchange_rate?: number
          id?: string
          metadata?: Json
          notes?: string | null
          number: string
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by_journal_id?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          exchange_rate?: number
          id?: string
          metadata?: Json
          notes?: string | null
          number?: string
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by_journal_id?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_reversed_by_journal_id_fkey"
            columns: ["reversed_by_journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_reversed_by_journal_id_fkey"
            columns: ["reversed_by_journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
        ]
      }
      match_rules: {
        Row: {
          amount_tolerance: number
          company_id: string
          created_at: string
          date_tolerance_days: number
          description_pattern: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          match_count: number
          name: string
          partner_match: string
          priority: number
          type: Database["public"]["Enums"]["recon_type"]
          updated_at: string
        }
        Insert: {
          amount_tolerance?: number
          company_id: string
          created_at?: string
          date_tolerance_days?: number
          description_pattern?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          match_count?: number
          name: string
          partner_match?: string
          priority?: number
          type: Database["public"]["Enums"]["recon_type"]
          updated_at?: string
        }
        Update: {
          amount_tolerance?: number
          company_id?: string
          created_at?: string
          date_tolerance_days?: number
          description_pattern?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          match_count?: number
          name?: string
          partner_match?: string
          priority?: number
          type?: Database["public"]["Enums"]["recon_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          aliases: Json
          code: string | null
          company_id: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          default_ap_account_id: string | null
          default_ar_account_id: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          is_vat_payer: boolean
          metadata: Json
          name: string
          name_normalized: string | null
          notes: string | null
          phone: string | null
          register: string | null
          tin: string | null
          type: Database["public"]["Enums"]["partner_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          aliases?: Json
          code?: string | null
          company_id: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          default_ap_account_id?: string | null
          default_ar_account_id?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_vat_payer?: boolean
          metadata?: Json
          name: string
          name_normalized?: string | null
          notes?: string | null
          phone?: string | null
          register?: string | null
          tin?: string | null
          type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          aliases?: Json
          code?: string | null
          company_id?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          default_ap_account_id?: string | null
          default_ar_account_id?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_vat_payer?: boolean
          metadata?: Json
          name?: string
          name_normalized?: string | null
          notes?: string | null
          phone?: string | null
          register?: string | null
          tin?: string | null
          type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_default_ap_account_id_fkey"
            columns: ["default_ap_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_default_ap_account_id_fkey"
            columns: ["default_ap_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "partners_default_ap_account_id_fkey"
            columns: ["default_ap_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "partners_default_ap_account_id_fkey"
            columns: ["default_ap_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "partners_default_ap_account_id_fkey"
            columns: ["default_ap_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "partners_default_ar_account_id_fkey"
            columns: ["default_ar_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_default_ar_account_id_fkey"
            columns: ["default_ar_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "partners_default_ar_account_id_fkey"
            columns: ["default_ar_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "partners_default_ar_account_id_fkey"
            columns: ["default_ar_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "partners_default_ar_account_id_fkey"
            columns: ["default_ar_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      payables: {
        Row: {
          amount: number
          ap_account_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          exchange_rate: number
          expense_account_id: string | null
          id: string
          invoice_date: string
          invoice_no: string | null
          journal_id: string | null
          metadata: Json
          notes: string | null
          paid_amount: number
          partner_id: string
          remaining: number | null
          responsible: string | null
          status: Database["public"]["Enums"]["ar_ap_status"]
          total_amount: number
          updated_at: string
          updated_by: string | null
          vat_amount: number
          vat_record_id: string | null
        }
        Insert: {
          amount: number
          ap_account_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          exchange_rate?: number
          expense_account_id?: string | null
          id?: string
          invoice_date: string
          invoice_no?: string | null
          journal_id?: string | null
          metadata?: Json
          notes?: string | null
          paid_amount?: number
          partner_id: string
          remaining?: number | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["ar_ap_status"]
          total_amount: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
          vat_record_id?: string | null
        }
        Update: {
          amount?: number
          ap_account_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          exchange_rate?: number
          expense_account_id?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string | null
          journal_id?: string | null
          metadata?: Json
          notes?: string | null
          paid_amount?: number
          partner_id?: string
          remaining?: number | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["ar_ap_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
          vat_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payables_ap_account_id_fkey"
            columns: ["ap_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_ap_account_id_fkey"
            columns: ["ap_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payables_ap_account_id_fkey"
            columns: ["ap_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payables_ap_account_id_fkey"
            columns: ["ap_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payables_ap_account_id_fkey"
            columns: ["ap_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payables_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payables_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payables_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payables_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
          {
            foreignKeyName: "payables_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "payables_vat_record_id_fkey"
            columns: ["vat_record_id"]
            isOneToOne: false
            referencedRelation: "vat_records"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          end_date: string
          id: string
          locked_at: string | null
          locked_by: string | null
          month: number
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["period_status"]
          updated_at: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string
          end_date: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          month: number
          notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          month?: number
          notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          ar_account_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          exchange_rate: number
          id: string
          income_account_id: string | null
          invoice_date: string
          invoice_no: string | null
          journal_id: string | null
          metadata: Json
          notes: string | null
          paid_amount: number
          partner_id: string
          remaining: number | null
          responsible: string | null
          status: Database["public"]["Enums"]["ar_ap_status"]
          total_amount: number
          updated_at: string
          updated_by: string | null
          vat_amount: number
          vat_record_id: string | null
        }
        Insert: {
          amount: number
          ar_account_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          exchange_rate?: number
          id?: string
          income_account_id?: string | null
          invoice_date: string
          invoice_no?: string | null
          journal_id?: string | null
          metadata?: Json
          notes?: string | null
          paid_amount?: number
          partner_id: string
          remaining?: number | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["ar_ap_status"]
          total_amount: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
          vat_record_id?: string | null
        }
        Update: {
          amount?: number
          ar_account_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          exchange_rate?: number
          id?: string
          income_account_id?: string | null
          invoice_date?: string
          invoice_no?: string | null
          journal_id?: string | null
          metadata?: Json
          notes?: string | null
          paid_amount?: number
          partner_id?: string
          remaining?: number | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["ar_ap_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
          vat_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_ar_account_id_fkey"
            columns: ["ar_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_ar_account_id_fkey"
            columns: ["ar_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "receivables_ar_account_id_fkey"
            columns: ["ar_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "receivables_ar_account_id_fkey"
            columns: ["ar_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "receivables_ar_account_id_fkey"
            columns: ["ar_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "receivables_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "receivables_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "receivables_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "receivables_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
          {
            foreignKeyName: "receivables_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "receivables_vat_record_id_fkey"
            columns: ["vat_record_id"]
            isOneToOne: false
            referencedRelation: "vat_records"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliations: {
        Row: {
          actual_amount: number | null
          cash_txn_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          diff: number | null
          expected_amount: number | null
          id: string
          matched_amount: number
          matched_at: string | null
          matched_by: string | null
          metadata: Json
          notes: string | null
          partner_id: string | null
          period_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["recon_status"]
          type: Database["public"]["Enums"]["recon_type"]
          updated_at: string
          vat_record_id: string | null
        }
        Insert: {
          actual_amount?: number | null
          cash_txn_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          diff?: number | null
          expected_amount?: number | null
          id?: string
          matched_amount: number
          matched_at?: string | null
          matched_by?: string | null
          metadata?: Json
          notes?: string | null
          partner_id?: string | null
          period_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["recon_status"]
          type: Database["public"]["Enums"]["recon_type"]
          updated_at?: string
          vat_record_id?: string | null
        }
        Update: {
          actual_amount?: number | null
          cash_txn_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          diff?: number | null
          expected_amount?: number | null
          id?: string
          matched_amount?: number
          matched_at?: string | null
          matched_by?: string | null
          metadata?: Json
          notes?: string | null
          partner_id?: string | null
          period_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["recon_status"]
          type?: Database["public"]["Enums"]["recon_type"]
          updated_at?: string
          vat_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_cash_txn_id_fkey"
            columns: ["cash_txn_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "reconciliations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_vat_record_id_fkey"
            columns: ["vat_record_id"]
            isOneToOne: false
            referencedRelation: "vat_records"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          advance: number
          base_salary: number
          bod_salary: number
          cash_txn_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          emndsh: number
          employee_id: string
          hhoat: number
          hhoat_deduction: number
          id: string
          journal_id: string | null
          leave_pay: number
          metadata: Json
          month: number
          net_pay: number
          notes: string | null
          other_deduction: number
          other_income: number
          paid_at: string | null
          period_id: string
          phone_allowance: number
          sales_bonus: number
          status: Database["public"]["Enums"]["salary_status"]
          total_hours: number
          total_income: number
          updated_at: string
          updated_by: string | null
          worked_hours: number
          year: number
        }
        Insert: {
          advance?: number
          base_salary?: number
          bod_salary?: number
          cash_txn_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          emndsh?: number
          employee_id: string
          hhoat?: number
          hhoat_deduction?: number
          id?: string
          journal_id?: string | null
          leave_pay?: number
          metadata?: Json
          month: number
          net_pay?: number
          notes?: string | null
          other_deduction?: number
          other_income?: number
          paid_at?: string | null
          period_id: string
          phone_allowance?: number
          sales_bonus?: number
          status?: Database["public"]["Enums"]["salary_status"]
          total_hours?: number
          total_income?: number
          updated_at?: string
          updated_by?: string | null
          worked_hours?: number
          year: number
        }
        Update: {
          advance?: number
          base_salary?: number
          bod_salary?: number
          cash_txn_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          emndsh?: number
          employee_id?: string
          hhoat?: number
          hhoat_deduction?: number
          id?: string
          journal_id?: string | null
          leave_pay?: number
          metadata?: Json
          month?: number
          net_pay?: number
          notes?: string | null
          other_deduction?: number
          other_income?: number
          paid_at?: string | null
          period_id?: string
          phone_allowance?: number
          sales_bonus?: number
          status?: Database["public"]["Enums"]["salary_status"]
          total_hours?: number
          total_income?: number
          updated_at?: string
          updated_by?: string | null
          worked_hours?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_cash_txn_id_fkey"
            columns: ["cash_txn_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
          {
            foreignKeyName: "salary_records_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          is_default: boolean
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          is_default?: boolean
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          is_default?: boolean
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_records: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          ddtd: string | null
          deleted_at: string | null
          description: string | null
          direction: Database["public"]["Enums"]["vat_direction"]
          ebarimt_status: string | null
          id: string
          invoice_no: string | null
          journal_id: string | null
          metadata: Json
          paid_amount: number
          parent_ddtd: string | null
          partner_id: string | null
          partner_name: string | null
          partner_register: string | null
          payable_id: string | null
          raw_data: Json | null
          receivable_id: string | null
          remaining: number | null
          reported_period_id: string | null
          source: Database["public"]["Enums"]["vat_source"]
          status: Database["public"]["Enums"]["vat_status"]
          tax_type: Database["public"]["Enums"]["vat_tax_type"]
          total_amount: number
          updated_at: string
          updated_by: string | null
          vat_amount: number
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          date: string
          ddtd?: string | null
          deleted_at?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["vat_direction"]
          ebarimt_status?: string | null
          id?: string
          invoice_no?: string | null
          journal_id?: string | null
          metadata?: Json
          paid_amount?: number
          parent_ddtd?: string | null
          partner_id?: string | null
          partner_name?: string | null
          partner_register?: string | null
          payable_id?: string | null
          raw_data?: Json | null
          receivable_id?: string | null
          remaining?: number | null
          reported_period_id?: string | null
          source?: Database["public"]["Enums"]["vat_source"]
          status?: Database["public"]["Enums"]["vat_status"]
          tax_type?: Database["public"]["Enums"]["vat_tax_type"]
          total_amount: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          ddtd?: string | null
          deleted_at?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["vat_direction"]
          ebarimt_status?: string | null
          id?: string
          invoice_no?: string | null
          journal_id?: string | null
          metadata?: Json
          paid_amount?: number
          parent_ddtd?: string | null
          partner_id?: string | null
          partner_name?: string | null
          partner_register?: string | null
          payable_id?: string | null
          raw_data?: Json | null
          receivable_id?: string | null
          remaining?: number | null
          reported_period_id?: string | null
          source?: Database["public"]["Enums"]["vat_source"]
          status?: Database["public"]["Enums"]["vat_status"]
          tax_type?: Database["public"]["Enums"]["vat_tax_type"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_vat_payable"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vat_receivable"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vat_receivable"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "v_aging_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vat_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vat_records_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vat_records_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "v_general_ledger"
            referencedColumns: ["journal_id"]
          },
          {
            foreignKeyName: "vat_records_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vat_records_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "vat_records_reported_period_id_fkey"
            columns: ["reported_period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          code: string | null
          company_id: string | null
          is_postable: boolean | null
          level: number | null
          line_count: number | null
          name: string | null
          parent_id: string | null
          total_credit: number | null
          total_debit: number | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      v_aging_receivables: {
        Row: {
          aging_bucket: string | null
          company_id: string | null
          days_overdue: number | null
          due_date: string | null
          id: string | null
          invoice_date: string | null
          invoice_no: string | null
          paid_amount: number | null
          partner_id: string | null
          partner_name: string | null
          remaining: number | null
          status: Database["public"]["Enums"]["ar_ap_status"] | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      v_balance_sheet: {
        Row: {
          account_id: string | null
          amount: number | null
          code: string | null
          company_id: string | null
          level: number | null
          name: string | null
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      v_fixed_asset_register: {
        Row: {
          accumulated_depreciation: number | null
          category: string | null
          code: string | null
          company_id: string | null
          depreciation_pct: number | null
          id: string | null
          location: string | null
          monthly_depreciation: number | null
          months_in_use: number | null
          name: string | null
          net_book_value: number | null
          purchase_amount: number | null
          purchase_date: string | null
          responsible_person: string | null
          salvage_value: number | null
          status: Database["public"]["Enums"]["asset_status"] | null
          useful_life_months: number | null
        }
        Insert: {
          accumulated_depreciation?: number | null
          category?: string | null
          code?: string | null
          company_id?: string | null
          depreciation_pct?: never
          id?: string | null
          location?: string | null
          monthly_depreciation?: number | null
          months_in_use?: never
          name?: string | null
          net_book_value?: number | null
          purchase_amount?: number | null
          purchase_date?: string | null
          responsible_person?: string | null
          salvage_value?: number | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          useful_life_months?: number | null
        }
        Update: {
          accumulated_depreciation?: number | null
          category?: string | null
          code?: string | null
          company_id?: string | null
          depreciation_pct?: never
          id?: string | null
          location?: string | null
          monthly_depreciation?: number | null
          months_in_use?: never
          name?: string | null
          net_book_value?: number | null
          purchase_amount?: number | null
          purchase_date?: string | null
          responsible_person?: string | null
          salvage_value?: number | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          useful_life_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_general_ledger: {
        Row: {
          account_code: string | null
          account_id: string | null
          account_name: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          company_id: string | null
          credit: number | null
          currency: string | null
          date: string | null
          debit: number | null
          description: string | null
          journal_description: string | null
          journal_id: string | null
          journal_number: string | null
          journal_reference: string | null
          line_id: string | null
          line_no: number | null
          partner_id: string | null
          partner_name: string | null
          period_id: string | null
          source: Database["public"]["Enums"]["journal_source"] | null
          status: Database["public"]["Enums"]["journal_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_partner_balance"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "journals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      v_income_statement: {
        Row: {
          account_id: string | null
          code: string | null
          company_id: string | null
          contribution_to_profit: number | null
          expense: number | null
          income: number | null
          level: number | null
          name: string | null
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      v_partner_balance: {
        Row: {
          company_id: string | null
          open_payable_count: number | null
          open_payables: number | null
          open_receivable_count: number | null
          open_receivables: number | null
          partner_id: string | null
          partner_name: string | null
          partner_type: Database["public"]["Enums"]["partner_type"] | null
          register: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      v_trial_balance: {
        Row: {
          account_id: string | null
          code: string | null
          company_id: string | null
          credit_balance: number | null
          debit_balance: number | null
          level: number | null
          name: string | null
          parent_id: string | null
          signed_balance: number | null
          total_credit: number | null
          total_debit: number | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_balance_sheet"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_income_statement"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_trial_balance"
            referencedColumns: ["account_id"]
          },
        ]
      }
      v_vat_summary: {
        Row: {
          company_id: string | null
          direction: Database["public"]["Enums"]["vat_direction"] | null
          grand_total: number | null
          month_start: string | null
          paid_total: number | null
          record_count: number | null
          remaining_total: number | null
          tax_type: Database["public"]["Enums"]["vat_tax_type"] | null
          total_amount: number | null
          total_vat: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vat_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_company_ids: { Args: never; Returns: string[] }
      auth_company_role: {
        Args: { p_company_id: string }
        Returns: Database["public"]["Enums"]["company_role"]
      }
      auth_has_role: {
        Args: {
          p_company_id: string
          p_roles: Database["public"]["Enums"]["company_role"][]
        }
        Returns: boolean
      }
      calculate_depreciation: {
        Args: { p_period_id: string }
        Returns: {
          asset_code: string
          asset_id: string
          depreciation_amount: number
          journal_id: string
        }[]
      }
      close_period: {
        Args: { p_period_id: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          end_date: string
          id: string
          locked_at: string | null
          locked_by: string | null
          month: number
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["period_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_journal_from_cash: { Args: { p_cash_id: string }; Returns: string }
      find_partner_by_name: {
        Args: { p_company_id: string; p_search: string; p_threshold?: number }
        Returns: {
          match_source: string
          name: string
          partner_id: string
          similarity: number
        }[]
      }
      fn_account_balances_period: {
        Args: {
          p_company_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          account_id: string
          closing_balance: number
          code: string
          is_postable: boolean
          level: number
          name: string
          opening_balance: number
          parent_id: string
          period_credit: number
          period_debit: number
          type: Database["public"]["Enums"]["account_type"]
        }[]
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      period_for_date: {
        Args: { p_company_id: string; p_date: string }
        Returns: string
      }
      post_journal: {
        Args: { p_journal_id: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          date: string
          deleted_at: string | null
          description: string | null
          exchange_rate: number
          id: string
          metadata: Json
          notes: string | null
          number: string
          period_id: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by_journal_id: string | null
          source: Database["public"]["Enums"]["journal_source"]
          source_ref: string | null
          status: Database["public"]["Enums"]["journal_status"]
          total_credit: number
          total_debit: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "journals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reconcile_invoice_payment: {
        Args: {
          p_amount: number
          p_cash_txn_id: string
          p_receivable_id: string
        }
        Returns: string
      }
      reopen_period: {
        Args: { p_period_id: string; p_reason: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          end_date: string
          id: string
          locked_at: string | null
          locked_by: string | null
          month: number
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["period_status"]
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_journal: {
        Args: { p_date?: string; p_journal_id: string; p_reason: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          date: string
          deleted_at: string | null
          description: string | null
          exchange_rate: number
          id: string
          metadata: Json
          notes: string | null
          number: string
          period_id: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by_journal_id: string | null
          source: Database["public"]["Enums"]["journal_source"]
          source_ref: string | null
          status: Database["public"]["Enums"]["journal_status"]
          total_credit: number
          total_debit: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "journals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      ar_ap_status:
        | "draft"
        | "open"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
        | "written_off"
      asset_status: "active" | "inactive" | "disposed" | "written_off"
      cash_direction: "income" | "expense"
      company_role: "admin" | "accountant" | "auditor" | "viewer"
      depreciation_method: "straight_line" | "declining" | "units"
      journal_source:
        | "manual"
        | "cash_import"
        | "vat"
        | "ebarimt"
        | "payroll"
        | "depreciation"
        | "opening"
        | "closing"
        | "reversal"
        | "import"
      journal_status: "draft" | "posted" | "reversed"
      partner_type: "customer" | "supplier" | "both" | "employee" | "other"
      period_status: "open" | "closed" | "locked"
      recon_status:
        | "pending"
        | "matched"
        | "disputed"
        | "resolved"
        | "cancelled"
      recon_type: "vat_cash" | "partner" | "bank" | "intercompany"
      salary_status: "draft" | "approved" | "posted" | "paid" | "cancelled"
      vat_direction: "inbound" | "outbound"
      vat_source: "ebarimt" | "manual" | "import" | "invoice"
      vat_status:
        | "pending"
        | "matched"
        | "reconciled"
        | "declared"
        | "cancelled"
      vat_tax_type: "standard" | "zero" | "reduced" | "exempt"
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      ar_ap_status: [
        "draft",
        "open",
        "partial",
        "paid",
        "overdue",
        "cancelled",
        "written_off",
      ],
      asset_status: ["active", "inactive", "disposed", "written_off"],
      cash_direction: ["income", "expense"],
      company_role: ["admin", "accountant", "auditor", "viewer"],
      depreciation_method: ["straight_line", "declining", "units"],
      journal_source: [
        "manual",
        "cash_import",
        "vat",
        "ebarimt",
        "payroll",
        "depreciation",
        "opening",
        "closing",
        "reversal",
        "import",
      ],
      journal_status: ["draft", "posted", "reversed"],
      partner_type: ["customer", "supplier", "both", "employee", "other"],
      period_status: ["open", "closed", "locked"],
      recon_status: ["pending", "matched", "disputed", "resolved", "cancelled"],
      recon_type: ["vat_cash", "partner", "bank", "intercompany"],
      salary_status: ["draft", "approved", "posted", "paid", "cancelled"],
      vat_direction: ["inbound", "outbound"],
      vat_source: ["ebarimt", "manual", "import", "invoice"],
      vat_status: ["pending", "matched", "reconciled", "declared", "cancelled"],
      vat_tax_type: ["standard", "zero", "reduced", "exempt"],
    },
  },
} as const
