export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendees: {
        Row: {
          bidder_number: number | null
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string | null
          contact_id: string | null
          created_at: string
          display_name: string
          event_id: string
          id: string
          invitation_id: string | null
          is_plus_one: boolean
          is_walk_in: boolean
          pass_token: string
        }
        Insert: {
          bidder_number?: number | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          contact_id?: string | null
          created_at?: string
          display_name: string
          event_id: string
          id?: string
          invitation_id?: string | null
          is_plus_one?: boolean
          is_walk_in?: boolean
          pass_token: string
        }
        Update: {
          bidder_number?: number | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          contact_id?: string | null
          created_at?: string
          display_name?: string
          event_id?: string
          id?: string
          invitation_id?: string | null
          is_plus_one?: boolean
          is_walk_in?: boolean
          pass_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendees_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          closes_at: string | null
          created_at: string
          display_key: string
          display_mode: string
          event_id: string
          id: string
          increment_table: Json
          mode: Database["public"]["Enums"]["auction_mode"]
          opens_at: string | null
          soft_close_seconds: number
          spotlight_lot_id: string | null
          terms_version: string
          title: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          display_key?: string
          display_mode?: string
          event_id: string
          id?: string
          increment_table?: Json
          mode?: Database["public"]["Enums"]["auction_mode"]
          opens_at?: string | null
          soft_close_seconds?: number
          spotlight_lot_id?: string | null
          terms_version?: string
          title?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          display_key?: string
          display_mode?: string
          event_id?: string
          id?: string
          increment_table?: Json
          mode?: Database["public"]["Enums"]["auction_mode"]
          opens_at?: string | null
          soft_close_seconds?: number
          spotlight_lot_id?: string | null
          terms_version?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "auctions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_spotlight_fk"
            columns: ["spotlight_lot_id"]
            isOneToOne: false
            referencedRelation: "lot_state"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "auctions_spotlight_fk"
            columns: ["spotlight_lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity: string
          entity_id: string | null
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity: string
          entity_id?: string | null
          id?: number
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          metadata?: Json
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          attendee_id: string
          id: string
          is_proxy: boolean
          lot_id: string
          placed_at: string
          placed_by_user_id: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount: number
          attendee_id: string
          id?: string
          is_proxy?: boolean
          lot_id: string
          placed_at?: string
          placed_by_user_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount?: number
          attendee_id?: string
          id?: string
          is_proxy?: boolean
          lot_id?: string
          placed_at?: string
          placed_by_user_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_state"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "bids_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_placed_by_user_id_fkey"
            columns: ["placed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          audience: Json
          author_id: string | null
          body: string
          channels: Database["public"]["Enums"]["delivery_channel"][]
          created_at: string
          event_id: string
          id: string
          scheduled_at: string | null
          sent_at: string | null
        }
        Insert: {
          audience?: Json
          author_id?: string | null
          body: string
          channels?: Database["public"]["Enums"]["delivery_channel"][]
          created_at?: string
          event_id: string
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
        }
        Update: {
          audience?: Json
          author_id?: string | null
          body?: string
          channels?: Database["public"]["Enums"]["delivery_channel"][]
          created_at?: string
          event_id?: string
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          channel: Database["public"]["Enums"]["delivery_channel"] | null
          contact_id: string
          granted_at: string
          id: string
          purpose: string
          revoked_at: string | null
          source: string | null
          wording_version: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["delivery_channel"] | null
          contact_id: string
          granted_at?: string
          id?: string
          purpose: string
          revoked_at?: string | null
          source?: string | null
          wording_version: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["delivery_channel"] | null
          contact_id?: string
          granted_at?: string
          id?: string
          purpose?: string
          revoked_at?: string | null
          source?: string | null
          wording_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          alumni_year: number | null
          created_at: string
          department_id: string
          donor_tier: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          organisation: string | null
          phone_e164: string | null
          tags: string[]
          title: string | null
          updated_at: string
          whatsapp_opt_in: boolean
        }
        Insert: {
          alumni_year?: number | null
          created_at?: string
          department_id: string
          donor_tier?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          organisation?: string | null
          phone_e164?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          whatsapp_opt_in?: boolean
        }
        Update: {
          alumni_year?: number | null
          created_at?: string
          department_id?: string
          donor_tier?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          organisation?: string | null
          phone_e164?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contacts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      event_questions: {
        Row: {
          event_id: string
          id: string
          label: string
          options: Json | null
          required: boolean
          sort_order: number
          type: string
        }
        Insert: {
          event_id: string
          id?: string
          label: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          type: string
        }
        Update: {
          event_id?: string
          id?: string
          label?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          allow_plus_ones: boolean
          auction_enabled: boolean
          banner_url: string | null
          branding: Json
          capacity: number | null
          created_at: string
          created_by: string | null
          department_id: string
          description: string | null
          ends_at: string | null
          id: string
          rsvp_deadline: string | null
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          allow_plus_ones?: boolean
          auction_enabled?: boolean
          banner_url?: string | null
          branding?: Json
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string | null
          ends_at?: string | null
          id?: string
          rsvp_deadline?: string | null
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          allow_plus_ones?: boolean
          auction_enabled?: boolean
          banner_url?: string | null
          branding?: Json
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          rsvp_deadline?: string | null
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          contact_id: string
          created_at: string
          event_id: string
          first_sent_at: string | null
          id: string
          opened_at: string | null
          responded_at: string | null
          sent_via: Database["public"]["Enums"]["delivery_channel"][]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          event_id: string
          first_sent_at?: string | null
          id?: string
          opened_at?: string | null
          responded_at?: string | null
          sent_via?: Database["public"]["Enums"]["delivery_channel"][]
          status?: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          event_id?: string
          first_sent_at?: string | null
          id?: string
          opened_at?: string | null
          responded_at?: string | null
          sent_via?: Database["public"]["Enums"]["delivery_channel"][]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          auction_id: string
          buy_now_price: number | null
          closes_at: string | null
          created_at: string
          description: string | null
          donor_name: string | null
          id: string
          images: string[]
          lot_number: number
          opens_at: string | null
          reserve: number | null
          sort_order: number
          starting_bid: number
          status: Database["public"]["Enums"]["lot_status"]
          title: string
        }
        Insert: {
          auction_id: string
          buy_now_price?: number | null
          closes_at?: string | null
          created_at?: string
          description?: string | null
          donor_name?: string | null
          id?: string
          images?: string[]
          lot_number: number
          opens_at?: string | null
          reserve?: number | null
          sort_order?: number
          starting_bid: number
          status?: Database["public"]["Enums"]["lot_status"]
          title: string
        }
        Update: {
          auction_id?: string
          buy_now_price?: number | null
          closes_at?: string | null
          created_at?: string
          description?: string | null
          donor_name?: string | null
          id?: string
          images?: string[]
          lot_number?: number
          opens_at?: string | null
          reserve?: number | null
          sort_order?: number
          starting_bid?: number
          status?: Database["public"]["Enums"]["lot_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deliveries: {
        Row: {
          attendee_id: string | null
          broadcast_id: string | null
          channel: Database["public"]["Enums"]["delivery_channel"]
          contact_id: string | null
          created_at: string
          error: string | null
          event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          provider: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          attendee_id?: string | null
          broadcast_id?: string | null
          channel: Database["public"]["Enums"]["delivery_channel"]
          contact_id?: string | null
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["message_kind"]
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          attendee_id?: string | null
          broadcast_id?: string | null
          channel?: Database["public"]["Enums"]["delivery_channel"]
          contact_id?: string | null
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_broadcast_fk"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          answers: Json
          attending: boolean
          guest_count: number
          id: string
          invitation_id: string
          responded_at: string
          whatsapp_opt_in: boolean
        }
        Insert: {
          answers?: Json
          attending: boolean
          guest_count?: number
          id?: string
          invitation_id: string
          responded_at?: string
          whatsapp_opt_in?: boolean
        }
        Update: {
          answers?: Json
          attending?: boolean
          guest_count?: number
          id?: string
          invitation_id?: string
          responded_at?: string
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          attendee_id: string
          checkout_url: string | null
          created_at: string
          id: string
          invoice_url: string | null
          lot_id: string
          paid_at: string | null
          payment_provider: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["settlement_status"]
        }
        Insert: {
          amount: number
          attendee_id: string
          checkout_url?: string | null
          created_at?: string
          id?: string
          invoice_url?: string | null
          lot_id: string
          paid_at?: string | null
          payment_provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
        }
        Update: {
          amount?: number
          attendee_id?: string
          checkout_url?: string | null
          created_at?: string
          id?: string
          invoice_url?: string | null
          lot_id?: string
          paid_at?: string | null
          payment_provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
        }
        Relationships: [
          {
            foreignKeyName: "settlements_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: true
            referencedRelation: "lot_state"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "settlements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: true
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      auction_totals: {
        Row: {
          auction_id: string | null
          lots_with_bids: number | null
          total_raised: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_state: {
        Row: {
          auction_id: string | null
          bid_count: number | null
          closes_at: string | null
          high_bid: number | null
          high_bidder_number: number | null
          lot_id: string | null
          lot_number: number | null
          reserve: number | null
          starting_bid: number | null
          status: Database["public"]["Enums"]["lot_status"] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_department: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      bid_step: { Args: { p_current: number; p_table: Json }; Returns: number }
      check_in_attendee: {
        Args: { p_attendee_id: string; p_event_id?: string; p_staff_id: string }
        Returns: {
          bidder_number: number
          checked_in_at: string
          display_name: string
          result: string
        }[]
      }
      close_due_lots: { Args: never; Returns: number }
      is_operator: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_actor_id: string
          p_entity: string
          p_entity_id?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      next_min_bid: { Args: { p_lot_id: string }; Returns: number }
      notify_broadcast: { Args: { p_broadcast_id: string }; Returns: undefined }
      place_bid: {
        Args: {
          p_amount: number
          p_attendee_id: string
          p_is_proxy?: boolean
          p_lot_id: string
          p_staff_id?: string
        }
        Returns: {
          bid_id: string
          closes_at: string
          high_bid: number
          next_min: number
          result: string
        }[]
      }
      realtime_selftest: { Args: never; Returns: string }
      set_display_mode: {
        Args: { p_auction_id: string; p_lot_id?: string; p_mode: string }
        Returns: {
          closes_at: string | null
          created_at: string
          display_key: string
          display_mode: string
          event_id: string
          id: string
          increment_table: Json
          mode: Database["public"]["Enums"]["auction_mode"]
          opens_at: string | null
          soft_close_seconds: number
          spotlight_lot_id: string | null
          terms_version: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "auctions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_lot_status: {
        Args: {
          p_closes_at?: string
          p_lot_id: string
          p_status: Database["public"]["Enums"]["lot_status"]
        }
        Returns: {
          auction_id: string
          buy_now_price: number | null
          closes_at: string | null
          created_at: string
          description: string | null
          donor_name: string | null
          id: string
          images: string[]
          lot_number: number
          opens_at: string | null
          reserve: number | null
          sort_order: number
          starting_bid: number
          status: Database["public"]["Enums"]["lot_status"]
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_bid: {
        Args: { p_bid_id: string; p_reason: string; p_staff_id: string }
        Returns: {
          high_bid: number
          high_bidder_number: number
          next_min: number
          result: string
        }[]
      }
    }
    Enums: {
      auction_mode: "silent" | "live"
      delivery_channel: "email" | "whatsapp" | "sms" | "in_app"
      delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "bounced"
      event_status: "draft" | "published" | "live" | "closed" | "archived"
      invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "waitlisted"
        | "cancelled"
      lot_status: "upcoming" | "open" | "closed" | "unsold" | "withdrawn"
      message_kind:
        | "invite"
        | "reminder"
        | "pass"
        | "broadcast"
        | "outbid"
        | "winner"
        | "receipt"
      settlement_status: "pending" | "paid" | "overdue" | "waived"
      user_role:
        | "platform_admin"
        | "organiser"
        | "door_staff"
        | "auction_operator"
        | "finance"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      auction_mode: ["silent", "live"],
      delivery_channel: ["email", "whatsapp", "sms", "in_app"],
      delivery_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "bounced",
      ],
      event_status: ["draft", "published", "live", "closed", "archived"],
      invitation_status: [
        "pending",
        "accepted",
        "declined",
        "waitlisted",
        "cancelled",
      ],
      lot_status: ["upcoming", "open", "closed", "unsold", "withdrawn"],
      message_kind: [
        "invite",
        "reminder",
        "pass",
        "broadcast",
        "outbid",
        "winner",
        "receipt",
      ],
      settlement_status: ["pending", "paid", "overdue", "waived"],
      user_role: [
        "platform_admin",
        "organiser",
        "door_staff",
        "auction_operator",
        "finance",
      ],
    },
  },
} as const

