// ============================================================
// OpenPayUPI — TypeScript Database Types
// Matches the @supabase/supabase-js generic constraint exactly.
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "EXPIRED"
  | "MANUAL_VERIFICATION"
  | "PARTIAL_PAID";

export type VerifiedVia = "SMS" | "EMAIL" | "OCR" | "MANUAL";
export type KeyType = "CLIENT" | "DEVICE";
export type DeviceStatus = "ONLINE" | "OFFLINE";
export type DeviceType = "TERMUX" | "APP";

// ── Per-table row types (convenience exports) ──────────────────────────
export interface VpaRow {
  id: string;
  vpa_address: string;
  payee_name: string;
  daily_tx_count: number;
  max_daily_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  id: string;
  key_name: string;
  key_value: string;
  key_type: KeyType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  order_id_ext: string;
  base_amount: number;
  dynamic_amount: number;
  vpa_id: string;
  status: OrderStatus;
  verified_via: VerifiedVia | null;
  upi_utr: string | null;
  client_callback_url: string | null;
  return_url: string | null;
  customer_mobile: string | null;
  api_key_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceTelemetryRow {
  id: string;
  device_name: string;
  last_ping_at: string;
  status: DeviceStatus;
  device_type: DeviceType | null;
  created_at: string;
  updated_at: string;
}

export interface UtrLedgerRow {
  id: string;
  utr_hash: string;
  order_id: string;
  verified_at: string;
  created_at: string;
}

// ── Full Database type (satisfies Supabase generic constraint) ─────────
export interface Database {
  public: {
    Tables: {
      vpas: {
        Row: VpaRow;
        Insert: {
          id?: string;
          vpa_address: string;
          payee_name: string;
          daily_tx_count?: number;
          max_daily_limit?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vpa_address?: string;
          payee_name?: string;
          daily_tx_count?: number;
          max_daily_limit?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: ApiKeyRow;
        Insert: {
          id?: string;
          key_name: string;
          key_value: string;
          key_type: KeyType;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key_name?: string;
          key_value?: string;
          key_type?: KeyType;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: {
          id?: string;
          order_id_ext: string;
          base_amount: number;
          dynamic_amount: number;
          vpa_id: string;
          status?: OrderStatus;
          verified_via?: VerifiedVia | null;
          upi_utr?: string | null;
          client_callback_url?: string | null;
          return_url?: string | null;
          customer_mobile?: string | null;
          api_key_id?: string | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id_ext?: string;
          base_amount?: number;
          dynamic_amount?: number;
          vpa_id?: string;
          status?: OrderStatus;
          verified_via?: VerifiedVia | null;
          upi_utr?: string | null;
          client_callback_url?: string | null;
          return_url?: string | null;
          customer_mobile?: string | null;
          api_key_id?: string | null;
          expires_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_vpa_id_fkey";
            columns: ["vpa_id"];
            isOneToOne: false;
            referencedRelation: "vpas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_api_key_id_fkey";
            columns: ["api_key_id"];
            isOneToOne: false;
            referencedRelation: "api_keys";
            referencedColumns: ["id"];
          }
        ];
      };
      device_telemetry: {
        Row: DeviceTelemetryRow;
        Insert: {
          id?: string;
          device_name: string;
          last_ping_at?: string;
          status?: DeviceStatus;
          device_type?: DeviceType | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_name?: string;
          last_ping_at?: string;
          status?: DeviceStatus;
          device_type?: DeviceType | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      utr_ledger: {
        Row: UtrLedgerRow;
        Insert: {
          id?: string;
          utr_hash: string;
          order_id: string;
          verified_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          utr_hash?: string;
          order_id?: string;
          verified_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "utr_ledger_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      order_status_enum: OrderStatus;
      verified_via_enum: VerifiedVia;
      key_type_enum: KeyType;
      device_status_enum: DeviceStatus;
      device_type_enum: DeviceType;
    };
    CompositeTypes: Record<string, never>;
  };
}
