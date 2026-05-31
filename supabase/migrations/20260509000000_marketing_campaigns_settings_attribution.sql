create extension if not exists pgcrypto;

create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_settings_key_trimmed_check check (char_length(trim(key)) > 0)
);

alter table public.admin_settings add column if not exists value jsonb not null default '{}'::jsonb;
alter table public.admin_settings add column if not exists updated_by uuid null references auth.users(id) on delete set null;
alter table public.admin_settings add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.admin_settings add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_type text not null default 'email',
  goal text not null default '',
  description text not null default '',
  status text not null default 'active',
  starts_at timestamptz null,
  ends_at timestamptz null,
  budget_amount numeric null,
  daily_budget_amount numeric null,
  tags jsonb not null default '[]'::jsonb,
  channels jsonb not null default '[]'::jsonb,
  audience_type text not null default '',
  audience text not null default '',
  track_conversions boolean not null default true,
  ab_test_enabled boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint campaigns_name_trimmed_check check (char_length(trim(name)) > 0),
  constraint campaigns_type_trimmed_check check (char_length(trim(campaign_type)) > 0),
  constraint campaigns_status_check check (status in ('draft', 'active', 'scheduled', 'paused', 'completed', 'disabled')),
  constraint campaigns_budget_amount_check check (budget_amount is null or budget_amount >= 0),
  constraint campaigns_daily_budget_amount_check check (daily_budget_amount is null or daily_budget_amount >= 0)
);

alter table public.campaigns add column if not exists campaign_type text not null default 'email';
alter table public.campaigns add column if not exists goal text not null default '';
alter table public.campaigns add column if not exists description text not null default '';
alter table public.campaigns add column if not exists status text not null default 'active';
alter table public.campaigns add column if not exists starts_at timestamptz null;
alter table public.campaigns add column if not exists ends_at timestamptz null;
alter table public.campaigns add column if not exists budget_amount numeric null;
alter table public.campaigns add column if not exists daily_budget_amount numeric null;
alter table public.campaigns add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.campaigns add column if not exists channels jsonb not null default '[]'::jsonb;
alter table public.campaigns add column if not exists audience_type text not null default '';
alter table public.campaigns add column if not exists audience text not null default '';
alter table public.campaigns add column if not exists track_conversions boolean not null default true;
alter table public.campaigns add column if not exists ab_test_enabled boolean not null default false;
alter table public.campaigns add column if not exists created_by uuid null references auth.users(id) on delete set null;
alter table public.campaigns add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.campaigns add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.orders add column if not exists source text null;
alter table public.orders add column if not exists medium text null;
alter table public.orders add column if not exists campaign_id text null;
alter table public.orders add column if not exists campaign_name text null;
alter table public.orders add column if not exists utm_source text null;
alter table public.orders add column if not exists utm_medium text null;
alter table public.orders add column if not exists utm_campaign text null;
alter table public.orders add column if not exists attribution_data jsonb not null default '{}'::jsonb;

create index if not exists admin_settings_key_idx on public.admin_settings (key);
create index if not exists campaigns_status_created_idx on public.campaigns (status, created_at desc);
create index if not exists campaigns_type_created_idx on public.campaigns (campaign_type, created_at desc);
create index if not exists campaigns_channels_idx on public.campaigns using gin (channels);
create index if not exists campaigns_tags_idx on public.campaigns using gin (tags);
create index if not exists orders_attribution_idx on public.orders (source, utm_source, campaign_name, utm_campaign);

drop trigger if exists admin_settings_set_updated_at on public.admin_settings;
create trigger admin_settings_set_updated_at
before update on public.admin_settings
for each row execute function public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

alter table public.admin_settings enable row level security;
alter table public.campaigns enable row level security;

drop policy if exists "admin_settings_select_management" on public.admin_settings;
create policy "admin_settings_select_management"
on public.admin_settings
for select
using (public.is_management_user());

drop policy if exists "admin_settings_insert_management" on public.admin_settings;
create policy "admin_settings_insert_management"
on public.admin_settings
for insert
with check (public.is_management_user());

drop policy if exists "admin_settings_update_management" on public.admin_settings;
create policy "admin_settings_update_management"
on public.admin_settings
for update
using (public.is_management_user())
with check (public.is_management_user());

drop policy if exists "campaigns_select_management" on public.campaigns;
create policy "campaigns_select_management"
on public.campaigns
for select
using (public.is_management_user());

drop policy if exists "campaigns_insert_management" on public.campaigns;
create policy "campaigns_insert_management"
on public.campaigns
for insert
with check (public.is_management_user());

drop policy if exists "campaigns_update_management" on public.campaigns;
create policy "campaigns_update_management"
on public.campaigns
for update
using (public.is_management_user())
with check (public.is_management_user());

grant select on public.admin_settings to authenticated;
grant select on public.campaigns to authenticated;
