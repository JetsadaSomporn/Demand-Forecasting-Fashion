-- Fashion Demand Forecast Demo schema for Supabase/Postgres
-- ---------------------------------------------------------
-- Execute inside your Supabase project (SQL editor, psql, etc.).
-- This script provisions required tables, constraints, and storage
-- buckets used by the Next.js application.

-- Extensions ----------------------------------------------------------
create extension if not exists "pgcrypto";

-- Helper function (UTC timestamp) ------------------------------------
create or replace function public.utcnow()
  returns timestamptz
  language sql
  stable
as $$
  select timezone('utc', now());
$$;

-- PROFILES -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default public.utcnow()
);

comment on table public.profiles is 'User profile data mirrored from Supabase Auth.';

-- PRODUCTS -----------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  title text,
  category text not null,
  color text not null,
  sizes text not null,
  cost numeric(12,2) not null check (cost >= 0),
  first_sale_month date not null,
  image_url text,
  created_at timestamptz not null default public.utcnow()
);

create index if not exists products_category_idx on public.products (lower(category));
create index if not exists products_color_idx on public.products (lower(color));

-- SALES HISTORY ------------------------------------------------------
create table if not exists public.sales_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  month date not null,
  qty integer not null check (qty >= 0),
  created_at timestamptz not null default public.utcnow(),
  constraint sales_history_unique_month unique (product_id, month)
);

create index if not exists sales_history_product_idx on public.sales_history (product_id);
create index if not exists sales_history_month_idx on public.sales_history (month);

-- FORECASTS ----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'forecast_model') then
    create type public.forecast_model as enum ('lgbm_full', 'lgbm_meta');
  end if;
end
$$;

create table if not exists public.forecasts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  model_name public.forecast_model not null,
  horizon smallint not null check (horizon between 1 and 12),
  params jsonb not null default '{}'::jsonb,
  y_true jsonb,
  y_pred jsonb not null,
  metrics jsonb,
  months jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default public.utcnow(),
  constraint forecasts_y_pred_is_array check (jsonb_typeof(y_pred) = 'array'),
  constraint forecasts_months_is_array check (jsonb_typeof(months) = 'array')
);

create index if not exists forecasts_product_idx on public.forecasts (product_id);
create index if not exists forecasts_created_idx on public.forecasts (created_at desc);
create index if not exists forecasts_model_idx on public.forecasts (model_name);

-- AI EXTRACTED META --------------------------------------------------
create table if not exists public.ai_extracted_meta (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  raw_json jsonb,
  color text,
  style text,
  confidence numeric(5,4) check (confidence between 0 and 1),
  created_at timestamptz not null default public.utcnow()
);

create index if not exists ai_meta_product_idx on public.ai_extracted_meta (product_id);
create index if not exists ai_meta_created_idx on public.ai_extracted_meta (created_at desc);

-- PROFILE AUTO-CREATION --------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name);
  return new;
end;
$$;

drop trigger if exists handle_new_user on auth.users;
create trigger handle_new_user
after insert on auth.users
for each row execute function public.handle_new_user();

-- SETTINGS (workspace defaults) -------------------------------------
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  brand_name text not null,
  timezone text not null,
  currency text not null default 'THB',
  created_at timestamptz not null default public.utcnow(),
  updated_at timestamptz not null default public.utcnow()
);

create unique index if not exists settings_singleton_idx on public.settings ((true));

create or replace function public.settings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := public.utcnow();
  return new;
end;
$$;

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.settings_touch_updated_at();

-- ROW LEVEL SECURITY -------------------------------------------------
-- Supabase enables RLS by default. These policies grant authenticated
-- users access to their own content, while anonymous users remain read-only.
-- If you need stricter ownership, consider adding a created_by column
-- and adjusting policies accordingly.

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales_history enable row level security;
alter table public.forecasts enable row level security;
alter table public.ai_extracted_meta enable row level security;
alter table public.settings enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Profiles insert by owner" on public.profiles;
create policy "Profiles insert by owner"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Profiles insert service role" on public.profiles;
create policy "Profiles insert service role"
  on public.profiles
  for insert
  to service_role
  with check (true);

drop policy if exists "Products readable by authenticated" on public.products;
create policy "Products readable by authenticated"
  on public.products for select using (auth.role() = 'authenticated');

drop policy if exists "Products insert by authenticated" on public.products;
create policy "Products insert by authenticated"
  on public.products for insert with check (auth.role() = 'authenticated');

drop policy if exists "Products update by authenticated" on public.products;
create policy "Products update by authenticated"
  on public.products for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Products delete by authenticated" on public.products;
create policy "Products delete by authenticated"
  on public.products for delete using (auth.role() = 'authenticated');

drop policy if exists "Sales history readable by authenticated" on public.sales_history;
create policy "Sales history readable by authenticated"
  on public.sales_history for select using (auth.role() = 'authenticated');

drop policy if exists "Sales history write by authenticated" on public.sales_history;
create policy "Sales history write by authenticated"
  on public.sales_history for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Forecasts readable by authenticated" on public.forecasts;
create policy "Forecasts readable by authenticated"
  on public.forecasts for select using (auth.role() = 'authenticated');

drop policy if exists "Forecasts write by authenticated" on public.forecasts;
create policy "Forecasts write by authenticated"
  on public.forecasts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "AI meta readable by authenticated" on public.ai_extracted_meta;
create policy "AI meta readable by authenticated"
  on public.ai_extracted_meta for select using (auth.role() = 'authenticated');

drop policy if exists "AI meta write by authenticated" on public.ai_extracted_meta;
create policy "AI meta write by authenticated"
  on public.ai_extracted_meta for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Settings readable by authenticated" on public.settings;
create policy "Settings readable by authenticated"
  on public.settings for select using (auth.role() = 'authenticated');

drop policy if exists "Settings write via service role" on public.settings;
create policy "Settings write via service role"
  on public.settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- STORAGE BUCKETS ----------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('exports', 'exports', false)
on conflict (id) do nothing;

-- Storage policies
drop policy if exists "product images: public read" on storage.objects;
create policy "product images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product images: authenticated upload" on storage.objects;
create policy "product images: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "exports: authenticated access" on storage.objects;
create policy "exports: authenticated access"
  on storage.objects for all
  using (bucket_id in ('product-images','exports') and auth.role() = 'authenticated')
  with check (bucket_id in ('product-images','exports') and auth.role() = 'authenticated');

-- SEED DATA ----------------------------------------------------------
insert into public.settings (display_name, brand_name, timezone, currency)
values ('Merch Ops', 'Demand Forecast', 'Asia/Bangkok', 'THB')
on conflict do nothing;

insert into public.profiles (id, email)
select id, email
from auth.users
on conflict (id) do update set email = excluded.email;

