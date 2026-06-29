-- Supabase schema for Bếp Sỉ Báo Cáo business sync.
-- Run this in Supabase SQL Editor if sync reports missing tables or columns.

create table if not exists mcp_routes (
  id text primary key,
  route_name text,
  weekday integer,
  area text,
  distributor_id text,
  active boolean default true,
  note text,
  sync_status text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz
);

create table if not exists mcp_route_customers (
  id text primary key,
  route_id text,
  customer_id text,
  customer_name text,
  phone text,
  area text,
  address text,
  sort_order integer,
  active boolean default true,
  note text,
  geo_lat double precision,
  geo_lng double precision,
  geo_accuracy double precision,
  geo_captured_at timestamptz,
  geo_source text,
  google_maps_url text,
  sync_status text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz
);

create table if not exists mcp_route_sessions (
  id text primary key,
  route_id text,
  route_name text,
  session_date date,
  weekday integer,
  sales text,
  area text,
  status text,
  planned_customers integer default 0,
  visited_customers integer default 0,
  order_count integer default 0,
  test_count integer default 0,
  report_count integer default 0,
  note text,
  sync_status text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz
);

create table if not exists mcp_visits (
  id text primary key,
  session_id text,
  route_id text,
  route_customer_id text,
  visit_date date,
  status text,
  has_order boolean default false,
  has_test boolean default false,
  has_report boolean default false,
  order_id text,
  test_id text,
  report_id text,
  checkin_at timestamptz,
  note text,
  sync_status text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz
);

create table if not exists orders (
  id text primary key,
  order_code text,
  order_date date,
  sales text,
  customer_id text,
  customer_name text,
  customer_phone text,
  area text,
  delivery_address text,
  source_type text,
  source_id text,
  status text,
  subtotal numeric default 0,
  discount_total numeric default 0,
  grand_total numeric default 0,
  note text,
  sync_status text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz
);

create table if not exists order_items (
  id text primary key,
  order_id text,
  product_id text,
  product_name text,
  sku text,
  unit text,
  quantity numeric default 1,
  unit_price numeric default 0,
  discount numeric default 0,
  line_total numeric default 0,
  note text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz
);

create table if not exists market_reports (
  id text primary key,
  report_date date,
  sales text,
  market_area text,
  route_name text,
  market_type text,
  total_shops integer default 0,
  competitor_summary text,
  price_summary text,
  demand_summary text,
  company_product_summary text,
  opportunity_summary text,
  risk_summary text,
  next_action text,
  note text,
  sync_status text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz
);

create index if not exists idx_mcp_route_customers_route_id on mcp_route_customers(route_id);
create index if not exists idx_mcp_sessions_route_date on mcp_route_sessions(route_id, session_date);
create index if not exists idx_mcp_visits_session_id on mcp_visits(session_id);
create index if not exists idx_mcp_visits_customer_id on mcp_visits(route_customer_id);
create index if not exists idx_orders_order_date on orders(order_date);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_market_reports_report_date on market_reports(report_date);
