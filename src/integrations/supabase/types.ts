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
      _backup_client_tasks_20260527: {
        Row: {
          archived_at: string | null
          area: string | null
          assignee_id: string | null
          attachments: Json | null
          category: string | null
          checklist: Json | null
          client_id: string | null
          completed_at: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          drive_links: Json | null
          due_date: string | null
          id: string | null
          images: Json | null
          order_position: number | null
          priority: string | null
          product_id: string | null
          product_name: string | null
          project_type: string | null
          source: string | null
          status: string | null
          step_id: string | null
          title: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          area?: string | null
          assignee_id?: string | null
          attachments?: Json | null
          category?: string | null
          checklist?: Json | null
          client_id?: string | null
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          drive_links?: Json | null
          due_date?: string | null
          id?: string | null
          images?: Json | null
          order_position?: number | null
          priority?: string | null
          product_id?: string | null
          product_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string | null
          step_id?: string | null
          title?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          area?: string | null
          assignee_id?: string | null
          attachments?: Json | null
          category?: string | null
          checklist?: Json | null
          client_id?: string | null
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          drive_links?: Json | null
          due_date?: string | null
          id?: string | null
          images?: Json | null
          order_position?: number | null
          priority?: string | null
          product_id?: string | null
          product_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string | null
          step_id?: string | null
          title?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      _backup_client_tasks_20260601: {
        Row: {
          archived_at: string | null
          area: string | null
          assignee_id: string | null
          attachments: Json | null
          category: string | null
          checklist: Json | null
          client_id: string | null
          completed_at: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          drive_links: Json | null
          due_date: string | null
          id: string | null
          images: Json | null
          order_position: number | null
          priority: string | null
          product_id: string | null
          product_name: string | null
          project_type: string | null
          source: string | null
          status: string | null
          step_id: string | null
          title: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          area?: string | null
          assignee_id?: string | null
          attachments?: Json | null
          category?: string | null
          checklist?: Json | null
          client_id?: string | null
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          drive_links?: Json | null
          due_date?: string | null
          id?: string | null
          images?: Json | null
          order_position?: number | null
          priority?: string | null
          product_id?: string | null
          product_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string | null
          step_id?: string | null
          title?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          area?: string | null
          assignee_id?: string | null
          attachments?: Json | null
          category?: string | null
          checklist?: Json | null
          client_id?: string | null
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          drive_links?: Json | null
          due_date?: string | null
          id?: string | null
          images?: Json | null
          order_position?: number | null
          priority?: string | null
          product_id?: string | null
          product_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string | null
          step_id?: string | null
          title?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      _backup_task_columns_20260527: {
        Row: {
          color: string | null
          created_at: string | null
          id: string | null
          position: number | null
          title: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string | null
          position?: number | null
          title?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string | null
          position?: number | null
          title?: string | null
        }
        Relationships: []
      }
      _backup_task_columns_20260601: {
        Row: {
          color: string | null
          created_at: string | null
          hidden: boolean | null
          id: string | null
          position: number | null
          title: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          hidden?: boolean | null
          id?: string | null
          position?: number | null
          title?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          hidden?: boolean | null
          id?: string | null
          position?: number | null
          title?: string | null
        }
        Relationships: []
      }
      academy_comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          student_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          student_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "academy_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_comment_likes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "academy_students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_comments: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_deleted: boolean | null
          lesson_id: string
          parent_id: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          lesson_id: string
          parent_id?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          lesson_id?: string
          parent_id?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "academy_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "academy_students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_enrollments: {
        Row: {
          expires_at: string | null
          granted_at: string | null
          id: string
          module_id: string
          student_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          module_id: string
          student_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          module_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_enrollments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "academy_students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string
          due_date: string
          id: string
          month_reference: string
          notes: string | null
          payment_date: string | null
          recurrence_type: string | null
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description: string
          due_date: string
          id?: string
          month_reference: string
          notes?: string | null
          payment_date?: string | null
          recurrence_type?: string | null
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string
          due_date?: string
          id?: string
          month_reference?: string
          notes?: string | null
          payment_date?: string | null
          recurrence_type?: string | null
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_goals: {
        Row: {
          created_at: string | null
          goal_amount: number
          id: string
          month_reference: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          goal_amount?: number
          id?: string
          month_reference: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          goal_amount?: number
          id?: string
          month_reference?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_invite_redemptions: {
        Row: {
          id: string
          invite_id: string
          redeemed_at: string
          student_id: string
        }
        Insert: {
          id?: string
          invite_id: string
          redeemed_at?: string
          student_id: string
        }
        Update: {
          id?: string
          invite_id?: string
          redeemed_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_invite_redemptions_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "academy_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_invite_redemptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "academy_students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_invites: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          module_id: string
          note: string | null
          token: string
          updated_at: string
          uses: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          module_id: string
          note?: string | null
          token?: string
          updated_at?: string
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          module_id?: string
          note?: string | null
          token?: string
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_invites_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lesson_materials: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_external_url: boolean
          lesson_id: string
          mime_type: string | null
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_external_url?: boolean
          lesson_id: string
          mime_type?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_external_url?: boolean
          lesson_id?: string
          mime_type?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lesson_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          last_seen_at: string | null
          lesson_id: string
          student_id: string
          watched_seconds: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          lesson_id: string
          student_id: string
          watched_seconds?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          lesson_id?: string
          student_id?: string
          watched_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_lesson_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "academy_students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lesson_students: {
        Row: {
          created_at: string
          lesson_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          lesson_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          lesson_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lesson_students_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_lesson_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "academy_students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lessons: {
        Row: {
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean | null
          module_id: string | null
          sort_order: number | null
          student_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean | null
          module_id?: string | null
          sort_order?: number | null
          student_id?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean | null
          module_id?: string | null
          sort_order?: number | null
          student_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "academy_students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_modules: {
        Row: {
          cover_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_published: boolean | null
          level: string | null
          slug: string
          sort_order: number | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          level?: string | null
          slug: string
          sort_order?: number | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          level?: string | null
          slug?: string
          sort_order?: number | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      academy_revenue: {
        Row: {
          amount: number
          category: string | null
          client_name: string | null
          created_at: string | null
          description: string
          due_date: string
          id: string
          month_reference: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          client_name?: string | null
          created_at?: string | null
          description: string
          due_date: string
          id?: string
          month_reference: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string
          due_date?: string
          id?: string
          month_reference?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_revenue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_students: {
        Row: {
          created_at: string | null
          email: string
          enrolled_at: string | null
          full_name: string
          id: string
          is_admin: boolean | null
          is_mentorship_client: boolean
          phone: string | null
          plan: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          enrolled_at?: string | null
          full_name: string
          id?: string
          is_admin?: boolean | null
          is_mentorship_client?: boolean
          phone?: string | null
          plan?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          enrolled_at?: string | null
          full_name?: string
          id?: string
          is_admin?: boolean | null
          is_mentorship_client?: boolean
          phone?: string | null
          plan?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_accounts: {
        Row: {
          access_token: string | null
          account_id: string | null
          business_id: string | null
          created_at: string
          currency: string | null
          id: string
          name: string | null
          status: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          business_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          name?: string | null
          status?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          business_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          name?: string | null
          status?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      agency_access_levels: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions_config: Json | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions_config?: Json | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions_config?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_access_levels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_clients: {
        Row: {
          assigned_products: string[] | null
          calculation_base: string | null
          cartpanda_bearer_token: string | null
          cartpanda_connected_at: string | null
          cartpanda_status: string | null
          cartpanda_store_name: string | null
          cartpanda_store_slug: string | null
          clarity_api_token: string | null
          clarity_connected_at: string | null
          clarity_project_id: string | null
          clarity_snippet_installed: boolean | null
          clarity_status: string | null
          client_type: string | null
          commission_rate: number | null
          created_at: string
          fee_fixed: number | null
          gateway_fee_fixed: number | null
          gateway_fee_percent: number | null
          google_ads_customer_ids: string[]
          id: string
          is_archived: boolean | null
          is_ecommerce: boolean
          is_internal: boolean
          logo_url: string | null
          name: string
          onboarding_type: string | null
          payment_due_day: number | null
          portal_email: string | null
          primary_color: string | null
          product_unit_cost: number | null
          profit_fixed_costs: number | null
          profit_gateway_percent: number | null
          profit_tax_percent: number | null
          project_deadline: string | null
          project_name: string | null
          selected_ad_accounts: string[] | null
          shopify_access_token: string | null
          shopify_client_id: string | null
          shopify_client_secret: string | null
          shopify_connected_at: string | null
          shopify_domain: string | null
          shopify_shop_name: string | null
          shopify_status: string | null
          tax_percent: number | null
          user_id: string | null
          whatsapp_group_jid: string | null
          whatsapp_group_name: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_products?: string[] | null
          calculation_base?: string | null
          cartpanda_bearer_token?: string | null
          cartpanda_connected_at?: string | null
          cartpanda_status?: string | null
          cartpanda_store_name?: string | null
          cartpanda_store_slug?: string | null
          clarity_api_token?: string | null
          clarity_connected_at?: string | null
          clarity_project_id?: string | null
          clarity_snippet_installed?: boolean | null
          clarity_status?: string | null
          client_type?: string | null
          commission_rate?: number | null
          created_at?: string
          fee_fixed?: number | null
          gateway_fee_fixed?: number | null
          gateway_fee_percent?: number | null
          google_ads_customer_ids?: string[]
          id?: string
          is_archived?: boolean | null
          is_ecommerce?: boolean
          is_internal?: boolean
          logo_url?: string | null
          name: string
          onboarding_type?: string | null
          payment_due_day?: number | null
          portal_email?: string | null
          primary_color?: string | null
          product_unit_cost?: number | null
          profit_fixed_costs?: number | null
          profit_gateway_percent?: number | null
          profit_tax_percent?: number | null
          project_deadline?: string | null
          project_name?: string | null
          selected_ad_accounts?: string[] | null
          shopify_access_token?: string | null
          shopify_client_id?: string | null
          shopify_client_secret?: string | null
          shopify_connected_at?: string | null
          shopify_domain?: string | null
          shopify_shop_name?: string | null
          shopify_status?: string | null
          tax_percent?: number | null
          user_id?: string | null
          whatsapp_group_jid?: string | null
          whatsapp_group_name?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_products?: string[] | null
          calculation_base?: string | null
          cartpanda_bearer_token?: string | null
          cartpanda_connected_at?: string | null
          cartpanda_status?: string | null
          cartpanda_store_name?: string | null
          cartpanda_store_slug?: string | null
          clarity_api_token?: string | null
          clarity_connected_at?: string | null
          clarity_project_id?: string | null
          clarity_snippet_installed?: boolean | null
          clarity_status?: string | null
          client_type?: string | null
          commission_rate?: number | null
          created_at?: string
          fee_fixed?: number | null
          gateway_fee_fixed?: number | null
          gateway_fee_percent?: number | null
          google_ads_customer_ids?: string[]
          id?: string
          is_archived?: boolean | null
          is_ecommerce?: boolean
          is_internal?: boolean
          logo_url?: string | null
          name?: string
          onboarding_type?: string | null
          payment_due_day?: number | null
          portal_email?: string | null
          primary_color?: string | null
          product_unit_cost?: number | null
          profit_fixed_costs?: number | null
          profit_gateway_percent?: number | null
          profit_tax_percent?: number | null
          project_deadline?: string | null
          project_name?: string | null
          selected_ad_accounts?: string[] | null
          shopify_access_token?: string | null
          shopify_client_id?: string | null
          shopify_client_secret?: string | null
          shopify_connected_at?: string | null
          shopify_domain?: string | null
          shopify_shop_name?: string | null
          shopify_status?: string | null
          tax_percent?: number | null
          user_id?: string | null
          whatsapp_group_jid?: string | null
          whatsapp_group_name?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string
          due_date: string
          id: string
          payment_date: string | null
          recurrence_type: string
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string | null
          description: string
          due_date: string
          id?: string
          payment_date?: string | null
          recurrence_type?: string
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string
          due_date?: string
          id?: string
          payment_date?: string | null
          recurrence_type?: string
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_product_features: {
        Row: {
          assigned_member_id: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_checked: boolean | null
          name: string
          product_id: string | null
          sort_order: number | null
          subtasks: Json | null
        }
        Insert: {
          assigned_member_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_checked?: boolean | null
          name: string
          product_id?: string | null
          sort_order?: number | null
          subtasks?: Json | null
        }
        Update: {
          assigned_member_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_checked?: boolean | null
          name?: string
          product_id?: string | null
          sort_order?: number | null
          subtasks?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_product_features_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_product_features_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "agency_products"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_products: {
        Row: {
          category: string
          color: string | null
          created_at: string | null
          description: string | null
          detailed_description: string | null
          groups: Json | null
          icon_name: string | null
          id: string
          is_flagship: boolean | null
          name: string
          price: string | null
          price_note: string | null
          pricing_type: string
          updated_at: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          detailed_description?: string | null
          groups?: Json | null
          icon_name?: string | null
          id?: string
          is_flagship?: boolean | null
          name: string
          price?: string | null
          price_note?: string | null
          pricing_type: string
          updated_at?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          detailed_description?: string | null
          groups?: Json | null
          icon_name?: string | null
          id?: string
          is_flagship?: boolean | null
          name?: string
          price?: string | null
          price_note?: string | null
          pricing_type?: string
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: string[] | null
          permissions_config: Json | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: string[] | null
          permissions_config?: Json | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: string[] | null
          permissions_config?: Json | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_id: string | null
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: number
          input: Json | null
          output: Json | null
          status: string | null
          tokens_in: number | null
          tokens_out: number | null
          trigger: string | null
        }
        Insert: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: number
          input?: Json | null
          output?: Json | null
          status?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          trigger?: string | null
        }
        Update: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: number
          input?: Json | null
          output?: Json | null
          status?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          trigger?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_schedules: {
        Row: {
          agent_id: string | null
          cron_expr: string
          enabled: boolean
          id: string
          last_run_at: string | null
        }
        Insert: {
          agent_id?: string | null
          cron_expr: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
        }
        Update: {
          agent_id?: string | null
          cron_expr?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_schedules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          llm_model: string | null
          llm_provider: string | null
          name: string
          owner: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          llm_model?: string | null
          llm_provider?: string | null
          name: string
          owner?: string | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          llm_model?: string | null
          llm_provider?: string | null
          name?: string
          owner?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      briefings: {
        Row: {
          ai_summary: string | null
          answers: Json
          client_group_id: string | null
          client_name: string
          created_at: string | null
          created_by: string | null
          id: string
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          ai_summary?: string | null
          answers?: Json
          client_group_id?: string | null
          client_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          ai_summary?: string | null
          answers?: Json
          client_group_id?: string | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_id: string
          created_at: string | null
          daily_budget: number | null
          id: string
          last_updated_at: string | null
          lifetime_budget: number | null
          name: string | null
          objective: string | null
          status: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          daily_budget?: number | null
          id: string
          last_updated_at?: string | null
          lifetime_budget?: number | null
          name?: string | null
          objective?: string | null
          status?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          daily_budget?: number | null
          id?: string
          last_updated_at?: string | null
          lifetime_budget?: number | null
          name?: string | null
          objective?: string | null
          status?: string | null
        }
        Relationships: []
      }
      clarity_api_usage: {
        Row: {
          client_id: string
          id: string
          last_error: string | null
          last_request_at: string | null
          last_status_code: number | null
          request_count: number
          request_date: string
        }
        Insert: {
          client_id: string
          id?: string
          last_error?: string | null
          last_request_at?: string | null
          last_status_code?: number | null
          request_count?: number
          request_date?: string
        }
        Update: {
          client_id?: string
          id?: string
          last_error?: string | null
          last_request_at?: string | null
          last_status_code?: number | null
          request_count?: number
          request_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "clarity_api_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clarity_api_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      clarity_insights_cache: {
        Row: {
          client_id: string
          dimension1: string | null
          dimension2: string | null
          dimension3: string | null
          expires_at: string
          fetched_at: string
          id: string
          num_of_days: number
          payload: Json
        }
        Insert: {
          client_id: string
          dimension1?: string | null
          dimension2?: string | null
          dimension3?: string | null
          expires_at: string
          fetched_at?: string
          id?: string
          num_of_days: number
          payload: Json
        }
        Update: {
          client_id?: string
          dimension1?: string | null
          dimension2?: string | null
          dimension3?: string | null
          expires_at?: string
          fetched_at?: string
          id?: string
          num_of_days?: number
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clarity_insights_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clarity_insights_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assigned_tasks: {
        Row: {
          assigned_at: string | null
          category: string | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          assigned_at?: string | null
          category?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          assigned_at?: string | null
          category?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assigned_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assigned_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_daily_metrics: {
        Row: {
          add_to_cart: number | null
          approved_transactions: number | null
          avg_order_value: number | null
          cartpanda_orders: number | null
          cartpanda_revenue: number | null
          chargebacks: number | null
          checkouts_initiated: number | null
          clicks: number | null
          client_id: string
          conversion_value: number | null
          conversions: number | null
          created_at: string | null
          date: string
          id: string
          impressions: number | null
          orders: number | null
          product_costs: number | null
          reach: number | null
          revenue: number | null
          sessions: number | null
          spend: number | null
          total_tax_fees: number | null
          transaction_count: number | null
          updated_at: string
        }
        Insert: {
          add_to_cart?: number | null
          approved_transactions?: number | null
          avg_order_value?: number | null
          cartpanda_orders?: number | null
          cartpanda_revenue?: number | null
          chargebacks?: number | null
          checkouts_initiated?: number | null
          clicks?: number | null
          client_id: string
          conversion_value?: number | null
          conversions?: number | null
          created_at?: string | null
          date: string
          id?: string
          impressions?: number | null
          orders?: number | null
          product_costs?: number | null
          reach?: number | null
          revenue?: number | null
          sessions?: number | null
          spend?: number | null
          total_tax_fees?: number | null
          transaction_count?: number | null
          updated_at?: string
        }
        Update: {
          add_to_cart?: number | null
          approved_transactions?: number | null
          avg_order_value?: number | null
          cartpanda_orders?: number | null
          cartpanda_revenue?: number | null
          chargebacks?: number | null
          checkouts_initiated?: number | null
          clicks?: number | null
          client_id?: string
          conversion_value?: number | null
          conversions?: number | null
          created_at?: string | null
          date?: string
          id?: string
          impressions?: number | null
          orders?: number | null
          product_costs?: number | null
          reach?: number | null
          revenue?: number | null
          sessions?: number | null
          spend?: number | null
          total_tax_fees?: number | null
          transaction_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_daily_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_daily_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          category: string
          client_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          doc_type: string
          external_url: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          doc_type?: string
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          doc_type?: string
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string | null
          due_date: string
          id: string
          month_reference: string
          payment_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string | null
          due_date: string
          id?: string
          month_reference: string
          payment_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string | null
          due_date?: string
          id?: string
          month_reference?: string
          payment_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_latest_scores: {
        Row: {
          client_id: string
          last_approval_rate: number | null
          last_calculated_at: string | null
          last_conversion_rate: number | null
          last_revenue_30d: number | null
          last_roas: number | null
          score_details: Json | null
          status: string | null
          total_score: number | null
        }
        Insert: {
          client_id: string
          last_approval_rate?: number | null
          last_calculated_at?: string | null
          last_conversion_rate?: number | null
          last_revenue_30d?: number | null
          last_roas?: number | null
          score_details?: Json | null
          status?: string | null
          total_score?: number | null
        }
        Update: {
          client_id?: string
          last_approval_rate?: number | null
          last_calculated_at?: string | null
          last_conversion_rate?: number | null
          last_revenue_30d?: number | null
          last_roas?: number | null
          score_details?: Json | null
          status?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_latest_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_latest_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pricing: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          key: string
          label: string
          section: string
          sort_order: number | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          key: string
          label: string
          section: string
          sort_order?: number | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          key?: string
          label?: string
          section?: string
          sort_order?: number | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_pricing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pricing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_quality_config: {
        Row: {
          client_id: string
          created_at: string | null
          enabled_checks: Json | null
          gate_on_write: boolean | null
          max_price_variance: number | null
          min_products_per_collection: number | null
          required_collections: Json | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          enabled_checks?: Json | null
          gate_on_write?: boolean | null
          max_price_variance?: number | null
          min_products_per_collection?: number | null
          required_collections?: Json | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          enabled_checks?: Json | null
          gate_on_write?: boolean | null
          max_price_variance?: number | null
          min_products_per_collection?: number | null
          required_collections?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_quality_config_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_quality_config_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_quality_runs: {
        Row: {
          client_id: string
          counts: Json
          created_at: string | null
          elapsed_seconds: number | null
          id: string
          results: Json
          run_at: string | null
          score: number
          triggered_by: string | null
        }
        Insert: {
          client_id: string
          counts: Json
          created_at?: string | null
          elapsed_seconds?: number | null
          id?: string
          results: Json
          run_at?: string | null
          score: number
          triggered_by?: string | null
        }
        Update: {
          client_id?: string
          counts?: Json
          created_at?: string | null
          elapsed_seconds?: number | null
          id?: string
          results?: Json
          run_at?: string | null
          score?: number
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_quality_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_quality_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_resources: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          resource_type: string
          title: string
          updated_at: string | null
          url: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          resource_type?: string
          title: string
          updated_at?: string | null
          url: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          resource_type?: string
          title?: string
          updated_at?: string | null
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_resources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_resources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_smart_data: {
        Row: {
          active_sheet: string | null
          client_id: string | null
          created_at: string | null
          id: string
          sheets: Json
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          active_sheet?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          sheets?: Json
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          active_sheet?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          sheets?: Json
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_smart_data_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_step_status: {
        Row: {
          client_id: string | null
          completed_at: string | null
          id: string
          status: string | null
          step_id: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          id?: string
          status?: string | null
          step_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          id?: string
          status?: string | null
          step_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_step_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_step_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tasks: {
        Row: {
          archived_at: string | null
          area: string | null
          assignee_id: string | null
          attachments: Json | null
          category: string | null
          checklist: Json | null
          client_id: string
          completed_at: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          drive_links: Json | null
          due_date: string | null
          id: string
          images: Json | null
          order_position: number | null
          priority: string
          product_id: string | null
          product_name: string | null
          project_type: string | null
          source: string | null
          status: string
          step_id: string | null
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          area?: string | null
          assignee_id?: string | null
          attachments?: Json | null
          category?: string | null
          checklist?: Json | null
          client_id: string
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          drive_links?: Json | null
          due_date?: string | null
          id?: string
          images?: Json | null
          order_position?: number | null
          priority?: string
          product_id?: string | null
          product_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string
          step_id?: string | null
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          area?: string | null
          assignee_id?: string | null
          attachments?: Json | null
          category?: string | null
          checklist?: Json | null
          client_id?: string
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          drive_links?: Json | null
          due_date?: string | null
          id?: string
          images?: Json | null
          order_position?: number | null
          priority?: string
          product_id?: string | null
          product_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string
          step_id?: string | null
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_kanban_columns: {
        Row: {
          color: string | null
          created_at: string
          id: string
          order_index: number | null
          title: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          order_index?: number | null
          title: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          order_index?: number | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_kanban_columns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          archived_at: string | null
          budget_range: string | null
          column_id: string | null
          created_at: string
          email: string | null
          gclid: string | null
          id: string
          landing_page: string | null
          lead_score: string | null
          lead_status: string
          name: string
          observations: string | null
          offer_detail: string | null
          phone: string | null
          product_interest: string | null
          project_timeline: string | null
          project_type: string | null
          referrer: string | null
          revenue: string | null
          site_url: string | null
          store_name: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          budget_range?: string | null
          column_id?: string | null
          created_at?: string
          email?: string | null
          gclid?: string | null
          id?: string
          landing_page?: string | null
          lead_score?: string | null
          lead_status?: string
          name: string
          observations?: string | null
          offer_detail?: string | null
          phone?: string | null
          product_interest?: string | null
          project_timeline?: string | null
          project_type?: string | null
          referrer?: string | null
          revenue?: string | null
          site_url?: string | null
          store_name?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          budget_range?: string | null
          column_id?: string | null
          created_at?: string
          email?: string | null
          gclid?: string | null
          id?: string
          landing_page?: string | null
          lead_score?: string | null
          lead_status?: string
          name?: string
          observations?: string | null
          offer_detail?: string | null
          phone?: string | null
          product_interest?: string | null
          project_timeline?: string | null
          project_type?: string | null
          referrer?: string | null
          revenue?: string | null
          site_url?: string | null
          store_name?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_requests: {
        Row: {
          area: string
          attachments: string[] | null
          client_id: string
          client_priority: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          internal_priority: string | null
          status: string
          task_id: string | null
          title: string
          triage_result: Json | null
          triaged_at: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          area: string
          attachments?: string[] | null
          client_id: string
          client_priority?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          internal_priority?: string | null
          status?: string
          task_id?: string | null
          title: string
          triage_result?: Json | null
          triaged_at?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          area?: string
          attachments?: string[] | null
          client_id?: string
          client_priority?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          internal_priority?: string | null
          status?: string
          task_id?: string | null
          title?: string
          triage_result?: Json | null
          triaged_at?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_customer_identity: {
        Row: {
          client_ids: string[]
          email_hash: string
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          stores_count: number
          total_orders_all_stores: number
          total_spent_all_stores_brl: number
          updated_at: string
        }
        Insert: {
          client_ids?: string[]
          email_hash: string
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          stores_count?: number
          total_orders_all_stores?: number
          total_spent_all_stores_brl?: number
          updated_at?: string
        }
        Update: {
          client_ids?: string[]
          email_hash?: string
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          stores_count?: number
          total_orders_all_stores?: number
          total_spent_all_stores_brl?: number
          updated_at?: string
        }
        Relationships: []
      }
      dw_customers: {
        Row: {
          avg_ticket: number | null
          city: string | null
          client_id: string
          country_code: string | null
          email: string | null
          email_hash: string | null
          email_marketing_consent: boolean | null
          first_name: string | null
          first_order_at: string | null
          id: string
          ingested_at: string
          last_name: string | null
          last_order_at: string | null
          phone: string | null
          phone_hash: string | null
          province_code: string | null
          raw_payload: Json | null
          shopify_created_at: string | null
          shopify_customer_id: number
          sms_marketing_consent: boolean | null
          total_orders: number
          total_spent: number
        }
        Insert: {
          avg_ticket?: number | null
          city?: string | null
          client_id: string
          country_code?: string | null
          email?: string | null
          email_hash?: string | null
          email_marketing_consent?: boolean | null
          first_name?: string | null
          first_order_at?: string | null
          id?: string
          ingested_at?: string
          last_name?: string | null
          last_order_at?: string | null
          phone?: string | null
          phone_hash?: string | null
          province_code?: string | null
          raw_payload?: Json | null
          shopify_created_at?: string | null
          shopify_customer_id: number
          sms_marketing_consent?: boolean | null
          total_orders?: number
          total_spent?: number
        }
        Update: {
          avg_ticket?: number | null
          city?: string | null
          client_id?: string
          country_code?: string | null
          email?: string | null
          email_hash?: string | null
          email_marketing_consent?: boolean | null
          first_name?: string | null
          first_order_at?: string | null
          id?: string
          ingested_at?: string
          last_name?: string | null
          last_order_at?: string | null
          phone?: string | null
          phone_hash?: string | null
          province_code?: string | null
          raw_payload?: Json | null
          shopify_created_at?: string | null
          shopify_customer_id?: number
          sms_marketing_consent?: boolean | null
          total_orders?: number
          total_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "dw_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_meta_accounts: {
        Row: {
          account_id: string
          business_name: string | null
          client_id: string | null
          currency: string | null
          last_synced_at: string | null
          name: string | null
          notes: string | null
          ownership: string | null
          raw_payload: Json | null
          status: number | null
        }
        Insert: {
          account_id: string
          business_name?: string | null
          client_id?: string | null
          currency?: string | null
          last_synced_at?: string | null
          name?: string | null
          notes?: string | null
          ownership?: string | null
          raw_payload?: Json | null
          status?: number | null
        }
        Update: {
          account_id?: string
          business_name?: string | null
          client_id?: string | null
          currency?: string | null
          last_synced_at?: string | null
          name?: string | null
          notes?: string | null
          ownership?: string | null
          raw_payload?: Json | null
          status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_meta_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_meta_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_meta_ads: {
        Row: {
          account_id: string
          ad_id: string
          adset_id: string
          call_to_action_type: string | null
          campaign_id: string
          client_id: string | null
          created_time: string | null
          creative_body: string | null
          creative_description: string | null
          creative_id: string | null
          creative_image_url: string | null
          creative_title: string | null
          creative_video_id: string | null
          destination_url: string | null
          effective_status: string | null
          last_synced_at: string
          name: string
          raw_payload: Json | null
          status: string | null
          updated_time: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          account_id: string
          ad_id: string
          adset_id: string
          call_to_action_type?: string | null
          campaign_id: string
          client_id?: string | null
          created_time?: string | null
          creative_body?: string | null
          creative_description?: string | null
          creative_id?: string | null
          creative_image_url?: string | null
          creative_title?: string | null
          creative_video_id?: string | null
          destination_url?: string | null
          effective_status?: string | null
          last_synced_at?: string
          name: string
          raw_payload?: Json | null
          status?: string | null
          updated_time?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          account_id?: string
          ad_id?: string
          adset_id?: string
          call_to_action_type?: string | null
          campaign_id?: string
          client_id?: string | null
          created_time?: string | null
          creative_body?: string | null
          creative_description?: string | null
          creative_id?: string | null
          creative_image_url?: string | null
          creative_title?: string | null
          creative_video_id?: string | null
          destination_url?: string | null
          effective_status?: string | null
          last_synced_at?: string
          name?: string
          raw_payload?: Json | null
          status?: string | null
          updated_time?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_meta_ads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "dw_meta_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "dw_meta_ads_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "dw_meta_adsets"
            referencedColumns: ["adset_id"]
          },
          {
            foreignKeyName: "dw_meta_ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dw_meta_campaigns"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "dw_meta_ads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_meta_ads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_meta_adsets: {
        Row: {
          account_id: string
          adset_id: string
          bid_amount: number | null
          bid_strategy: string | null
          campaign_id: string
          client_id: string | null
          created_time: string | null
          daily_budget: number | null
          effective_status: string | null
          end_time: string | null
          last_synced_at: string
          lifetime_budget: number | null
          name: string
          optimization_goal: string | null
          raw_payload: Json | null
          start_time: string | null
          status: string | null
          targeting: Json | null
          updated_time: string | null
        }
        Insert: {
          account_id: string
          adset_id: string
          bid_amount?: number | null
          bid_strategy?: string | null
          campaign_id: string
          client_id?: string | null
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          end_time?: string | null
          last_synced_at?: string
          lifetime_budget?: number | null
          name: string
          optimization_goal?: string | null
          raw_payload?: Json | null
          start_time?: string | null
          status?: string | null
          targeting?: Json | null
          updated_time?: string | null
        }
        Update: {
          account_id?: string
          adset_id?: string
          bid_amount?: number | null
          bid_strategy?: string | null
          campaign_id?: string
          client_id?: string | null
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          end_time?: string | null
          last_synced_at?: string
          lifetime_budget?: number | null
          name?: string
          optimization_goal?: string | null
          raw_payload?: Json | null
          start_time?: string | null
          status?: string | null
          targeting?: Json | null
          updated_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_meta_adsets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "dw_meta_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "dw_meta_adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dw_meta_campaigns"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "dw_meta_adsets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_meta_adsets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_meta_campaigns: {
        Row: {
          account_id: string
          campaign_id: string
          client_id: string | null
          created_time: string | null
          daily_budget: number | null
          effective_status: string | null
          last_synced_at: string
          lifetime_budget: number | null
          name: string
          objective: string | null
          raw_payload: Json | null
          start_time: string | null
          status: string | null
          stop_time: string | null
          updated_time: string | null
        }
        Insert: {
          account_id: string
          campaign_id: string
          client_id?: string | null
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          last_synced_at?: string
          lifetime_budget?: number | null
          name: string
          objective?: string | null
          raw_payload?: Json | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          updated_time?: string | null
        }
        Update: {
          account_id?: string
          campaign_id?: string
          client_id?: string | null
          created_time?: string | null
          daily_budget?: number | null
          effective_status?: string | null
          last_synced_at?: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          raw_payload?: Json | null
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          updated_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_meta_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "dw_meta_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "dw_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_meta_insights_daily: {
        Row: {
          account_id: string
          add_to_carts: number | null
          clicks: number | null
          client_id: string | null
          cpa: number | null
          cpc: number | null
          cpm: number | null
          ctr: number | null
          date: string
          entity_id: string
          entity_type: string
          frequency: number | null
          id: string
          impressions: number | null
          initiate_checkouts: number | null
          landing_page_views: number | null
          last_synced_at: string
          purchases: number | null
          purchases_value: number | null
          raw_payload: Json | null
          reach: number | null
          roas: number | null
          spend: number | null
          unique_clicks: number | null
          video_views: number | null
        }
        Insert: {
          account_id: string
          add_to_carts?: number | null
          clicks?: number | null
          client_id?: string | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          date: string
          entity_id: string
          entity_type: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          initiate_checkouts?: number | null
          landing_page_views?: number | null
          last_synced_at?: string
          purchases?: number | null
          purchases_value?: number | null
          raw_payload?: Json | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          unique_clicks?: number | null
          video_views?: number | null
        }
        Update: {
          account_id?: string
          add_to_carts?: number | null
          clicks?: number | null
          client_id?: string | null
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          date?: string
          entity_id?: string
          entity_type?: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          initiate_checkouts?: number | null
          landing_page_views?: number | null
          last_synced_at?: string
          purchases?: number | null
          purchases_value?: number | null
          raw_payload?: Json | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          unique_clicks?: number | null
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_meta_insights_daily_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "dw_meta_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "dw_meta_insights_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_meta_insights_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_order_items: {
        Row: {
          attached_to: string | null
          category: string | null
          client_id: string
          has_patches: boolean | null
          id: string
          is_attached: boolean | null
          is_personalized: boolean | null
          is_plus_size: boolean | null
          line_total: number
          model: string | null
          order_id: string
          pairing_id: string | null
          patch_titles: string[] | null
          patches_count: number | null
          personalization_name: string | null
          personalization_number: string | null
          price: number
          properties_json: Json | null
          quantity: number
          season: string | null
          season_year: number | null
          shopify_line_item_id: number
          shopify_product_id: number | null
          shopify_variant_id: number | null
          size: string | null
          sku: string | null
          team: string | null
          team_country: string | null
          title: string
          total_discount: number | null
          variant_title: string | null
          vendor: string | null
        }
        Insert: {
          attached_to?: string | null
          category?: string | null
          client_id: string
          has_patches?: boolean | null
          id?: string
          is_attached?: boolean | null
          is_personalized?: boolean | null
          is_plus_size?: boolean | null
          line_total: number
          model?: string | null
          order_id: string
          pairing_id?: string | null
          patch_titles?: string[] | null
          patches_count?: number | null
          personalization_name?: string | null
          personalization_number?: string | null
          price: number
          properties_json?: Json | null
          quantity: number
          season?: string | null
          season_year?: number | null
          shopify_line_item_id: number
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          size?: string | null
          sku?: string | null
          team?: string | null
          team_country?: string | null
          title: string
          total_discount?: number | null
          variant_title?: string | null
          vendor?: string | null
        }
        Update: {
          attached_to?: string | null
          category?: string | null
          client_id?: string
          has_patches?: boolean | null
          id?: string
          is_attached?: boolean | null
          is_personalized?: boolean | null
          is_plus_size?: boolean | null
          line_total?: number
          model?: string | null
          order_id?: string
          pairing_id?: string | null
          patch_titles?: string[] | null
          patches_count?: number | null
          personalization_name?: string | null
          personalization_number?: string | null
          price?: number
          properties_json?: Json | null
          quantity?: number
          season?: string | null
          season_year?: number | null
          shopify_line_item_id?: number
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          size?: string | null
          sku?: string | null
          team?: string | null
          team_country?: string | null
          title?: string
          total_discount?: number | null
          variant_title?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_order_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_order_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dw_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_orders: {
        Row: {
          cancelled_at: string | null
          channel: string | null
          client_id: string
          created_at: string
          currency: string
          email_hash: string | null
          email_marketing_consent: boolean | null
          enriched_at: string | null
          financial_status: string | null
          fulfillment_status: string | null
          id: string
          ingested_at: string
          items_count: number
          landing_site: string | null
          order_number: string | null
          processed_at: string | null
          raw_payload: Json | null
          referring_site: string | null
          ship_city: string | null
          ship_country: string | null
          ship_country_code: string | null
          ship_province: string | null
          ship_province_code: string | null
          ship_zip: string | null
          shopify_customer_id: number | null
          shopify_order_id: number
          sms_marketing_consent: boolean | null
          source_name: string | null
          subtotal_price: number | null
          ticket_band: string | null
          total_discounts: number | null
          total_price: number
          total_shipping: number | null
          total_tax: number | null
          units_count: number
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          cancelled_at?: string | null
          channel?: string | null
          client_id: string
          created_at: string
          currency: string
          email_hash?: string | null
          email_marketing_consent?: boolean | null
          enriched_at?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          ingested_at?: string
          items_count?: number
          landing_site?: string | null
          order_number?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          referring_site?: string | null
          ship_city?: string | null
          ship_country?: string | null
          ship_country_code?: string | null
          ship_province?: string | null
          ship_province_code?: string | null
          ship_zip?: string | null
          shopify_customer_id?: number | null
          shopify_order_id: number
          sms_marketing_consent?: boolean | null
          source_name?: string | null
          subtotal_price?: number | null
          ticket_band?: string | null
          total_discounts?: number | null
          total_price: number
          total_shipping?: number | null
          total_tax?: number | null
          units_count?: number
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          cancelled_at?: string | null
          channel?: string | null
          client_id?: string
          created_at?: string
          currency?: string
          email_hash?: string | null
          email_marketing_consent?: boolean | null
          enriched_at?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          ingested_at?: string
          items_count?: number
          landing_site?: string | null
          order_number?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          referring_site?: string | null
          ship_city?: string | null
          ship_country?: string | null
          ship_country_code?: string | null
          ship_province?: string | null
          ship_province_code?: string | null
          ship_zip?: string | null
          shopify_customer_id?: number | null
          shopify_order_id?: number
          sms_marketing_consent?: boolean | null
          source_name?: string | null
          subtotal_price?: number | null
          ticket_band?: string | null
          total_discounts?: number | null
          total_price?: number
          total_shipping?: number | null
          total_tax?: number | null
          units_count?: number
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_products: {
        Row: {
          category: string | null
          client_id: string
          compare_at_max: number | null
          compare_at_min: number | null
          created_at: string | null
          handle: string | null
          has_personalization: boolean | null
          id: string
          image_url: string | null
          images_count: number | null
          ingested_at: string
          model: string | null
          price_max: number | null
          price_min: number | null
          product_type: string | null
          published_at: string | null
          raw_payload: Json | null
          season: string | null
          season_year: number | null
          shopify_product_id: number
          status: string | null
          tags: string[] | null
          team: string | null
          team_country: string | null
          title: string
          updated_at: string | null
          variants_count: number | null
          vendor: string | null
        }
        Insert: {
          category?: string | null
          client_id: string
          compare_at_max?: number | null
          compare_at_min?: number | null
          created_at?: string | null
          handle?: string | null
          has_personalization?: boolean | null
          id?: string
          image_url?: string | null
          images_count?: number | null
          ingested_at?: string
          model?: string | null
          price_max?: number | null
          price_min?: number | null
          product_type?: string | null
          published_at?: string | null
          raw_payload?: Json | null
          season?: string | null
          season_year?: number | null
          shopify_product_id: number
          status?: string | null
          tags?: string[] | null
          team?: string | null
          team_country?: string | null
          title: string
          updated_at?: string | null
          variants_count?: number | null
          vendor?: string | null
        }
        Update: {
          category?: string | null
          client_id?: string
          compare_at_max?: number | null
          compare_at_min?: number | null
          created_at?: string | null
          handle?: string | null
          has_personalization?: boolean | null
          id?: string
          image_url?: string | null
          images_count?: number | null
          ingested_at?: string
          model?: string | null
          price_max?: number | null
          price_min?: number | null
          product_type?: string | null
          published_at?: string | null
          raw_payload?: Json | null
          season?: string | null
          season_year?: number | null
          shopify_product_id?: number
          status?: string | null
          tags?: string[] | null
          team?: string | null
          team_country?: string | null
          title?: string
          updated_at?: string | null
          variants_count?: number | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_sync_state: {
        Row: {
          backfill_completed_at: string | null
          backfill_from_date: string | null
          backfill_started_at: string | null
          client_id: string
          last_error: string | null
          last_run_at: string
          last_synced_order_created_at: string | null
          resource: string
          total_orders_synced: number
        }
        Insert: {
          backfill_completed_at?: string | null
          backfill_from_date?: string | null
          backfill_started_at?: string | null
          client_id: string
          last_error?: string | null
          last_run_at?: string
          last_synced_order_created_at?: string | null
          resource?: string
          total_orders_synced?: number
        }
        Update: {
          backfill_completed_at?: string | null
          backfill_from_date?: string | null
          backfill_started_at?: string | null
          client_id?: string
          last_error?: string | null
          last_run_at?: string
          last_synced_order_created_at?: string | null
          resource?: string
          total_orders_synced?: number
        }
        Relationships: [
          {
            foreignKeyName: "dw_sync_state_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_sync_state_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_connections: {
        Row: {
          access_token: string | null
          created_at: string | null
          expires_at: string | null
          fb_user_id: string | null
          id: string
          instagram_actor_id: string | null
          is_patriarch: boolean | null
          name: string | null
          page_id: string | null
          profile_name: string | null
          status: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          fb_user_id?: string | null
          id?: string
          instagram_actor_id?: string | null
          is_patriarch?: boolean | null
          name?: string | null
          page_id?: string | null
          profile_name?: string | null
          status?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          fb_user_id?: string | null
          id?: string
          instagram_actor_id?: string | null
          is_patriarch?: boolean | null
          name?: string | null
          page_id?: string | null
          profile_name?: string | null
          status?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          source: string
          status: string
          transaction_date: string
          type: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          source: string
          status: string
          transaction_date: string
          type: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          source?: string
          status?: string
          transaction_date?: string
          type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          currency: string | null
          frequency: string
          id: string
          is_active: boolean | null
          name: string
          payment_day: number | null
          workspace_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          name: string
          payment_day?: number | null
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          name?: string
          payment_day?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          currency: string
          date: string
          fetched_at: string
          rate: number
          source: string
        }
        Insert: {
          currency: string
          date: string
          fetched_at?: string
          rate: number
          source?: string
        }
        Update: {
          currency?: string
          date?: string
          fetched_at?: string
          rate?: number
          source?: string
        }
        Relationships: []
      }
      google_connections: {
        Row: {
          access_token: string
          created_at: string | null
          google_email: string
          google_name: string | null
          google_picture: string | null
          google_user_id: string
          id: string
          refresh_token: string | null
          scopes: string | null
          status: string | null
          token_expiry: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          google_email: string
          google_name?: string | null
          google_picture?: string | null
          google_user_id: string
          id?: string
          refresh_token?: string | null
          scopes?: string | null
          status?: string | null
          token_expiry: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          google_email?: string
          google_name?: string | null
          google_picture?: string | null
          google_user_id?: string
          id?: string
          refresh_token?: string | null
          scopes?: string | null
          status?: string | null
          token_expiry?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          clicks: number | null
          conversions: number | null
          cpa: number | null
          created_at: string | null
          date: string
          entity_id: string
          entity_type: string
          id: string
          impressions: number | null
          revenue: number | null
          roas: number | null
          spend: number | null
          updated_at: string | null
        }
        Insert: {
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          date: string
          entity_id: string
          entity_type?: string
          id?: string
          impressions?: number | null
          revenue?: number | null
          roas?: number | null
          spend?: number | null
          updated_at?: string | null
        }
        Update: {
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          date?: string
          entity_id?: string
          entity_type?: string
          id?: string
          impressions?: number | null
          revenue?: number | null
          roas?: number | null
          spend?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      integrations_config: {
        Row: {
          created_at: string | null
          credentials: Json
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          provider: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          credentials: Json
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          provider: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          provider?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_events: {
        Row: {
          created_at: string
          detalhe: string | null
          dispositivo: string | null
          evento: string
          id: string
          path: string | null
          referrer: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          dispositivo?: string | null
          evento: string
          id?: string
          path?: string | null
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          dispositivo?: string | null
          evento?: string
          id?: string
          path?: string | null
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      library_lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          sort_order: number | null
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      library_videos: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          list_id: string
          sort_order: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          list_id: string
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_url: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          list_id?: string
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_videos_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "library_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_videos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          client_name: string | null
          created_at: string
          id: string
          license_key: string
          shop_url: string
          status: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          id?: string
          license_key: string
          shop_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          id?: string
          license_key?: string
          shop_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      loom_recordings: {
        Row: {
          created_at: string
          duration_sec: number | null
          error_message: string | null
          id: number
          insights: Json | null
          llm_cost_usd: number | null
          llm_model: string | null
          loom_id: string
          loom_url: string
          processed_at: string | null
          recorded_at: string | null
          recorder_email: string | null
          recorder_name: string | null
          status: string
          title: string | null
          transcript: string | null
          vault_commit_sha: string | null
          vault_path: string | null
        }
        Insert: {
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          id?: number
          insights?: Json | null
          llm_cost_usd?: number | null
          llm_model?: string | null
          loom_id: string
          loom_url: string
          processed_at?: string | null
          recorded_at?: string | null
          recorder_email?: string | null
          recorder_name?: string | null
          status?: string
          title?: string | null
          transcript?: string | null
          vault_commit_sha?: string | null
          vault_path?: string | null
        }
        Update: {
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          id?: number
          insights?: Json | null
          llm_cost_usd?: number | null
          llm_model?: string | null
          loom_id?: string
          loom_url?: string
          processed_at?: string | null
          recorded_at?: string | null
          recorder_email?: string | null
          recorder_name?: string | null
          status?: string
          title?: string | null
          transcript?: string | null
          vault_commit_sha?: string | null
          vault_path?: string | null
        }
        Relationships: []
      }
      marketing_spend: {
        Row: {
          amount: number
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          created_at: string | null
          currency: string | null
          date: string
          id: string
          impressions: number | null
          platform: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          currency?: string | null
          date: string
          id?: string
          impressions?: number | null
          platform: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          impressions?: number | null
          platform?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_spend_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_reminders: {
        Row: {
          created_at: string
          google_event_id: string
          id: string
          meet_link: string | null
          occurrence_start: string
          phone_snapshot: string
          remind_10_at: string
          remind_30_at: string
          sent_10_at: string | null
          sent_30_at: string | null
          summary: string
          team_member_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          google_event_id: string
          id?: string
          meet_link?: string | null
          occurrence_start: string
          phone_snapshot: string
          remind_10_at: string
          remind_30_at: string
          sent_10_at?: string | null
          sent_30_at?: string | null
          summary: string
          team_member_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          google_event_id?: string
          id?: string
          meet_link?: string | null
          occurrence_start?: string
          phone_snapshot?: string
          remind_10_at?: string
          remind_30_at?: string
          sent_10_at?: string | null
          sent_30_at?: string | null
          summary?: string
          team_member_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reminders_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_reminders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_access_levels: {
        Row: {
          access_level_id: string
          member_id: string
        }
        Insert: {
          access_level_id: string
          member_id: string
        }
        Update: {
          access_level_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_access_levels_access_level_id_fkey"
            columns: ["access_level_id"]
            isOneToOne: false
            referencedRelation: "agency_access_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_access_levels_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_commissions: {
        Row: {
          client_id: string
          id: string
          member_id: string
          rate: number
        }
        Insert: {
          client_id: string
          id?: string
          member_id: string
          rate?: number
        }
        Update: {
          client_id?: string
          id?: string
          member_id?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_commissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          role_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          role_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "agency_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          metadata: Json | null
          title: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding: {
        Row: {
          assigned_cs: string | null
          assigned_designer: string | null
          assigned_tech: string | null
          assigned_traffic: string | null
          briefing_id: string | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          current_phase: string | null
          id: string
          notes: string | null
          portal_access_granted: boolean | null
          started_at: string | null
          status: string
          type: string
          updated_at: string | null
          whatsapp_group_created: boolean | null
        }
        Insert: {
          assigned_cs?: string | null
          assigned_designer?: string | null
          assigned_tech?: string | null
          assigned_traffic?: string | null
          briefing_id?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          current_phase?: string | null
          id?: string
          notes?: string | null
          portal_access_granted?: boolean | null
          started_at?: string | null
          status?: string
          type: string
          updated_at?: string | null
          whatsapp_group_created?: boolean | null
        }
        Update: {
          assigned_cs?: string | null
          assigned_designer?: string | null
          assigned_tech?: string | null
          assigned_traffic?: string | null
          briefing_id?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          current_phase?: string | null
          id?: string
          notes?: string | null
          portal_access_granted?: boolean | null
          started_at?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          whatsapp_group_created?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_jobs: {
        Row: {
          attempts: number
          claimed_at: string | null
          client_id: string | null
          client_name: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          logs: Json
          max_attempts: number
          next_check_at: string | null
          payload: Json | null
          result: Json | null
          shop_domain: string
          stage: string
          stage_updated_at: string
          started_at: string | null
          status: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          client_id?: string | null
          client_name: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json
          max_attempts?: number
          next_check_at?: string | null
          payload?: Json | null
          result?: Json | null
          shop_domain: string
          stage?: string
          stage_updated_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json
          max_attempts?: number
          next_check_at?: string | null
          payload?: Json | null
          result?: Json | null
          shop_domain?: string
          stage?: string
          stage_updated_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_phases: {
        Row: {
          completed_at: string | null
          due_date: string | null
          due_days_limit: number | null
          id: string
          notes: string | null
          onboarding_id: string
          parallel_group: string | null
          phase_key: string
          phase_name: string
          phase_order: number
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          due_date?: string | null
          due_days_limit?: number | null
          id?: string
          notes?: string | null
          onboarding_id: string
          parallel_group?: string | null
          phase_key: string
          phase_name: string
          phase_order?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          due_date?: string | null
          due_days_limit?: number | null
          id?: string
          notes?: string | null
          onboarding_id?: string
          parallel_group?: string | null
          phase_key?: string
          phase_name?: string
          phase_order?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_phases_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_runners: {
        Row: {
          created_at: string
          hostname: string | null
          last_heartbeat_at: string
          note: string | null
          runner_id: string
          session_ok: boolean
        }
        Insert: {
          created_at?: string
          hostname?: string | null
          last_heartbeat_at?: string
          note?: string | null
          runner_id: string
          session_ok?: boolean
        }
        Update: {
          created_at?: string
          hostname?: string | null
          last_heartbeat_at?: string
          note?: string | null
          runner_id?: string
          session_ok?: boolean
        }
        Relationships: []
      }
      onboarding_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          depends_on: string | null
          estimated_minutes: number | null
          id: string
          is_required: boolean | null
          phase_id: string
          status: string
          task_description: string | null
          task_key: string
          task_name: string
          task_order: number
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          depends_on?: string | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean | null
          phase_id: string
          status?: string
          task_description?: string | null
          task_key: string
          task_name: string
          task_order?: number
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          depends_on?: string | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean | null
          phase_id?: string
          status?: string
          task_description?: string | null
          task_key?: string
          task_name?: string
          task_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "onboarding_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_timeline: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          onboarding_id: string
          performed_by: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          onboarding_id: string
          performed_by?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          onboarding_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_timeline_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      one_off_receivables: {
        Row: {
          amount: number
          client_name: string
          created_at: string | null
          due_date: string
          id: string
          payment_method: string | null
          service: string
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          client_name: string
          created_at?: string | null
          due_date: string
          id?: string
          payment_method?: string | null
          service: string
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string | null
          due_date?: string
          id?: string
          payment_method?: string | null
          service?: string
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_off_receivables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      paperclip_action_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          error: Json | null
          id: string
          idempotency_key: string
          params: Json
          result: Json | null
          status: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          idempotency_key: string
          params?: Json
          result?: Json | null
          status: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          idempotency_key?: string
          params?: Json
          result?: Json | null
          status?: string
        }
        Relationships: []
      }
      partners_prolabore: {
        Row: {
          amount: number
          commission_percent: number | null
          created_at: string
          id: string
          name: string
          payment_day: number | null
          pix_key: string | null
          status: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          commission_percent?: number | null
          created_at?: string
          id?: string
          name: string
          payment_day?: number | null
          pix_key?: string | null
          status?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          commission_percent?: number | null
          created_at?: string
          id?: string
          name?: string
          payment_day?: number | null
          pix_key?: string | null
          status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_prolabore_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          cost_per_unit: number
          created_at: string | null
          currency: string | null
          id: string
          product_sku: string
          valid_from: string | null
          valid_to: string | null
          workspace_id: string | null
        }
        Insert: {
          cost_per_unit: number
          created_at?: string | null
          currency?: string | null
          id?: string
          product_sku: string
          valid_from?: string | null
          valid_to?: string | null
          workspace_id?: string | null
        }
        Update: {
          cost_per_unit?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          product_sku?: string
          valid_from?: string | null
          valid_to?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string | null
          full_name: string | null
          headline: string | null
          id: string
          instagram_handle: string | null
          phone: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          full_name?: string | null
          headline?: string | null
          id: string
          instagram_handle?: string | null
          phone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          instagram_handle?: string | null
          phone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      project_priorities: {
        Row: {
          client_id: string | null
          created_at: string
          due_date: string
          id: string
          priority_order: number
          start_date: string
          status: string
          title: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          priority_order?: number
          start_date?: string
          status?: string
          title: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          priority_order?: number
          start_date?: string
          status?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_priorities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_priorities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          approved: boolean
          author_location: string | null
          author_name: string
          body: string
          client_id: string
          created_at: string
          external_id: string | null
          helpful_count: number
          id: string
          photo_urls: string[]
          product_handle: string
          product_id: string | null
          rating: number
          source: string
          title: string | null
          updated_at: string
          verified_buyer: boolean
        }
        Insert: {
          approved?: boolean
          author_location?: string | null
          author_name: string
          body: string
          client_id: string
          created_at?: string
          external_id?: string | null
          helpful_count?: number
          id?: string
          photo_urls?: string[]
          product_handle: string
          product_id?: string | null
          rating: number
          source?: string
          title?: string | null
          updated_at?: string
          verified_buyer?: boolean
        }
        Update: {
          approved?: boolean
          author_location?: string | null
          author_name?: string
          body?: string
          client_id?: string
          created_at?: string
          external_id?: string | null
          helpful_count?: number
          id?: string
          photo_urls?: string[]
          product_handle?: string
          product_id?: string | null
          rating?: number
          source?: string
          title?: string | null
          updated_at?: string
          verified_buyer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          created_at: string | null
          goal_amount: number
          id: string
          month_reference: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          goal_amount?: number
          id?: string
          month_reference: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          goal_amount?: number
          id?: string
          month_reference?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_records: {
        Row: {
          balance_due_date: string | null
          client_name: string
          commission_pct: number | null
          created_at: string | null
          entry_amount: number
          entry_type: string | null
          id: string
          notes: string | null
          payment_method: string | null
          recurrence: string | null
          referral_name: string | null
          sale_date: string
          service: string | null
          sold_by: string | null
          status: string
          total_amount: number
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          balance_due_date?: string | null
          client_name: string
          commission_pct?: number | null
          created_at?: string | null
          entry_amount?: number
          entry_type?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          recurrence?: string | null
          referral_name?: string | null
          sale_date?: string
          service?: string | null
          sold_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          balance_due_date?: string | null
          client_name?: string
          commission_pct?: number | null
          created_at?: string | null
          entry_amount?: number
          entry_type?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          recurrence?: string | null
          referral_name?: string | null
          sale_date?: string
          service?: string | null
          sold_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          created_at: string | null
          destination_country: string | null
          id: string
          is_atrasado: boolean | null
          is_taxed: boolean | null
          last_event_description: string | null
          last_event_time: string | null
          needs_attention: boolean | null
          origin_country: string | null
          status: string
          sub_status: string | null
          tracking_number: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          destination_country?: string | null
          id?: string
          is_atrasado?: boolean | null
          is_taxed?: boolean | null
          last_event_description?: string | null
          last_event_time?: string | null
          needs_attention?: boolean | null
          origin_country?: string | null
          status?: string
          sub_status?: string | null
          tracking_number: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          destination_country?: string | null
          id?: string
          is_atrasado?: boolean | null
          is_taxed?: boolean | null
          last_event_description?: string | null
          last_event_time?: string | null
          needs_attention?: boolean | null
          origin_country?: string | null
          status?: string
          sub_status?: string | null
          tracking_number?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      store_deployments: {
        Row: {
          ai_config: Json | null
          briefing_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_log: Json | null
          id: string
          preview_data: Json | null
          source_brand_name: string | null
          source_client_id: string
          started_at: string | null
          status: string
          step_status: Json
          steps: Json
          target_brand_name: string | null
          target_client_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          ai_config?: Json | null
          briefing_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_log?: Json | null
          id?: string
          preview_data?: Json | null
          source_brand_name?: string | null
          source_client_id: string
          started_at?: string | null
          status?: string
          step_status?: Json
          steps?: Json
          target_brand_name?: string | null
          target_client_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          ai_config?: Json | null
          briefing_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_log?: Json | null
          id?: string
          preview_data?: Json | null
          source_brand_name?: string | null
          source_client_id?: string
          started_at?: string | null
          status?: string
          step_status?: Json
          steps?: Json
          target_brand_name?: string | null
          target_client_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_deployments_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_deployments_source_client_id_fkey"
            columns: ["source_client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_deployments_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_deployments_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_ia_images: {
        Row: {
          aspect_ratio: string
          client_id: string | null
          created_at: string
          id: string
          mime_type: string
          model: string
          prompt: string
          public_url: string
          storage_path: string
          workspace_id: string | null
        }
        Insert: {
          aspect_ratio?: string
          client_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string
          model: string
          prompt: string
          public_url: string
          storage_path: string
          workspace_id?: string | null
        }
        Update: {
          aspect_ratio?: string
          client_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string
          model?: string
          prompt?: string
          public_url?: string
          storage_path?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_ia_images_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_ia_images_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_ia_images_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action: string
          alert_status: string
          alerted_at: string | null
          context: Json
          created_at: string
          duration_ms: number | null
          environment: string
          error: Json | null
          error_signature: string | null
          function_name: string
          id: string
          message: string
          request_id: string | null
          resolution: Json | null
          resolved: boolean
          severity: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          alert_status?: string
          alerted_at?: string | null
          context?: Json
          created_at?: string
          duration_ms?: number | null
          environment?: string
          error?: Json | null
          error_signature?: string | null
          function_name: string
          id?: string
          message: string
          request_id?: string | null
          resolution?: Json | null
          resolved?: boolean
          severity?: string
          status: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          alert_status?: string
          alerted_at?: string | null
          context?: Json
          created_at?: string
          duration_ms?: number | null
          environment?: string
          error?: Json | null
          error_signature?: string | null
          function_name?: string
          id?: string
          message?: string
          request_id?: string | null
          resolution?: Json | null
          resolved?: boolean
          severity?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          alert_enabled: boolean
          alert_group_jid: string | null
          alert_group_name: string | null
          alert_instance_name: string | null
          id: number
          rate_limit_per_min: number
          updated_at: string
        }
        Insert: {
          alert_enabled?: boolean
          alert_group_jid?: string | null
          alert_group_name?: string | null
          alert_instance_name?: string | null
          id?: number
          rate_limit_per_min?: number
          updated_at?: string
        }
        Update: {
          alert_enabled?: boolean
          alert_group_jid?: string | null
          alert_group_name?: string | null
          alert_instance_name?: string | null
          id?: number
          rate_limit_per_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_columns: {
        Row: {
          color: string
          created_at: string
          hidden: boolean
          id: string
          position: number
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          hidden?: boolean
          id: string
          position?: number
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          hidden?: boolean
          id?: string
          position?: number
          title?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          task_id: string
          user_avatar: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          task_id: string
          user_avatar?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          task_id?: string
          user_avatar?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          base_salary: number | null
          commission_rate: number | null
          email: string
          id: string
          invited_at: string | null
          is_accounting_staff: boolean | null
          joined_at: string | null
          linked_client_id: string | null
          name: string | null
          phone: string | null
          pix_key: string | null
          role: string
          status: string
          user_id: string | null
          user_type: string | null
          whatsapp_notifications: boolean | null
          workspace_id: string | null
        }
        Insert: {
          base_salary?: number | null
          commission_rate?: number | null
          email: string
          id?: string
          invited_at?: string | null
          is_accounting_staff?: boolean | null
          joined_at?: string | null
          linked_client_id?: string | null
          name?: string | null
          phone?: string | null
          pix_key?: string | null
          role?: string
          status?: string
          user_id?: string | null
          user_type?: string | null
          whatsapp_notifications?: boolean | null
          workspace_id?: string | null
        }
        Update: {
          base_salary?: number | null
          commission_rate?: number | null
          email?: string
          id?: string
          invited_at?: string | null
          is_accounting_staff?: boolean | null
          joined_at?: string | null
          linked_client_id?: string | null
          name?: string | null
          phone?: string | null
          pix_key?: string | null
          role?: string
          status?: string
          user_id?: string | null
          user_type?: string | null
          whatsapp_notifications?: boolean | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_linked_client_id_fkey"
            columns: ["linked_client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      training_lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          sort_order: number | null
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      training_videos: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          list_id: string
          sort_order: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          list_id: string
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_url: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          list_id?: string
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_videos_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "training_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_videos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_costs: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          currency: string | null
          date: string
          description: string
          id: string
          related_transaction_id: string | null
          workspace_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          date: string
          description: string
          id?: string
          related_transaction_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string
          description?: string
          id?: string
          related_transaction_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variable_costs_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variable_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          client_id: string | null
          id: string
          payload: Json
          process_result: Json | null
          processed: boolean | null
          processed_at: string | null
          received_at: string | null
          shop_domain: string
          topic: string
          webhook_id: string | null
        }
        Insert: {
          client_id?: string | null
          id?: string
          payload: Json
          process_result?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          received_at?: string | null
          shop_domain: string
          topic: string
          webhook_id?: string | null
        }
        Update: {
          client_id?: string | null
          id?: string
          payload?: Json
          process_result?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          received_at?: string | null
          shop_domain?: string
          topic?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          callback_url: string
          client_id: string
          created_at: string | null
          enabled: boolean | null
          format: string | null
          id: string
          shopify_subscription_id: string | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          callback_url: string
          client_id: string
          created_at?: string | null
          enabled?: boolean | null
          format?: string | null
          id?: string
          shopify_subscription_id?: string | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          callback_url?: string
          client_id?: string
          created_at?: string | null
          enabled?: boolean | null
          format?: string | null
          id?: string
          shopify_subscription_id?: string | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          api_token: string | null
          created_at: string
          id: string
          instance_name: string
          phone_number: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          api_token?: string | null
          created_at?: string
          id?: string
          instance_name: string
          phone_number?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          api_token?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          phone_number?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          max_fb_profiles: number | null
          max_members: number | null
          name: string
          owner_id: string
          plan_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_fb_profiles?: number | null
          max_members?: number | null
          name: string
          owner_id: string
          plan_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_fb_profiles?: number | null
          max_members?: number | null
          name?: string
          owner_id?: string
          plan_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      dw_v_catalog_gap: {
        Row: {
          category: string | null
          client_id: string | null
          client_name: string | null
          price_min: number | null
          produto_criado_em: string | null
          shopify_product_id: number | null
          team: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_v_cross_store_customers: {
        Row: {
          client_ids: string[] | null
          email_hash: string | null
          first_seen_at: string | null
          last_seen_at: string | null
          store_names: string[] | null
          stores_count: number | null
          total_orders_all_stores: number | null
          total_spent_all_stores_brl: number | null
        }
        Insert: {
          client_ids?: string[] | null
          email_hash?: string | null
          first_seen_at?: string | null
          last_seen_at?: string | null
          store_names?: never
          stores_count?: number | null
          total_orders_all_stores?: number | null
          total_spent_all_stores_brl?: number | null
        }
        Update: {
          client_ids?: string[] | null
          email_hash?: string | null
          first_seen_at?: string | null
          last_seen_at?: string | null
          store_names?: never
          stores_count?: number | null
          total_orders_all_stores?: number | null
          total_spent_all_stores_brl?: number | null
        }
        Relationships: []
      }
      dw_v_customer_rfm: {
        Row: {
          avg_ticket: number | null
          client_id: string | null
          client_name: string | null
          country_code: string | null
          customer_id: string | null
          days_since_last_order: number | null
          email_hash: string | null
          first_name: string | null
          frequency: number | null
          last_purchase: string | null
          monetary: number | null
          province_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_v_geo_team_heatmap: {
        Row: {
          category: string | null
          orders: number | null
          revenue_brl: number | null
          ship_country_code: string | null
          ship_province_code: string | null
          team: string | null
          units: number | null
        }
        Relationships: []
      }
      dw_v_meta_vs_shopify_daily: {
        Row: {
          client_id: string | null
          client_name: string | null
          date: string | null
          meta_reported_purchases: number | null
          meta_reported_revenue: number | null
          meta_spend: number | null
          shopify_orders: number | null
          shopify_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_meta_insights_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_meta_insights_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_v_product_replication_gap: {
        Row: {
          category: string | null
          lojas: string[] | null
          lojas_vendendo: number | null
          team: string | null
          title: string | null
          total_vendas: number | null
        }
        Relationships: []
      }
      dw_v_sku_velocity: {
        Row: {
          category: string | null
          client_id: string | null
          client_name: string | null
          first_sold_at: string | null
          last_sold_at: string | null
          orders: number | null
          revenue_brl: number | null
          season: string | null
          shopify_product_id: number | null
          team: string | null
          title: string | null
          units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_order_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_order_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      dw_v_top_ads_30d: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          campaign_id: string | null
          clicks_30d: number | null
          client_id: string | null
          client_name: string | null
          creative_image_url: string | null
          creative_title: string | null
          impressions_30d: number | null
          purchases_30d: number | null
          revenue_30d: number | null
          roas_30d: number | null
          spend_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dw_meta_ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dw_meta_campaigns"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "dw_meta_ads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dw_meta_ads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
      v_agency_clients_visible: {
        Row: {
          assigned_products: string[] | null
          calculation_base: string | null
          cartpanda_bearer_token: string | null
          cartpanda_connected_at: string | null
          cartpanda_status: string | null
          cartpanda_store_name: string | null
          cartpanda_store_slug: string | null
          clarity_api_token: string | null
          clarity_connected_at: string | null
          clarity_project_id: string | null
          clarity_snippet_installed: boolean | null
          clarity_status: string | null
          client_type: string | null
          commission_rate: number | null
          created_at: string | null
          fee_fixed: number | null
          gateway_fee_fixed: number | null
          gateway_fee_percent: number | null
          id: string | null
          is_archived: boolean | null
          is_internal: boolean | null
          logo_url: string | null
          name: string | null
          onboarding_type: string | null
          payment_due_day: number | null
          primary_color: string | null
          product_unit_cost: number | null
          profit_fixed_costs: number | null
          profit_gateway_percent: number | null
          profit_tax_percent: number | null
          project_deadline: string | null
          project_name: string | null
          selected_ad_accounts: string[] | null
          shopify_access_token: string | null
          shopify_client_id: string | null
          shopify_client_secret: string | null
          shopify_connected_at: string | null
          shopify_domain: string | null
          shopify_shop_name: string | null
          shopify_status: string | null
          tax_percent: number | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_products?: string[] | null
          calculation_base?: string | null
          cartpanda_bearer_token?: string | null
          cartpanda_connected_at?: string | null
          cartpanda_status?: string | null
          cartpanda_store_name?: string | null
          cartpanda_store_slug?: string | null
          clarity_api_token?: string | null
          clarity_connected_at?: string | null
          clarity_project_id?: string | null
          clarity_snippet_installed?: boolean | null
          clarity_status?: string | null
          client_type?: string | null
          commission_rate?: number | null
          created_at?: string | null
          fee_fixed?: number | null
          gateway_fee_fixed?: number | null
          gateway_fee_percent?: number | null
          id?: string | null
          is_archived?: boolean | null
          is_internal?: boolean | null
          logo_url?: string | null
          name?: string | null
          onboarding_type?: string | null
          payment_due_day?: number | null
          primary_color?: string | null
          product_unit_cost?: number | null
          profit_fixed_costs?: number | null
          profit_gateway_percent?: number | null
          profit_tax_percent?: number | null
          project_deadline?: string | null
          project_name?: string | null
          selected_ad_accounts?: string[] | null
          shopify_access_token?: string | null
          shopify_client_id?: string | null
          shopify_client_secret?: string | null
          shopify_connected_at?: string | null
          shopify_domain?: string | null
          shopify_shop_name?: string | null
          shopify_status?: string | null
          tax_percent?: number | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_products?: string[] | null
          calculation_base?: string | null
          cartpanda_bearer_token?: string | null
          cartpanda_connected_at?: string | null
          cartpanda_status?: string | null
          cartpanda_store_name?: string | null
          cartpanda_store_slug?: string | null
          clarity_api_token?: string | null
          clarity_connected_at?: string | null
          clarity_project_id?: string | null
          clarity_snippet_installed?: boolean | null
          clarity_status?: string | null
          client_type?: string | null
          commission_rate?: number | null
          created_at?: string | null
          fee_fixed?: number | null
          gateway_fee_fixed?: number | null
          gateway_fee_percent?: number | null
          id?: string | null
          is_archived?: boolean | null
          is_internal?: boolean | null
          logo_url?: string | null
          name?: string | null
          onboarding_type?: string | null
          payment_due_day?: number | null
          primary_color?: string | null
          product_unit_cost?: number | null
          profit_fixed_costs?: number | null
          profit_gateway_percent?: number | null
          profit_tax_percent?: number | null
          project_deadline?: string | null
          project_name?: string | null
          selected_ad_accounts?: string[] | null
          shopify_access_token?: string | null
          shopify_client_id?: string | null
          shopify_client_secret?: string | null
          shopify_connected_at?: string | null
          shopify_domain?: string | null
          shopify_shop_name?: string | null
          shopify_status?: string | null
          tax_percent?: number | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_demand_requests_triaged: {
        Row: {
          area: string | null
          attachments: string[] | null
          client_id: string | null
          client_priority: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          internal_priority: string | null
          status: string | null
          task_id: string | null
          title: string | null
          triage_auto: boolean | null
          triage_complexity: string | null
          triage_confidence: number | null
          triage_result: Json | null
          triage_role: string | null
          triage_skill: string | null
          triage_type: string | null
          triaged_at: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          area?: string | null
          attachments?: string[] | null
          client_id?: string | null
          client_priority?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          internal_priority?: string | null
          status?: string | null
          task_id?: string | null
          title?: string | null
          triage_auto?: never
          triage_complexity?: never
          triage_confidence?: never
          triage_result?: Json | null
          triage_role?: never
          triage_skill?: never
          triage_type?: never
          triaged_at?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          area?: string | null
          attachments?: string[] | null
          client_id?: string | null
          client_priority?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          internal_priority?: string | null
          status?: string | null
          task_id?: string | null
          title?: string | null
          triage_auto?: never
          triage_complexity?: never
          triage_confidence?: never
          triage_result?: Json | null
          triage_role?: never
          triage_skill?: never
          triage_type?: never
          triaged_at?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reviews_summary: {
        Row: {
          avg_rating: number | null
          client_id: string | null
          latest_review_at: string | null
          product_handle: string | null
          reviews_with_photos: number | null
          total_reviews: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_agency_clients_visible"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _edge_function_url: { Args: { _name: string }; Returns: string }
      _get_internal_secret: { Args: never; Returns: string }
      check_is_agency_or_owner: {
        Args: { check_email: string }
        Returns: boolean
      }
      check_is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      check_user_workspace: {
        Args: { check_workspace_id: string }
        Returns: boolean
      }
      claim_onboarding_job: {
        Args: { p_worker_id: string }
        Returns: {
          attempts: number
          claimed_at: string | null
          client_id: string | null
          client_name: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          logs: Json
          max_attempts: number
          next_check_at: string | null
          payload: Json | null
          result: Json | null
          shop_domain: string
          stage: string
          stage_updated_at: string
          started_at: string | null
          status: string
          updated_at: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "onboarding_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_notification: {
        Args: {
          p_link?: string
          p_message?: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      create_workspace_for_user: {
        Args: {
          p_max_fb_profiles: number
          p_max_members: number
          p_name: string
          p_owner_id: string
          p_plan_type: string
        }
        Returns: {
          created_at: string | null
          id: string
          max_fb_profiles: number | null
          max_members: number | null
          name: string
          owner_id: string
          plan_type: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_lever_mcp_internal_secret: { Args: never; Returns: string }
      get_linked_client_id: { Args: { ws_id: string }; Returns: string }
      get_user_client_id: { Args: { check_email: string }; Returns: string }
      is_academy_admin: { Args: never; Returns: boolean }
      is_agency_admin: { Args: never; Returns: boolean }
      is_agency_member: { Args: { ws_id: string }; Returns: boolean }
      is_agency_staff: { Args: never; Returns: boolean }
      is_workspace_admin: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_portal_client: { Args: { ws_id: string }; Returns: boolean }
      list_all_private_lessons: {
        Args: never
        Returns: {
          created_at: string
          description: string
          id: string
          is_published: boolean
          sort_order: number
          student_count: number
          title: string
          video_url: string
        }[]
      }
      list_lesson_students: {
        Args: { target_lesson_id: string }
        Returns: {
          email: string
          full_name: string
          student_id: string
        }[]
      }
      list_student_private_lessons: {
        Args: { target_student_id: string }
        Returns: {
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean | null
          module_id: string | null
          sort_order: number | null
          student_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "academy_lessons"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mcp_audit_record: { Args: { p: Json }; Returns: undefined }
      mcp_lever_list_clients: {
        Args: {
          p_email: string
          p_include_archived?: boolean
          p_search?: string
        }
        Returns: Json
      }
      mcp_lever_my_recent_activity: {
        Args: { p_email: string; p_hours?: number; p_limit?: number }
        Returns: Json
      }
      mcp_lever_request_tool: {
        Args: { p: Json; p_email: string }
        Returns: Json
      }
      mcp_lever_team_activity: {
        Args: { p_email: string; p_hours?: number }
        Returns: Json
      }
      mcp_oauth_consume_code: {
        Args: { p_code_hash: string; p_kind: string }
        Returns: Json
      }
      mcp_oauth_consume_login_challenge: {
        Args: { p_challenge_hash: string }
        Returns: Json
      }
      mcp_oauth_create_code: { Args: { p: Json }; Returns: undefined }
      mcp_oauth_create_login_challenge: {
        Args: { p: Json }
        Returns: undefined
      }
      mcp_oauth_get_client: { Args: { p_client_id: string }; Returns: Json }
      mcp_oauth_is_allowed: { Args: { p_email: string }; Returns: boolean }
      mcp_oauth_log: {
        Args: {
          p_ctx: Json
          p_endpoint: string
          p_message: string
          p_status: number
        }
        Returns: undefined
      }
      mcp_oauth_register_client: { Args: { p: Json }; Returns: Json }
      mcp_oauth_touch_client: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      paperclip_convert_lead: {
        Args: {
          p_assigned_products?: string[]
          p_client_type?: string
          p_lead_id: string
        }
        Returns: Json
      }
      paperclip_workspace_summary: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      redeem_academy_invite: {
        Args: { invite_token: string }
        Returns: {
          error: string
          module_id: string
          module_slug: string
          module_title: string
          success: boolean
        }[]
      }
      resolve_client_identity: {
        Args: { user_email: string }
        Returns: {
          p_client_id: string
          p_client_name: string
          p_user_type: string
          p_workspace_id: string
        }[]
      }
      validar_licenca: {
        Args: { p_key: string; p_shop: string }
        Returns: boolean
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
    Enums: {},
  },
} as const
