export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      system_logs: {
        Row: {
          id: string
          function_name: string
          action: string
          status: string
          severity: string
          workspace_id: string | null
          message: string
          context: Json
          error: Json | null
          error_signature: string | null
          request_id: string | null
          environment: string
          duration_ms: number | null
          alerted_at: string | null
          alert_status: string
          resolved: boolean
          resolution: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          function_name: string
          action: string
          status: string
          severity?: string
          workspace_id?: string | null
          message: string
          context?: Json
          error?: Json | null
          error_signature?: string | null
          request_id?: string | null
          environment?: string
          duration_ms?: number | null
          alerted_at?: string | null
          alert_status?: string
          resolved?: boolean
          resolution?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          function_name?: string
          action?: string
          status?: string
          severity?: string
          workspace_id?: string | null
          message?: string
          context?: Json
          error?: Json | null
          error_signature?: string | null
          request_id?: string | null
          environment?: string
          duration_ms?: number | null
          alerted_at?: string | null
          alert_status?: string
          resolved?: boolean
          resolution?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: number
          alert_enabled: boolean
          alert_instance_name: string | null
          alert_group_jid: string | null
          alert_group_name: string | null
          rate_limit_per_min: number
          updated_at: string
        }
        Insert: {
          id?: number
          alert_enabled?: boolean
          alert_instance_name?: string | null
          alert_group_jid?: string | null
          alert_group_name?: string | null
          rate_limit_per_min?: number
          updated_at?: string
        }
        Update: {
          id?: number
          alert_enabled?: boolean
          alert_instance_name?: string | null
          alert_group_jid?: string | null
          alert_group_name?: string | null
          rate_limit_per_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      ad_accounts: {
        Row: {
          access_token: string | null
          account_id: string | null
          created_at: string
          id: string
          name: string | null
          user_id: string | null
          status: string | null
          business_id: string | null
          currency: string | null
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          created_at?: string
          id?: string
          name?: string | null
          user_id?: string | null
          status?: string | null
          business_id?: string | null
          currency?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          created_at?: string
          id?: string
          name?: string | null
          user_id?: string | null
          status?: string | null
          business_id?: string | null
          currency?: string | null
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          name: string
          owner_id: string
          plan_type: string
          max_fb_profiles: number
          max_members: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          plan_type?: string
          max_fb_profiles?: number
          max_members?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          plan_type?: string
          max_fb_profiles?: number
          max_members?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_folder_items: {
        Row: {
          asset_id: string
          asset_type: string
          created_at: string
          folder_id: string
          id: string
          user_id: string
        }
        Insert: {
          asset_id: string
          asset_type: string
          created_at?: string
          folder_id: string
          id?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          asset_type?: string
          created_at?: string
          folder_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_folder_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "asset_folders"
            referencedColumns: ["id"]
          }
        ]
      }
      asset_folders: {
        Row: {
          account_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fb_connections: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          instagram_actor_id: string | null
          name: string | null
          page_id: string | null
          status: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          instagram_actor_id?: string | null
          name?: string | null
          page_id?: string | null
          status?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          instagram_actor_id?: string | null
          name?: string | null
          page_id?: string | null
          status?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      shared_dashboards: {
        Row: {
          ad_account_id: string
          agency_logo: string | null
          agency_name: string | null
          created_at: string
          id: string
          is_active: boolean
          share_token: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          agency_logo?: string | null
          agency_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          share_token?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          agency_logo?: string | null
          agency_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          share_token?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
          status: string | null
          email: string | null
          name: string | null
          phone: string | null
          base_salary: number | null
          commission_rate: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
          status?: string | null
          email?: string | null
          name?: string | null
          phone?: string | null
          base_salary?: number | null
          commission_rate?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
          status?: string | null
          email?: string | null
          name?: string | null
          phone?: string | null
          base_salary?: number | null
          commission_rate?: number | null
        }
        Relationships: []
      }
      meta_tokens: {
        Row: {
          id: string
          user_id: string
          access_token: string
          account_name: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          access_token: string
          account_name?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          access_token?: string
          account_name?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_clients: {
        Row: {
          id: string
          name: string
          fee_fixed: number | null
          commission_rate: number | null
          calculation_base: string | null
          created_at: string
          assigned_products: string[] | null
          logo_url: string | null
          is_archived: boolean
          selected_ad_accounts: string[] | null
          cartpanda_status: string | null
          cartpanda_store_slug: string | null
          workspace_id: string | null
          payment_due_day: number | null
          primary_color: string | null
          profit_gateway_percent: number | null
          profit_tax_percent: number | null
          profit_fixed_costs: number | null
          project_deadline: string | null
          project_name: string | null
          client_type: string | null
        }
        Insert: {
          id?: string
          name: string
          fee_fixed?: number | null
          commission_rate?: number | null
          calculation_base?: string | null
          created_at?: string
          assigned_products?: string[] | null
          logo_url?: string | null
          is_archived?: boolean
          selected_ad_accounts?: string[] | null
          cartpanda_status?: string | null
          cartpanda_store_slug?: string | null
          workspace_id?: string | null
          payment_due_day?: number | null
          primary_color?: string | null
          profit_gateway_percent?: number | null
          profit_tax_percent?: number | null
          profit_fixed_costs?: number | null
          project_deadline?: string | null
          project_name?: string | null
          client_type?: string | null
        }
        Update: {
          id?: string
          name?: string
          fee_fixed?: number | null
          commission_rate?: number | null
          calculation_base?: string | null
          created_at?: string
          assigned_products?: string[] | null
          logo_url?: string | null
          is_archived?: boolean
          selected_ad_accounts?: string[] | null
          cartpanda_status?: string | null
          cartpanda_store_slug?: string | null
          workspace_id?: string | null
          payment_due_day?: number | null
          primary_color?: string | null
          profit_gateway_percent?: number | null
          profit_tax_percent?: number | null
          profit_fixed_costs?: number | null
          project_deadline?: string | null
          project_name?: string | null
          client_type?: string | null
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          id: string
          created_at: string
          workspace_id: string | null
          name: string
          store_name: string | null
          phone: string | null
          email: string | null
          lead_status: 'contato' | 'resposta' | 'follow_up' | 'fechamento'
          lead_score: string | null
          product_interest: string | null
          observations: string | null
          column_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          workspace_id?: string | null
          name: string
          store_name?: string | null
          phone?: string | null
          email?: string | null
          lead_status?: 'contato' | 'resposta' | 'follow_up' | 'fechamento'
          lead_score?: string | null
          product_interest?: string | null
          observations?: string | null
          column_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          workspace_id?: string | null
          name?: string
          store_name?: string | null
          phone?: string | null
          email?: string | null
          lead_status?: 'contato' | 'resposta' | 'follow_up' | 'fechamento'
          lead_score?: string | null
          product_interest?: string | null
          observations?: string | null
          column_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      client_resources: {
        Row: {
          id: string
          client_id: string
          workspace_id: string
          title: string
          url: string
          resource_type: string
          description: string | null
          is_pinned: boolean
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          client_id: string
          workspace_id: string
          title: string
          url: string
          resource_type?: string
          description?: string | null
          is_pinned?: boolean
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          client_id?: string
          workspace_id?: string
          title?: string
          url?: string
          resource_type?: string
          description?: string | null
          is_pinned?: boolean
          created_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_resources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          }
        ]
      }
      shopify_configs: {
        Row: {
          id: string
          ad_account_id: string
          shop_domain: string
          access_token: string
          is_active: boolean
          created_at: string
          last_sync_at: string | null
        }
        Insert: {
          id?: string
          ad_account_id: string
          shop_domain: string
          access_token: string
          is_active?: boolean
          created_at?: string
          last_sync_at?: string | null
        }
        Update: {
          id?: string
          ad_account_id?: string
          shop_domain?: string
          access_token?: string
          is_active?: boolean
          created_at?: string
          last_sync_at?: string | null
        }
        Relationships: []
      }
      demand_requests: {
        Row: {
          id: string
          workspace_id: string | null
          client_id: string | null
          title: string
          description: string | null
          area: string | null
          client_priority: string | null
          status: string | null
          attachments: string[] | null
          created_by: string | null
          task_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          client_id?: string | null
          title: string
          description?: string | null
          area?: string | null
          client_priority?: string | null
          status?: string | null
          attachments?: string[] | null
          created_by?: string | null
          task_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          client_id?: string | null
          title?: string
          description?: string | null
          area?: string | null
          client_priority?: string | null
          status?: string | null
          attachments?: string[] | null
          created_by?: string | null
          task_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      client_tasks: {
        Row: {
          id: string
          client_id: string | null
          title: string
          description: string | null
          status: string | null
          priority: string | null
          area: string | null
          assignee_id: string | null
          checklist: Json | null
          product_id: string | null
          product_name: string | null
          due_date: string | null
          project_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          title: string
          description?: string | null
          status?: string | null
          priority?: string | null
          area?: string | null
          assignee_id?: string | null
          checklist?: Json | null
          product_id?: string | null
          product_name?: string | null
          due_date?: string | null
          project_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          title?: string
          description?: string | null
          status?: string | null
          priority?: string | null
          area?: string | null
          assignee_id?: string | null
          checklist?: Json | null
          product_id?: string | null
          product_name?: string | null
          due_date?: string | null
          project_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_time_entries: {
        Row: {
          id: string
          task_id: string
          user_id: string
          started_at: string
          ended_at: string | null
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
        Relationships: []
      }
      client_step_status: {
        Row: {
          id: string
          client_id: string | null
          step_id: string
          status: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          step_id: string
          status?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string | null
          step_id?: string
          status?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_expenses: {
        Row: {
          id: string
          workspace_id: string
          description: string
          amount: number
          category: 'staff' | 'tool' | 'other'
          status: 'pending' | 'paid'
          due_date: string
          payment_date: string | null
          recurrence_type: 'fixed' | 'variable'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          description: string
          amount?: number
          category: 'staff' | 'tool' | 'other'
          status?: 'pending' | 'paid'
          due_date: string
          payment_date?: string | null
          recurrence_type?: 'fixed' | 'variable'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          description?: string
          amount?: number
          category?: 'staff' | 'tool' | 'other'
          status?: 'pending' | 'paid'
          due_date?: string
          payment_date?: string | null
          recurrence_type?: 'fixed' | 'variable'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_invoices: {
        Row: {
          id: string
          client_id: string
          amount: number
          status: 'pending' | 'paid' | 'overdue'
          due_date: string
          payment_date: string | null
          month_reference: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          amount?: number
          status?: 'pending' | 'paid' | 'overdue'
          due_date: string
          payment_date?: string | null
          month_reference: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          amount?: number
          status?: 'pending' | 'paid' | 'overdue'
          due_date?: string
          payment_date?: string | null
          month_reference?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_commissions: {
        Row: {
          id: string
          member_id: string
          client_id: string
          rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          client_id: string
          rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          client_id?: string
          rate?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          id: string
          workspace_id: string
          transaction_date: string
          amount: number
          currency: string
          type: 'income' | 'refund' | 'chargeback'
          status: 'pending' | 'paid' | 'failed'
          source: string
          external_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          transaction_date: string
          amount: number
          currency?: string
          type: 'income' | 'refund' | 'chargeback'
          status: 'pending' | 'paid' | 'failed'
          source: string
          external_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          transaction_date?: string
          amount?: number
          currency?: string
          type?: 'income' | 'refund' | 'chargeback'
          status?: 'pending' | 'paid' | 'failed'
          source?: string
          external_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      marketing_spend: {
        Row: {
          id: string
          workspace_id: string
          date: string
          platform: 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'other'
          amount: number
          currency: string
          campaign_name: string | null
          campaign_id: string | null
          impressions: number | null
          clicks: number | null
          conversions: number | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          date: string
          platform: 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'other'
          amount: number
          currency?: string
          campaign_name?: string | null
          campaign_id?: string | null
          impressions?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          date?: string
          platform?: 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'other'
          amount?: number
          currency?: string
          campaign_name?: string | null
          campaign_id?: string | null
          impressions?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string
        }
        Relationships: []
      }
      fixed_costs: {
        Row: {
          id: string
          workspace_id: string
          name: string
          amount: number
          currency: string
          frequency: 'monthly' | 'yearly' | 'one_time'
          payment_day: number | null
          category: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          amount: number
          currency?: string
          frequency: 'monthly' | 'yearly' | 'one_time'
          payment_day?: number | null
          category?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          amount?: number
          currency?: string
          frequency?: 'monthly' | 'yearly' | 'one_time'
          payment_day?: number | null
          category?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      variable_costs: {
        Row: {
          id: string
          workspace_id: string
          date: string
          description: string
          amount: number
          currency: string
          category: string | null
          related_transaction_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          date: string
          description: string
          amount: number
          currency?: string
          category?: string | null
          related_transaction_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          date?: string
          description?: string
          amount?: number
          currency?: string
          category?: string | null
          related_transaction_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          id: string
          workspace_id: string
          product_sku: string
          cost_per_unit: number
          currency: string
          valid_from: string
          valid_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          product_sku: string
          cost_per_unit: number
          currency?: string
          valid_from?: string
          valid_to?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          product_sku?: string
          cost_per_unit?: number
          currency?: string
          valid_from?: string
          valid_to?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sales_records: {
        Row: {
          id: string
          workspace_id: string
          client_name: string
          service: string | null
          sale_date: string
          total_amount: number
          payment_method: 'pix' | 'cartao' | 'boleto' | 'transferencia' | 'dinheiro' | 'outro' | null
          entry_type: 'percentage' | 'fixed' | null
          entry_amount: number
          balance_due_date: string | null
          status: 'pendente' | 'parcial' | 'pago'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          client_name: string
          service?: string | null
          sale_date?: string
          total_amount?: number
          payment_method?: 'pix' | 'cartao' | 'boleto' | 'transferencia' | 'dinheiro' | 'outro' | null
          entry_type?: 'percentage' | 'fixed' | null
          entry_amount?: number
          balance_due_date?: string | null
          status?: 'pendente' | 'parcial' | 'pago'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          client_name?: string
          service?: string | null
          sale_date?: string
          total_amount?: number
          payment_method?: 'pix' | 'cartao' | 'boleto' | 'transferencia' | 'dinheiro' | 'outro' | null
          entry_type?: 'percentage' | 'fixed' | null
          entry_amount?: number
          balance_due_date?: string | null
          status?: 'pendente' | 'parcial' | 'pago'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_goals: {
        Row: {
          id: string
          workspace_id: string
          month_reference: string
          goal_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          month_reference: string
          goal_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          month_reference?: string
          goal_amount?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations_config: {
        Row: {
          id: string
          workspace_id: string | null
          provider: 'shopify' | 'nuvemshop' | 'meta_ads' | 'google_ads'
          credentials: Json
          is_active: boolean
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          provider: 'shopify' | 'nuvemshop' | 'meta_ads' | 'google_ads'
          credentials: Json
          is_active?: boolean
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          provider?: 'shopify' | 'nuvemshop' | 'meta_ads' | 'google_ads'
          credentials?: Json
          is_active?: boolean
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_workspace_for_user: {
        Args: {
          p_name: string
          p_owner_id: string
          p_plan_type: string
          p_max_fb_profiles: number
          p_max_members: number
        }
        Returns: {
          id: string
          name: string
          owner_id: string
          plan_type: string
          max_fb_profiles: number
          max_members: number
          created_at: string
          updated_at: string
        }[]
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
