-- Migration: add forecast insights
-- Generates an insights column on forecasts + optional index

alter table public.forecasts
  add column if not exists summary text,
  add column if not exists summary_language text default 'en' check (summary_language in ('en','th')),
  add column if not exists summary_created_at timestamptz;

create index if not exists forecasts_summary_created_idx on public.forecasts (summary_created_at desc);
