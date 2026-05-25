create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'staff', 'admin', 'owner')),
  wallet_address text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists wallet_address text null;
alter table public.profiles add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.profiles add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
add constraint profiles_role_check check (role in ('user', 'staff', 'admin', 'owner'));

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone_country_code text not null default '+63',
  phone_number text not null default '',
  date_of_birth date null,
  customer_type text not null default '',
  source text not null default '',
  customer_group text not null default '',
  vip_level text not null default 'standard',
  referral_by text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  city text not null default '',
  state_province text not null default '',
  postal_code text not null default '',
  country text not null default 'Philippines',
  account_status text not null default 'active',
  email_verification text not null default 'unverified',
  has_account_access boolean not null default true,
  subscription_status text not null default 'subscribed',
  subscribed_on date null,
  tags jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint customers_full_name_trimmed_check check (char_length(trim(full_name)) > 0),
  constraint customers_email_trimmed_check check (char_length(trim(email)) > 0),
  constraint customers_account_status_check check (account_status in ('active', 'inactive', 'blocked')),
  constraint customers_email_verification_check check (email_verification in ('verified', 'unverified')),
  constraint customers_subscription_status_check check (subscription_status in ('subscribed', 'unsubscribed', 'pending'))
);

alter table public.customers add column if not exists id uuid default gen_random_uuid();
alter table public.customers add column if not exists full_name text;
alter table public.customers add column if not exists email text;
alter table public.customers add column if not exists phone_country_code text not null default '+63';
alter table public.customers add column if not exists phone_number text not null default '';
alter table public.customers add column if not exists date_of_birth date null;
alter table public.customers add column if not exists customer_type text not null default '';
alter table public.customers add column if not exists source text not null default '';
alter table public.customers add column if not exists customer_group text not null default '';
alter table public.customers add column if not exists vip_level text not null default 'standard';
alter table public.customers add column if not exists referral_by text not null default '';
alter table public.customers add column if not exists address_line1 text not null default '';
alter table public.customers add column if not exists address_line2 text not null default '';
alter table public.customers add column if not exists city text not null default '';
alter table public.customers add column if not exists state_province text not null default '';
alter table public.customers add column if not exists postal_code text not null default '';
alter table public.customers add column if not exists country text not null default 'Philippines';
alter table public.customers add column if not exists account_status text not null default 'active';
alter table public.customers add column if not exists email_verification text not null default 'unverified';
alter table public.customers add column if not exists has_account_access boolean not null default true;
alter table public.customers add column if not exists subscription_status text not null default 'subscribed';
alter table public.customers add column if not exists subscribed_on date null;
alter table public.customers add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.customers add column if not exists notes text not null default '';
alter table public.customers add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.customers add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.customers
  alter column id set not null,
  alter column full_name set not null,
  alter column email set not null,
  alter column phone_country_code set not null,
  alter column phone_number set not null,
  alter column customer_type set not null,
  alter column source set not null,
  alter column customer_group set not null,
  alter column vip_level set not null,
  alter column referral_by set not null,
  alter column address_line1 set not null,
  alter column address_line2 set not null,
  alter column city set not null,
  alter column state_province set not null,
  alter column postal_code set not null,
  alter column country set not null,
  alter column account_status set not null,
  alter column email_verification set not null,
  alter column has_account_access set not null,
  alter column subscription_status set not null,
  alter column tags set not null,
  alter column notes set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_pkey'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers add constraint customers_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_email_key'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers add constraint customers_email_key unique (email);
  end if;
end $$;

alter table public.customers drop constraint if exists customers_full_name_trimmed_check;
alter table public.customers
add constraint customers_full_name_trimmed_check check (char_length(trim(full_name)) > 0);

alter table public.customers drop constraint if exists customers_email_trimmed_check;
alter table public.customers
add constraint customers_email_trimmed_check check (char_length(trim(email)) > 0);

alter table public.customers drop constraint if exists customers_account_status_check;
alter table public.customers
add constraint customers_account_status_check check (account_status in ('active', 'inactive', 'blocked'));

alter table public.customers drop constraint if exists customers_email_verification_check;
alter table public.customers
add constraint customers_email_verification_check check (email_verification in ('verified', 'unverified'));

alter table public.customers drop constraint if exists customers_subscription_status_check;
alter table public.customers
add constraint customers_subscription_status_check check (subscription_status in ('subscribed', 'unsubscribed', 'pending'));

create table if not exists public.products (
  id text primary key,
  name text not null,
  brand text not null,
  description text not null default '',
  price_php_cents integer not null default 0,
  department text not null default 'Womens',
  category_label text not null default 'Collection',
  main_image_url text not null,
  hover_image_url text null,
  gallery_image_urls jsonb not null default '[]'::jsonb,
  size_inventory jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  show_in_new_arrivals boolean not null default false,
  show_in_featured boolean not null default false,
  published_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_status_check check (status in ('draft', 'published')),
  constraint products_price_php_cents_check check (price_php_cents >= 0),
  constraint products_id_trimmed_check check (char_length(trim(id)) > 0),
  constraint products_name_trimmed_check check (char_length(trim(name)) > 0),
  constraint products_brand_trimmed_check check (char_length(trim(brand)) > 0),
  constraint products_main_image_trimmed_check check (char_length(trim(main_image_url)) > 0)
);

alter table public.products add column if not exists id text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists price_php_cents integer not null default 0;
alter table public.products add column if not exists department text not null default 'Womens';
alter table public.products add column if not exists category_label text not null default 'Collection';
alter table public.products add column if not exists main_image_url text;
alter table public.products add column if not exists hover_image_url text null;
alter table public.products add column if not exists gallery_image_urls jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists size_inventory jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists status text not null default 'draft';
alter table public.products add column if not exists show_in_new_arrivals boolean not null default false;
alter table public.products add column if not exists show_in_featured boolean not null default false;
alter table public.products add column if not exists published_at timestamptz null;
alter table public.products add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.products add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.products
  alter column id set not null,
  alter column name set not null,
  alter column brand set not null,
  alter column description set not null,
  alter column price_php_cents set not null,
  alter column department set not null,
  alter column category_label set not null,
  alter column main_image_url set not null,
  alter column gallery_image_urls set not null,
  alter column size_inventory set not null,
  alter column status set not null,
  alter column show_in_new_arrivals set not null,
  alter column show_in_featured set not null;

alter table public.products drop constraint if exists products_status_check;
alter table public.products
add constraint products_status_check check (status in ('draft', 'published'));

alter table public.products drop constraint if exists products_price_php_cents_check;
alter table public.products
add constraint products_price_php_cents_check check (price_php_cents >= 0);

alter table public.products drop constraint if exists products_id_trimmed_check;
alter table public.products
add constraint products_id_trimmed_check check (char_length(trim(id)) > 0);

alter table public.products drop constraint if exists products_name_trimmed_check;
alter table public.products
add constraint products_name_trimmed_check check (char_length(trim(name)) > 0);

alter table public.products drop constraint if exists products_brand_trimmed_check;
alter table public.products
add constraint products_brand_trimmed_check check (char_length(trim(brand)) > 0);

alter table public.products drop constraint if exists products_main_image_trimmed_check;
alter table public.products
add constraint products_main_image_trimmed_check check (char_length(trim(main_image_url)) > 0);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text null,
  status text not null default 'active',
  collection_type text not null default 'manual',
  display_order integer not null default 0,
  is_featured boolean not null default false,
  featured_from timestamptz null,
  featured_until timestamptz null,
  meta_title text not null default '',
  meta_description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint collections_name_trimmed_check check (char_length(trim(name)) > 0),
  constraint collections_slug_trimmed_check check (char_length(trim(slug)) > 0),
  constraint collections_status_check check (status in ('active', 'draft')),
  constraint collections_type_check check (collection_type in ('manual', 'automatic')),
  constraint collections_display_order_check check (display_order >= 0)
);

alter table public.collections add column if not exists id uuid default gen_random_uuid();
alter table public.collections add column if not exists name text;
alter table public.collections add column if not exists slug text;
alter table public.collections add column if not exists description text not null default '';
alter table public.collections add column if not exists image_url text null;
alter table public.collections add column if not exists status text not null default 'active';
alter table public.collections add column if not exists collection_type text not null default 'manual';
alter table public.collections add column if not exists display_order integer not null default 0;
alter table public.collections add column if not exists is_featured boolean not null default false;
alter table public.collections add column if not exists featured_from timestamptz null;
alter table public.collections add column if not exists featured_until timestamptz null;
alter table public.collections add column if not exists meta_title text not null default '';
alter table public.collections add column if not exists meta_description text not null default '';
alter table public.collections add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.collections add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.collections
  alter column id set not null,
  alter column name set not null,
  alter column slug set not null,
  alter column description set not null,
  alter column status set not null,
  alter column collection_type set not null,
  alter column display_order set not null,
  alter column is_featured set not null,
  alter column meta_title set not null,
  alter column meta_description set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'collections_pkey'
      and conrelid = 'public.collections'::regclass
  ) then
    alter table public.collections add constraint collections_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'collections_slug_key'
      and conrelid = 'public.collections'::regclass
  ) then
    alter table public.collections add constraint collections_slug_key unique (slug);
  end if;
end $$;

alter table public.collections drop constraint if exists collections_name_trimmed_check;
alter table public.collections
add constraint collections_name_trimmed_check check (char_length(trim(name)) > 0);

alter table public.collections drop constraint if exists collections_slug_trimmed_check;
alter table public.collections
add constraint collections_slug_trimmed_check check (char_length(trim(slug)) > 0);

alter table public.collections drop constraint if exists collections_status_check;
alter table public.collections
add constraint collections_status_check check (status in ('active', 'draft'));

alter table public.collections drop constraint if exists collections_type_check;
alter table public.collections
add constraint collections_type_check check (collection_type in ('manual', 'automatic'));

alter table public.collections drop constraint if exists collections_display_order_check;
alter table public.collections
add constraint collections_display_order_check check (display_order >= 0);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default '',
  description text not null default '',
  coupon_type text not null default 'percentage',
  discount_value numeric not null default 0,
  minimum_purchase_amount numeric not null default 0,
  status text not null default 'active',
  starts_at timestamptz null,
  ends_at timestamptz null,
  assigned_user_id uuid null references auth.users(id) on delete set null,
  assigned_customer_email text null,
  usage_limit integer null,
  usage_limit_per_customer integer null,
  applicable_collection_slugs jsonb not null default '[]'::jsonb,
  applicable_product_ids jsonb not null default '[]'::jsonb,
  stackable boolean not null default false,
  apply_to_sale_items boolean not null default true,
  free_shipping boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint coupons_code_trimmed_check check (char_length(trim(code)) > 0),
  constraint coupons_type_check check (coupon_type in ('percentage', 'fixed_amount', 'free_shipping')),
  constraint coupons_status_check check (status in ('active', 'disabled')),
  constraint coupons_discount_value_check check (discount_value >= 0),
  constraint coupons_percentage_value_check check (coupon_type <> 'percentage' or discount_value <= 100),
  constraint coupons_minimum_purchase_check check (minimum_purchase_amount >= 0),
  constraint coupons_usage_limit_check check (usage_limit is null or usage_limit > 0),
  constraint coupons_usage_limit_per_customer_check check (usage_limit_per_customer is null or usage_limit_per_customer > 0)
);

alter table public.coupons add column if not exists code text;
alter table public.coupons add column if not exists name text not null default '';
alter table public.coupons add column if not exists description text not null default '';
alter table public.coupons add column if not exists coupon_type text not null default 'percentage';
alter table public.coupons add column if not exists discount_value numeric not null default 0;
alter table public.coupons add column if not exists minimum_purchase_amount numeric not null default 0;
alter table public.coupons add column if not exists status text not null default 'active';
alter table public.coupons add column if not exists starts_at timestamptz null;
alter table public.coupons add column if not exists ends_at timestamptz null;
alter table public.coupons add column if not exists assigned_user_id uuid null references auth.users(id) on delete set null;
alter table public.coupons add column if not exists assigned_customer_email text null;
alter table public.coupons add column if not exists usage_limit integer null;
alter table public.coupons add column if not exists usage_limit_per_customer integer null;
alter table public.coupons add column if not exists applicable_collection_slugs jsonb not null default '[]'::jsonb;
alter table public.coupons add column if not exists applicable_product_ids jsonb not null default '[]'::jsonb;
alter table public.coupons add column if not exists stackable boolean not null default false;
alter table public.coupons add column if not exists apply_to_sale_items boolean not null default true;
alter table public.coupons add column if not exists free_shipping boolean not null default false;
alter table public.coupons add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.coupons add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.coupons
  alter column code set not null,
  alter column name set not null,
  alter column description set not null,
  alter column coupon_type set not null,
  alter column discount_value set not null,
  alter column minimum_purchase_amount set not null,
  alter column status set not null,
  alter column applicable_collection_slugs set not null,
  alter column applicable_product_ids set not null,
  alter column stackable set not null,
  alter column apply_to_sale_items set not null,
  alter column free_shipping set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.coupons drop constraint if exists coupons_code_trimmed_check;
alter table public.coupons
add constraint coupons_code_trimmed_check check (char_length(trim(code)) > 0);

alter table public.coupons drop constraint if exists coupons_type_check;
alter table public.coupons
add constraint coupons_type_check check (coupon_type in ('percentage', 'fixed_amount', 'free_shipping'));

alter table public.coupons drop constraint if exists coupons_status_check;
alter table public.coupons
add constraint coupons_status_check check (status in ('active', 'disabled'));

alter table public.coupons drop constraint if exists coupons_discount_value_check;
alter table public.coupons
add constraint coupons_discount_value_check check (discount_value >= 0);

alter table public.coupons drop constraint if exists coupons_percentage_value_check;
alter table public.coupons
add constraint coupons_percentage_value_check check (coupon_type <> 'percentage' or discount_value <= 100);

alter table public.coupons drop constraint if exists coupons_minimum_purchase_check;
alter table public.coupons
add constraint coupons_minimum_purchase_check check (minimum_purchase_amount >= 0);

alter table public.coupons drop constraint if exists coupons_usage_limit_check;
alter table public.coupons
add constraint coupons_usage_limit_check check (usage_limit is null or usage_limit > 0);

alter table public.coupons drop constraint if exists coupons_usage_limit_per_customer_check;
alter table public.coupons
add constraint coupons_usage_limit_per_customer_check check (usage_limit_per_customer is null or usage_limit_per_customer > 0);

alter table public.coupons drop constraint if exists coupons_assigned_customer_email_check;
alter table public.coupons
add constraint coupons_assigned_customer_email_check check (
  assigned_customer_email is null
  or assigned_customer_email = lower(trim(assigned_customer_email))
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'coupons_code_key'
      and conrelid = 'public.coupons'::regclass
  ) then
    alter table public.coupons add constraint coupons_code_key unique (code);
  end if;
end $$;

create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_settings_key_trimmed_check check (char_length(trim(key)) > 0)
);

alter table public.admin_settings add column if not exists key text;
alter table public.admin_settings add column if not exists value jsonb not null default '{}'::jsonb;
alter table public.admin_settings add column if not exists updated_by uuid null references auth.users(id) on delete set null;
alter table public.admin_settings add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.admin_settings add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.admin_settings
  alter column key set not null,
  alter column value set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.admin_settings drop constraint if exists admin_settings_key_trimmed_check;
alter table public.admin_settings
add constraint admin_settings_key_trimmed_check check (char_length(trim(key)) > 0);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  channel text not null,
  title text not null,
  message text not null,
  status text not null default 'queued',
  href text null,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  delivered_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_notifications_type_trimmed_check check (char_length(trim(type)) > 0),
  constraint admin_notifications_channel_check check (channel in ('email', 'sms', 'push')),
  constraint admin_notifications_status_check check (status in ('queued', 'sent', 'skipped', 'failed', 'delayed'))
);

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

alter table public.campaigns add column if not exists name text;
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

alter table public.campaigns
  alter column name set not null,
  alter column campaign_type set not null,
  alter column goal set not null,
  alter column description set not null,
  alter column status set not null,
  alter column tags set not null,
  alter column channels set not null,
  alter column audience_type set not null,
  alter column audience set not null,
  alter column track_conversions set not null,
  alter column ab_test_enabled set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.campaigns drop constraint if exists campaigns_name_trimmed_check;
alter table public.campaigns
add constraint campaigns_name_trimmed_check check (char_length(trim(name)) > 0);

alter table public.campaigns drop constraint if exists campaigns_type_trimmed_check;
alter table public.campaigns
add constraint campaigns_type_trimmed_check check (char_length(trim(campaign_type)) > 0);

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns
add constraint campaigns_status_check check (status in ('draft', 'active', 'scheduled', 'paused', 'completed', 'disabled'));

alter table public.campaigns drop constraint if exists campaigns_budget_amount_check;
alter table public.campaigns
add constraint campaigns_budget_amount_check check (budget_amount is null or budget_amount >= 0);

alter table public.campaigns drop constraint if exists campaigns_daily_budget_amount_check;
alter table public.campaigns
add constraint campaigns_daily_budget_amount_check check (daily_budget_amount is null or daily_budget_amount >= 0);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  user_id uuid null references auth.users(id) on delete set null,
  email text null,
  product_id text null,
  product_name text null,
  selected_size text null,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  customer_name text not null default '',
  phone text not null default '',
  shipping_address text not null default '',
  shipping_address_line1 text null,
  shipping_city text null,
  shipping_province text null,
  shipping_postal_code text null,
  shipping_country text null,
  shipping_zone text null,
  shipping_method text null,
  shipping_fee numeric null,
  delivery_latitude numeric null,
  delivery_longitude numeric null,
  delivery_place_id text null,
  delivery_map_provider text null,
  delivery_address_components jsonb not null default '{}'::jsonb,
  subtotal_amount numeric null,
  tax_amount numeric null,
  tax_rate_label text null,
  tax_rate_percent numeric null,
  tax_breakdown jsonb not null default '{}'::jsonb,
  coupon_id uuid null references public.coupons(id) on delete set null,
  coupon_code text null,
  discount_amount numeric not null default 0,
  discount_breakdown jsonb not null default '{}'::jsonb,
  source text null,
  medium text null,
  campaign_id text null,
  campaign_name text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  attribution_data jsonb not null default '{}'::jsonb,
  amount numeric not null,
  currency text not null default 'USD',
  status text not null default 'pending',
  notes text null,
  confirmation_email_status text not null default 'pending',
  confirmation_email_sent_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint orders_status_check check (status in ('pending', 'paid', 'cancelled')),
  constraint orders_shipping_method_check check (shipping_method is null or shipping_method in ('standard', 'express')),
  constraint orders_confirmation_email_status_check check (
    confirmation_email_status in ('pending', 'sent', 'failed', 'not_configured')
  )
);

alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists user_id uuid null references auth.users(id) on delete set null;
alter table public.orders add column if not exists email text null;
alter table public.orders add column if not exists product_id text null;
alter table public.orders add column if not exists product_name text null;
alter table public.orders add column if not exists selected_size text null;
alter table public.orders add column if not exists quantity integer not null default 1;
alter table public.orders add column if not exists unit_price numeric not null default 0;
alter table public.orders add column if not exists customer_name text not null default '';
alter table public.orders add column if not exists phone text not null default '';
alter table public.orders add column if not exists shipping_address text not null default '';
alter table public.orders add column if not exists shipping_address_line1 text null;
alter table public.orders add column if not exists shipping_city text null;
alter table public.orders add column if not exists shipping_province text null;
alter table public.orders add column if not exists shipping_postal_code text null;
alter table public.orders add column if not exists shipping_country text null;
alter table public.orders add column if not exists shipping_zone text null;
alter table public.orders add column if not exists shipping_method text null;
alter table public.orders add column if not exists shipping_fee numeric null;
alter table public.orders add column if not exists delivery_latitude numeric null;
alter table public.orders add column if not exists delivery_longitude numeric null;
alter table public.orders add column if not exists delivery_place_id text null;
alter table public.orders add column if not exists delivery_map_provider text null;
alter table public.orders add column if not exists delivery_address_components jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists subtotal_amount numeric null;
alter table public.orders add column if not exists tax_amount numeric null;
alter table public.orders add column if not exists tax_rate_label text null;
alter table public.orders add column if not exists tax_rate_percent numeric null;
alter table public.orders add column if not exists tax_breakdown jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists coupon_id uuid null references public.coupons(id) on delete set null;
alter table public.orders add column if not exists coupon_code text null;
alter table public.orders add column if not exists discount_amount numeric not null default 0;
alter table public.orders add column if not exists discount_breakdown jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists source text null;
alter table public.orders add column if not exists medium text null;
alter table public.orders add column if not exists campaign_id text null;
alter table public.orders add column if not exists campaign_name text null;
alter table public.orders add column if not exists utm_source text null;
alter table public.orders add column if not exists utm_medium text null;
alter table public.orders add column if not exists utm_campaign text null;
alter table public.orders add column if not exists attribution_data jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists amount numeric not null default 0;
alter table public.orders add column if not exists currency text not null default 'USD';
alter table public.orders add column if not exists status text not null default 'pending';
alter table public.orders add column if not exists notes text null;
alter table public.orders add column if not exists confirmation_email_status text not null default 'pending';
alter table public.orders add column if not exists confirmation_email_sent_at timestamptz null;
alter table public.orders add column if not exists cancelled_at timestamptz null;
alter table public.orders add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.orders add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
add constraint orders_status_check check (status in ('pending', 'paid', 'cancelled'));

alter table public.orders drop constraint if exists orders_shipping_method_check;
alter table public.orders
add constraint orders_shipping_method_check check (shipping_method is null or shipping_method in ('standard', 'express'));

alter table public.orders drop constraint if exists orders_confirmation_email_status_check;
alter table public.orders
add constraint orders_confirmation_email_status_check check (
  confirmation_email_status in ('pending', 'sent', 'failed', 'not_configured')
);

alter table public.orders drop constraint if exists orders_delivery_latitude_check;
alter table public.orders
add constraint orders_delivery_latitude_check check (delivery_latitude is null or (delivery_latitude >= -90 and delivery_latitude <= 90));

alter table public.orders drop constraint if exists orders_delivery_longitude_check;
alter table public.orders
add constraint orders_delivery_longitude_check check (delivery_longitude is null or (delivery_longitude >= -180 and delivery_longitude <= 180));

alter table public.orders drop constraint if exists orders_discount_amount_check;
alter table public.orders
add constraint orders_discount_amount_check check (discount_amount >= 0);

alter table public.orders drop constraint if exists orders_tax_amount_check;
alter table public.orders
add constraint orders_tax_amount_check check (tax_amount is null or tax_amount >= 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_order_number_key'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_order_number_key unique (order_number);
  end if;
end $$;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text null,
  product_name text not null default '',
  product_brand text null,
  selected_size text null,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_unit_price_check check (unit_price >= 0),
  constraint order_items_line_total_check check (line_total >= 0)
);

alter table public.order_items add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.order_items add column if not exists product_id text null;
alter table public.order_items add column if not exists product_name text not null default '';
alter table public.order_items add column if not exists product_brand text null;
alter table public.order_items add column if not exists selected_size text null;
alter table public.order_items add column if not exists quantity integer not null default 1;
alter table public.order_items add column if not exists unit_price numeric not null default 0;
alter table public.order_items add column if not exists line_total numeric not null default 0;
alter table public.order_items add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.order_items add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.order_items
  alter column order_id set not null,
  alter column product_name set not null,
  alter column quantity set not null,
  alter column unit_price set not null,
  alter column line_total set not null;

alter table public.order_items drop constraint if exists order_items_quantity_check;
alter table public.order_items
add constraint order_items_quantity_check check (quantity > 0);

alter table public.order_items drop constraint if exists order_items_unit_price_check;
alter table public.order_items
add constraint order_items_unit_price_check check (unit_price >= 0);

alter table public.order_items drop constraint if exists order_items_line_total_check;
alter table public.order_items
add constraint order_items_line_total_check check (line_total >= 0);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  coupon_code text not null,
  order_id uuid null references public.orders(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  customer_email text null,
  discount_amount numeric not null default 0,
  product_discount_amount numeric not null default 0,
  shipping_discount_amount numeric not null default 0,
  order_subtotal_amount numeric not null default 0,
  order_total_before_discount numeric not null default 0,
  order_total_after_discount numeric not null default 0,
  status text not null default 'applied',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint coupon_redemptions_discount_check check (discount_amount >= 0),
  constraint coupon_redemptions_product_discount_check check (product_discount_amount >= 0),
  constraint coupon_redemptions_shipping_discount_check check (shipping_discount_amount >= 0),
  constraint coupon_redemptions_status_check check (status in ('applied', 'cancelled', 'refunded'))
);

alter table public.coupon_redemptions add column if not exists coupon_id uuid references public.coupons(id) on delete cascade;
alter table public.coupon_redemptions add column if not exists coupon_code text not null default '';
alter table public.coupon_redemptions add column if not exists order_id uuid null references public.orders(id) on delete set null;
alter table public.coupon_redemptions add column if not exists user_id uuid null references auth.users(id) on delete set null;
alter table public.coupon_redemptions add column if not exists customer_email text null;
alter table public.coupon_redemptions add column if not exists discount_amount numeric not null default 0;
alter table public.coupon_redemptions add column if not exists product_discount_amount numeric not null default 0;
alter table public.coupon_redemptions add column if not exists shipping_discount_amount numeric not null default 0;
alter table public.coupon_redemptions add column if not exists order_subtotal_amount numeric not null default 0;
alter table public.coupon_redemptions add column if not exists order_total_before_discount numeric not null default 0;
alter table public.coupon_redemptions add column if not exists order_total_after_discount numeric not null default 0;
alter table public.coupon_redemptions add column if not exists status text not null default 'applied';
alter table public.coupon_redemptions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.coupon_redemptions add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.coupon_redemptions add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.coupon_redemptions
  alter column coupon_id set not null,
  alter column coupon_code set not null,
  alter column discount_amount set not null,
  alter column product_discount_amount set not null,
  alter column shipping_discount_amount set not null,
  alter column order_subtotal_amount set not null,
  alter column order_total_before_discount set not null,
  alter column order_total_after_discount set not null,
  alter column status set not null,
  alter column metadata set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.coupon_redemptions drop constraint if exists coupon_redemptions_discount_check;
alter table public.coupon_redemptions
add constraint coupon_redemptions_discount_check check (discount_amount >= 0);

alter table public.coupon_redemptions drop constraint if exists coupon_redemptions_product_discount_check;
alter table public.coupon_redemptions
add constraint coupon_redemptions_product_discount_check check (product_discount_amount >= 0);

alter table public.coupon_redemptions drop constraint if exists coupon_redemptions_shipping_discount_check;
alter table public.coupon_redemptions
add constraint coupon_redemptions_shipping_discount_check check (shipping_discount_amount >= 0);

alter table public.coupon_redemptions drop constraint if exists coupon_redemptions_status_check;
alter table public.coupon_redemptions
add constraint coupon_redemptions_status_check check (status in ('applied', 'cancelled', 'refunded'));

create unique index if not exists coupon_redemptions_applied_order_coupon_key
on public.coupon_redemptions (order_id, coupon_id)
where status = 'applied' and order_id is not null;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete set null,
  customer_key text not null,
  customer_name text not null,
  customer_email text null,
  title text not null default '',
  content text not null,
  rating integer not null,
  status text not null default 'pending',
  is_featured boolean not null default false,
  is_verified_purchase boolean not null default false,
  name_display text not null default 'first_name',
  media_urls jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default timezone('utc', now()),
  moderation_notes text not null default '',
  experience_feedback text not null default '',
  source text not null default 'admin',
  review_request_sent_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_status_check check (status in ('approved', 'pending', 'rejected')),
  constraint reviews_name_display_check check (name_display in ('first_name', 'full_name', 'anonymous')),
  constraint reviews_source_check check (source in ('admin', 'customer')),
  constraint reviews_featured_approved_check check (not is_featured or status = 'approved'),
  constraint reviews_customer_name_trimmed_check check (char_length(trim(customer_name)) > 0),
  constraint reviews_content_trimmed_check check (char_length(trim(content)) > 0)
);

alter table public.reviews add column if not exists id uuid default gen_random_uuid();
alter table public.reviews add column if not exists product_id text references public.products(id) on delete cascade;
alter table public.reviews add column if not exists order_id uuid null references public.orders(id) on delete set null;
alter table public.reviews add column if not exists customer_key text;
alter table public.reviews add column if not exists customer_name text;
alter table public.reviews add column if not exists customer_email text null;
alter table public.reviews add column if not exists title text not null default '';
alter table public.reviews add column if not exists content text;
alter table public.reviews add column if not exists rating integer;
alter table public.reviews add column if not exists status text not null default 'pending';
alter table public.reviews add column if not exists is_featured boolean not null default false;
alter table public.reviews add column if not exists is_verified_purchase boolean not null default false;
alter table public.reviews add column if not exists name_display text not null default 'first_name';
alter table public.reviews add column if not exists media_urls jsonb not null default '[]'::jsonb;
alter table public.reviews add column if not exists submitted_at timestamptz not null default timezone('utc', now());
alter table public.reviews add column if not exists moderation_notes text not null default '';
alter table public.reviews add column if not exists experience_feedback text not null default '';
alter table public.reviews add column if not exists source text not null default 'admin';
alter table public.reviews add column if not exists review_request_sent_at timestamptz null;
alter table public.reviews add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.reviews add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.reviews
  alter column id set not null,
  alter column product_id set not null,
  alter column customer_key set not null,
  alter column customer_name set not null,
  alter column title set not null,
  alter column content set not null,
  alter column rating set not null,
  alter column status set not null,
  alter column is_featured set not null,
  alter column is_verified_purchase set not null,
  alter column name_display set not null,
  alter column media_urls set not null,
  alter column submitted_at set not null,
  alter column moderation_notes set not null,
  alter column experience_feedback set not null,
  alter column source set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviews_pkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews add constraint reviews_pkey primary key (id);
  end if;
end $$;

alter table public.reviews drop constraint if exists reviews_rating_check;
alter table public.reviews
add constraint reviews_rating_check check (rating between 1 and 5);

alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews
add constraint reviews_status_check check (status in ('approved', 'pending', 'rejected'));

alter table public.reviews drop constraint if exists reviews_name_display_check;
alter table public.reviews
add constraint reviews_name_display_check check (name_display in ('first_name', 'full_name', 'anonymous'));

alter table public.reviews drop constraint if exists reviews_source_check;
alter table public.reviews
add constraint reviews_source_check check (source in ('admin', 'customer'));

alter table public.reviews drop constraint if exists reviews_featured_approved_check;
alter table public.reviews
add constraint reviews_featured_approved_check check (not is_featured or status = 'approved');

alter table public.reviews drop constraint if exists reviews_customer_name_trimmed_check;
alter table public.reviews
add constraint reviews_customer_name_trimmed_check check (char_length(trim(customer_name)) > 0);

alter table public.reviews drop constraint if exists reviews_content_trimmed_check;
alter table public.reviews
add constraint reviews_content_trimmed_check check (char_length(trim(content)) > 0);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  featured_image_url text null,
  content text not null default '',
  status text not null default 'draft',
  visibility text not null default 'public',
  categories jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  author_name text not null default 'Admin',
  publish_at timestamptz null,
  meta_title text not null default '',
  meta_description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint blog_posts_title_trimmed_check check (char_length(trim(title)) > 0),
  constraint blog_posts_slug_trimmed_check check (char_length(trim(slug)) > 0),
  constraint blog_posts_content_trimmed_check check (char_length(trim(content)) > 0),
  constraint blog_posts_status_check check (status in ('published', 'draft', 'archived')),
  constraint blog_posts_visibility_check check (visibility in ('public', 'private', 'password'))
);

alter table public.blog_posts add column if not exists id uuid default gen_random_uuid();
alter table public.blog_posts add column if not exists title text;
alter table public.blog_posts add column if not exists slug text;
alter table public.blog_posts add column if not exists excerpt text not null default '';
alter table public.blog_posts add column if not exists featured_image_url text null;
alter table public.blog_posts add column if not exists content text not null default '';
alter table public.blog_posts add column if not exists status text not null default 'draft';
alter table public.blog_posts add column if not exists visibility text not null default 'public';
alter table public.blog_posts add column if not exists categories jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.blog_posts add column if not exists author_name text not null default 'Admin';
alter table public.blog_posts add column if not exists publish_at timestamptz null;
alter table public.blog_posts add column if not exists meta_title text not null default '';
alter table public.blog_posts add column if not exists meta_description text not null default '';
alter table public.blog_posts add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.blog_posts add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.blog_posts
  alter column id set not null,
  alter column title set not null,
  alter column slug set not null,
  alter column excerpt set not null,
  alter column content set not null,
  alter column status set not null,
  alter column visibility set not null,
  alter column categories set not null,
  alter column tags set not null,
  alter column author_name set not null,
  alter column meta_title set not null,
  alter column meta_description set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'blog_posts_pkey'
      and conrelid = 'public.blog_posts'::regclass
  ) then
    alter table public.blog_posts add constraint blog_posts_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'blog_posts_slug_key'
      and conrelid = 'public.blog_posts'::regclass
  ) then
    alter table public.blog_posts add constraint blog_posts_slug_key unique (slug);
  end if;
end $$;

alter table public.blog_posts drop constraint if exists blog_posts_title_trimmed_check;
alter table public.blog_posts
add constraint blog_posts_title_trimmed_check check (char_length(trim(title)) > 0);

alter table public.blog_posts drop constraint if exists blog_posts_slug_trimmed_check;
alter table public.blog_posts
add constraint blog_posts_slug_trimmed_check check (char_length(trim(slug)) > 0);

alter table public.blog_posts drop constraint if exists blog_posts_content_trimmed_check;
alter table public.blog_posts
add constraint blog_posts_content_trimmed_check check (char_length(trim(content)) > 0);

alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts
add constraint blog_posts_status_check check (status in ('published', 'draft', 'archived'));

alter table public.blog_posts drop constraint if exists blog_posts_visibility_check;
alter table public.blog_posts
add constraint blog_posts_visibility_check check (visibility in ('public', 'private', 'password'));

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  page_type text not null default 'Custom Page',
  parent_page_id uuid null references public.site_pages(id) on delete set null,
  meta_description text not null default '',
  content text not null default '',
  featured_image_url text null,
  status text not null default 'draft',
  visibility text not null default 'public',
  template text not null default 'Default Template',
  show_in_navigation boolean not null default true,
  display_order integer not null default 0,
  meta_title text not null default '',
  meta_keywords text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint site_pages_title_trimmed_check check (char_length(trim(title)) > 0),
  constraint site_pages_slug_trimmed_check check (char_length(trim(slug)) > 0),
  constraint site_pages_content_trimmed_check check (char_length(trim(content)) > 0),
  constraint site_pages_status_check check (status in ('published', 'draft', 'archived')),
  constraint site_pages_visibility_check check (visibility in ('public', 'private', 'password')),
  constraint site_pages_display_order_check check (display_order >= 0)
);

alter table public.site_pages add column if not exists id uuid default gen_random_uuid();
alter table public.site_pages add column if not exists title text;
alter table public.site_pages add column if not exists slug text;
alter table public.site_pages add column if not exists page_type text not null default 'Custom Page';
alter table public.site_pages add column if not exists parent_page_id uuid null references public.site_pages(id) on delete set null;
alter table public.site_pages add column if not exists meta_description text not null default '';
alter table public.site_pages add column if not exists content text not null default '';
alter table public.site_pages add column if not exists featured_image_url text null;
alter table public.site_pages add column if not exists status text not null default 'draft';
alter table public.site_pages add column if not exists visibility text not null default 'public';
alter table public.site_pages add column if not exists template text not null default 'Default Template';
alter table public.site_pages add column if not exists show_in_navigation boolean not null default true;
alter table public.site_pages add column if not exists display_order integer not null default 0;
alter table public.site_pages add column if not exists meta_title text not null default '';
alter table public.site_pages add column if not exists meta_keywords text not null default '';
alter table public.site_pages add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.site_pages add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.site_pages
  alter column id set not null,
  alter column title set not null,
  alter column slug set not null,
  alter column page_type set not null,
  alter column meta_description set not null,
  alter column content set not null,
  alter column status set not null,
  alter column visibility set not null,
  alter column template set not null,
  alter column show_in_navigation set not null,
  alter column display_order set not null,
  alter column meta_title set not null,
  alter column meta_keywords set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_pages_pkey'
      and conrelid = 'public.site_pages'::regclass
  ) then
    alter table public.site_pages add constraint site_pages_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_pages_slug_key'
      and conrelid = 'public.site_pages'::regclass
  ) then
    alter table public.site_pages add constraint site_pages_slug_key unique (slug);
  end if;
end $$;

alter table public.site_pages drop constraint if exists site_pages_title_trimmed_check;
alter table public.site_pages
add constraint site_pages_title_trimmed_check check (char_length(trim(title)) > 0);

alter table public.site_pages drop constraint if exists site_pages_slug_trimmed_check;
alter table public.site_pages
add constraint site_pages_slug_trimmed_check check (char_length(trim(slug)) > 0);

alter table public.site_pages drop constraint if exists site_pages_content_trimmed_check;
alter table public.site_pages
add constraint site_pages_content_trimmed_check check (char_length(trim(content)) > 0);

alter table public.site_pages drop constraint if exists site_pages_status_check;
alter table public.site_pages
add constraint site_pages_status_check check (status in ('published', 'draft', 'archived'));

alter table public.site_pages drop constraint if exists site_pages_visibility_check;
alter table public.site_pages
add constraint site_pages_visibility_check check (visibility in ('public', 'private', 'password'));

alter table public.site_pages drop constraint if exists site_pages_display_order_check;
alter table public.site_pages
add constraint site_pages_display_order_check check (display_order >= 0);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  banner_type text not null default 'Homepage Hero',
  link_url text null,
  link_target text not null default 'same_window',
  priority integer not null default 1,
  display_order integer not null default 0,
  image_url text null,
  mobile_image_url text null,
  heading text not null default '',
  subheading text not null default '',
  description text not null default '',
  button_text text not null default '',
  button_style text not null default 'Primary',
  status text not null default 'draft',
  visibility text not null default 'public',
  display_on text not null default 'All Locations',
  device text not null default 'All Devices',
  starts_at timestamptz null,
  ends_at timestamptz null,
  show_homepage_only boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint banners_title_trimmed_check check (char_length(trim(title)) > 0),
  constraint banners_status_check check (status in ('active', 'inactive', 'draft')),
  constraint banners_visibility_check check (visibility in ('public', 'logged_in', 'password')),
  constraint banners_link_target_check check (link_target in ('same_window', 'new_tab')),
  constraint banners_priority_check check (priority >= 1),
  constraint banners_display_order_check check (display_order >= 0),
  constraint banners_date_range_check check (starts_at is null or ends_at is null or starts_at <= ends_at)
);

alter table public.banners add column if not exists id uuid default gen_random_uuid();
alter table public.banners add column if not exists title text;
alter table public.banners add column if not exists banner_type text not null default 'Homepage Hero';
alter table public.banners add column if not exists link_url text null;
alter table public.banners add column if not exists link_target text not null default 'same_window';
alter table public.banners add column if not exists priority integer not null default 1;
alter table public.banners add column if not exists display_order integer not null default 0;
alter table public.banners add column if not exists image_url text null;
alter table public.banners add column if not exists mobile_image_url text null;
alter table public.banners add column if not exists heading text not null default '';
alter table public.banners add column if not exists subheading text not null default '';
alter table public.banners add column if not exists description text not null default '';
alter table public.banners add column if not exists button_text text not null default '';
alter table public.banners add column if not exists button_style text not null default 'Primary';
alter table public.banners add column if not exists status text not null default 'draft';
alter table public.banners add column if not exists visibility text not null default 'public';
alter table public.banners add column if not exists display_on text not null default 'All Locations';
alter table public.banners add column if not exists device text not null default 'All Devices';
alter table public.banners add column if not exists starts_at timestamptz null;
alter table public.banners add column if not exists ends_at timestamptz null;
alter table public.banners add column if not exists show_homepage_only boolean not null default false;
alter table public.banners add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.banners add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.banners
  alter column id set not null,
  alter column title set not null,
  alter column banner_type set not null,
  alter column link_target set not null,
  alter column priority set not null,
  alter column display_order set not null,
  alter column heading set not null,
  alter column subheading set not null,
  alter column description set not null,
  alter column button_text set not null,
  alter column button_style set not null,
  alter column status set not null,
  alter column visibility set not null,
  alter column display_on set not null,
  alter column device set not null,
  alter column show_homepage_only set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'banners_pkey'
      and conrelid = 'public.banners'::regclass
  ) then
    alter table public.banners add constraint banners_pkey primary key (id);
  end if;
end $$;

alter table public.banners drop constraint if exists banners_title_trimmed_check;
alter table public.banners
add constraint banners_title_trimmed_check check (char_length(trim(title)) > 0);

alter table public.banners drop constraint if exists banners_status_check;
alter table public.banners
add constraint banners_status_check check (status in ('active', 'inactive', 'draft'));

alter table public.banners drop constraint if exists banners_visibility_check;
alter table public.banners
add constraint banners_visibility_check check (visibility in ('public', 'logged_in', 'password'));

alter table public.banners drop constraint if exists banners_link_target_check;
alter table public.banners
add constraint banners_link_target_check check (link_target in ('same_window', 'new_tab'));

alter table public.banners drop constraint if exists banners_priority_check;
alter table public.banners
add constraint banners_priority_check check (priority >= 1);

alter table public.banners drop constraint if exists banners_display_order_check;
alter table public.banners
add constraint banners_display_order_check check (display_order >= 0);

alter table public.banners drop constraint if exists banners_date_range_check;
alter table public.banners
add constraint banners_date_range_check check (starts_at is null or ends_at is null or starts_at <= ends_at);

create table if not exists public.fund_allocation_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  color text not null default '#111114',
  percentage_basis_points integer not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fund_allocation_rules_percentage_check check (percentage_basis_points >= 0 and percentage_basis_points <= 10000)
);

alter table public.fund_allocation_rules add column if not exists code text;
alter table public.fund_allocation_rules add column if not exists name text;
alter table public.fund_allocation_rules add column if not exists description text null;
alter table public.fund_allocation_rules add column if not exists color text not null default '#111114';
alter table public.fund_allocation_rules add column if not exists percentage_basis_points integer not null default 0;
alter table public.fund_allocation_rules add column if not exists display_order integer not null default 0;
alter table public.fund_allocation_rules add column if not exists is_active boolean not null default true;
alter table public.fund_allocation_rules add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.fund_allocation_rules add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.fund_allocation_rules
  alter column code set not null,
  alter column name set not null,
  alter column color set not null,
  alter column percentage_basis_points set not null,
  alter column display_order set not null,
  alter column is_active set not null;

alter table public.fund_allocation_rules drop constraint if exists fund_allocation_rules_percentage_check;
alter table public.fund_allocation_rules
add constraint fund_allocation_rules_percentage_check check (percentage_basis_points >= 0 and percentage_basis_points <= 10000);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fund_allocation_rules_code_key'
      and conrelid = 'public.fund_allocation_rules'::regclass
  ) then
    alter table public.fund_allocation_rules add constraint fund_allocation_rules_code_key unique (code);
  end if;
end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  payment_method text not null default 'mock',
  payment_type text null,
  wallet_provider text null,
  network text null,
  token_type text null,
  token_standard text null,
  tx_hash text null,
  signature text null,
  wallet_address text null,
  sender_wallet_address text null,
  recipient_address text null,
  chain_id bigint null,
  amount_expected numeric not null,
  amount_expected_fiat numeric null,
  fiat_currency text null,
  conversion_rate numeric null,
  usd_conversion_rate numeric null,
  coingecko_crypto_price numeric null,
  binance_crypto_price numeric null,
  price_difference_percent numeric null,
  slippage_buffer_percent numeric null,
  base_crypto_amount numeric null,
  slippage_buffer_amount numeric null,
  quote_source text null,
  quote_updated_at timestamptz null,
  quote_expires_at timestamptz null,
  amount_received numeric null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_status_check check (status in ('pending', 'paid', 'cancelled', 'failed'))
);

alter table public.payments add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.payments add column if not exists user_id uuid null references auth.users(id) on delete set null;
alter table public.payments add column if not exists payment_method text not null default 'mock';
alter table public.payments add column if not exists payment_type text null;
alter table public.payments add column if not exists wallet_provider text null;
alter table public.payments add column if not exists network text null;
alter table public.payments add column if not exists token_type text null;
alter table public.payments add column if not exists token_standard text null;
alter table public.payments add column if not exists tx_hash text null;
alter table public.payments add column if not exists signature text null;
alter table public.payments add column if not exists wallet_address text null;
alter table public.payments add column if not exists sender_wallet_address text null;
alter table public.payments add column if not exists recipient_address text null;
alter table public.payments add column if not exists chain_id bigint null;
alter table public.payments add column if not exists amount_expected numeric not null default 0;
alter table public.payments add column if not exists amount_expected_fiat numeric null;
alter table public.payments add column if not exists fiat_currency text null;
alter table public.payments add column if not exists conversion_rate numeric null;
alter table public.payments add column if not exists usd_conversion_rate numeric null;
alter table public.payments add column if not exists coingecko_crypto_price numeric null;
alter table public.payments add column if not exists binance_crypto_price numeric null;
alter table public.payments add column if not exists price_difference_percent numeric null;
alter table public.payments add column if not exists slippage_buffer_percent numeric null;
alter table public.payments add column if not exists base_crypto_amount numeric null;
alter table public.payments add column if not exists slippage_buffer_amount numeric null;
alter table public.payments add column if not exists quote_source text null;
alter table public.payments add column if not exists quote_updated_at timestamptz null;
alter table public.payments add column if not exists quote_expires_at timestamptz null;
alter table public.payments add column if not exists amount_received numeric null;
alter table public.payments add column if not exists status text not null default 'pending';
alter table public.payments add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.payments add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
add constraint payments_status_check check (status in ('pending', 'paid', 'cancelled', 'failed'));

alter table public.payments drop constraint if exists payments_payment_type_check;
alter table public.payments
add constraint payments_payment_type_check check (
  payment_type is null
  or payment_type in ('evm_eth', 'evm_usdc', 'evm_usdt', 'sol_sol', 'sol_usdc', 'sol_usdt')
);

alter table public.payments drop constraint if exists payments_wallet_provider_check;
alter table public.payments
add constraint payments_wallet_provider_check check (
  wallet_provider is null
  or wallet_provider in ('metamask', 'phantom')
);

alter table public.payments drop constraint if exists payments_network_check;
alter table public.payments
add constraint payments_network_check check (
  network is null
  or network in ('ethereum-mainnet', 'mainnet-beta')
);

alter table public.payments drop constraint if exists payments_token_type_check;
alter table public.payments
add constraint payments_token_type_check check (
  token_type is null
  or token_type in ('ETH', 'SOL', 'USDC', 'USDT')
);

alter table public.payments drop constraint if exists payments_token_standard_check;
alter table public.payments
add constraint payments_token_standard_check check (
  token_standard is null
  or token_standard in ('native', 'erc20', 'spl')
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  allocation_rule_id uuid null references public.fund_allocation_rules(id) on delete set null,
  allocation_code text not null,
  allocation_name text not null,
  allocation_description text null,
  allocation_color text not null default '#111114',
  percentage_basis_points integer not null,
  base_amount numeric not null default 0,
  currency text not null,
  allocated_amount numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_allocations_percentage_check check (percentage_basis_points >= 0 and percentage_basis_points <= 10000)
);

create table if not exists public.admin_cash_outs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  payment_method text not null,
  chain_id bigint not null default 1,
  source_mode text not null default 'proportional',
  source_allocation_code text null,
  source_allocation_name text null,
  amount numeric not null default 0,
  amount_input_mode text not null default 'asset',
  amount_php_equivalent numeric null,
  quote_php_per_eth numeric null,
  quote_source text null,
  quote_updated_at timestamptz null,
  sender_wallet_address text not null,
  destination_wallet_address text not null,
  tx_hash text not null,
  available_before numeric not null default 0,
  available_after numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_cash_outs_amount_check check (amount > 0),
  constraint admin_cash_outs_source_mode_check check (source_mode in ('bucket', 'proportional')),
  constraint admin_cash_outs_amount_input_mode_check check (amount_input_mode in ('asset', 'eth', 'php')),
  constraint admin_cash_outs_amount_php_equivalent_check check (amount_php_equivalent is null or amount_php_equivalent > 0),
  constraint admin_cash_outs_quote_php_per_eth_check check (quote_php_per_eth is null or quote_php_per_eth > 0),
  constraint admin_cash_outs_payment_method_check check (char_length(trim(payment_method)) > 0),
  constraint admin_cash_outs_sender_wallet_address_check check (char_length(trim(sender_wallet_address)) > 0),
  constraint admin_cash_outs_destination_wallet_address_check check (char_length(trim(destination_wallet_address)) > 0),
  constraint admin_cash_outs_tx_hash_check check (char_length(trim(tx_hash)) > 0)
);

create table if not exists public.admin_cash_out_breakdowns (
  id uuid primary key default gen_random_uuid(),
  cash_out_id uuid not null references public.admin_cash_outs(id) on delete cascade,
  allocation_rule_id uuid null references public.fund_allocation_rules(id) on delete set null,
  allocation_code text not null,
  allocation_name text not null,
  allocation_color text not null default '#111114',
  amount numeric not null default 0,
  available_before numeric not null default 0,
  available_after numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_cash_out_breakdowns_amount_check check (amount > 0)
);

alter table public.payment_allocations add column if not exists payment_id uuid references public.payments(id) on delete cascade;
alter table public.payment_allocations add column if not exists allocation_rule_id uuid null references public.fund_allocation_rules(id) on delete set null;
alter table public.payment_allocations add column if not exists allocation_code text;
alter table public.payment_allocations add column if not exists allocation_name text;
alter table public.payment_allocations add column if not exists allocation_description text null;
alter table public.payment_allocations add column if not exists allocation_color text not null default '#111114';
alter table public.payment_allocations add column if not exists percentage_basis_points integer not null default 0;
alter table public.payment_allocations add column if not exists base_amount numeric not null default 0;
alter table public.payment_allocations add column if not exists currency text not null default 'PHP';
alter table public.payment_allocations add column if not exists allocated_amount numeric not null default 0;
alter table public.payment_allocations add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.payment_allocations add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.admin_cash_outs add column if not exists request_id uuid;
alter table public.admin_cash_outs add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.admin_cash_outs add column if not exists payment_method text not null default 'eth';
alter table public.admin_cash_outs add column if not exists chain_id bigint not null default 1;
alter table public.admin_cash_outs add column if not exists source_mode text not null default 'proportional';
alter table public.admin_cash_outs add column if not exists source_allocation_code text null;
alter table public.admin_cash_outs add column if not exists source_allocation_name text null;
alter table public.admin_cash_outs add column if not exists amount numeric not null default 0;
alter table public.admin_cash_outs add column if not exists amount_input_mode text not null default 'asset';
alter table public.admin_cash_outs add column if not exists amount_php_equivalent numeric null;
alter table public.admin_cash_outs add column if not exists quote_php_per_eth numeric null;
alter table public.admin_cash_outs add column if not exists quote_source text null;
alter table public.admin_cash_outs add column if not exists quote_updated_at timestamptz null;
alter table public.admin_cash_outs add column if not exists sender_wallet_address text not null default '';
alter table public.admin_cash_outs add column if not exists destination_wallet_address text not null default '';
alter table public.admin_cash_outs add column if not exists tx_hash text not null default '';
alter table public.admin_cash_outs add column if not exists available_before numeric not null default 0;
alter table public.admin_cash_outs add column if not exists available_after numeric not null default 0;
alter table public.admin_cash_outs add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.admin_cash_outs add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.admin_cash_out_breakdowns add column if not exists cash_out_id uuid references public.admin_cash_outs(id) on delete cascade;
alter table public.admin_cash_out_breakdowns add column if not exists allocation_rule_id uuid null references public.fund_allocation_rules(id) on delete set null;
alter table public.admin_cash_out_breakdowns add column if not exists allocation_code text;
alter table public.admin_cash_out_breakdowns add column if not exists allocation_name text;
alter table public.admin_cash_out_breakdowns add column if not exists allocation_color text not null default '#111114';
alter table public.admin_cash_out_breakdowns add column if not exists amount numeric not null default 0;
alter table public.admin_cash_out_breakdowns add column if not exists available_before numeric not null default 0;
alter table public.admin_cash_out_breakdowns add column if not exists available_after numeric not null default 0;
alter table public.admin_cash_out_breakdowns add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.admin_cash_out_breakdowns add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.payment_allocations
  alter column payment_id set not null,
  alter column allocation_code set not null,
  alter column allocation_name set not null,
  alter column allocation_color set not null,
  alter column percentage_basis_points set not null,
  alter column base_amount set not null,
  alter column currency set not null,
  alter column allocated_amount set not null;

alter table public.admin_cash_outs
  alter column request_id set not null,
  alter column created_by set not null,
  alter column payment_method set not null,
  alter column chain_id set not null,
  alter column source_mode set not null,
  alter column amount set not null,
  alter column amount_input_mode set not null,
  alter column sender_wallet_address set not null,
  alter column destination_wallet_address set not null,
  alter column tx_hash set not null,
  alter column available_before set not null,
  alter column available_after set not null;

alter table public.admin_cash_out_breakdowns
  alter column cash_out_id set not null,
  alter column allocation_code set not null,
  alter column allocation_name set not null,
  alter column allocation_color set not null,
  alter column amount set not null,
  alter column available_before set not null,
  alter column available_after set not null;

alter table public.payment_allocations drop constraint if exists payment_allocations_percentage_check;
alter table public.payment_allocations
add constraint payment_allocations_percentage_check check (percentage_basis_points >= 0 and percentage_basis_points <= 10000);

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_amount_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_amount_check check (amount > 0);

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_source_mode_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_source_mode_check check (source_mode in ('bucket', 'proportional'));

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_amount_input_mode_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_amount_input_mode_check check (amount_input_mode in ('asset', 'eth', 'php'));

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_amount_php_equivalent_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_amount_php_equivalent_check check (amount_php_equivalent is null or amount_php_equivalent > 0);

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_quote_php_per_eth_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_quote_php_per_eth_check check (quote_php_per_eth is null or quote_php_per_eth > 0);

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_payment_method_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_payment_method_check check (char_length(trim(payment_method)) > 0);

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_sender_wallet_address_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_sender_wallet_address_check check (char_length(trim(sender_wallet_address)) > 0);

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_destination_wallet_address_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_destination_wallet_address_check check (char_length(trim(destination_wallet_address)) > 0);

alter table public.admin_cash_outs drop constraint if exists admin_cash_outs_tx_hash_check;
alter table public.admin_cash_outs
add constraint admin_cash_outs_tx_hash_check check (char_length(trim(tx_hash)) > 0);

alter table public.admin_cash_out_breakdowns drop constraint if exists admin_cash_out_breakdowns_amount_check;
alter table public.admin_cash_out_breakdowns
add constraint admin_cash_out_breakdowns_amount_check check (amount > 0);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_wallet_address_idx on public.profiles (wallet_address);
create index if not exists customers_created_idx on public.customers (created_at desc);
create index if not exists customers_account_status_idx on public.customers (account_status, created_at desc);
create index if not exists customers_subscription_status_idx on public.customers (subscription_status, created_at desc);
create index if not exists products_status_published_idx on public.products (status, published_at desc, created_at desc);
create index if not exists products_featured_idx on public.products (show_in_featured, published_at desc);
create index if not exists products_new_arrivals_idx on public.products (show_in_new_arrivals, published_at desc);
create index if not exists collections_status_order_idx on public.collections (status, display_order, created_at desc);
create index if not exists collections_featured_idx on public.collections (is_featured, display_order, created_at desc);
create index if not exists admin_settings_key_idx on public.admin_settings (key);
create unique index if not exists admin_notifications_dedupe_channel_idx
on public.admin_notifications (dedupe_key, channel);
create index if not exists admin_notifications_created_at_idx on public.admin_notifications (created_at desc);
create index if not exists admin_notifications_read_at_idx on public.admin_notifications (read_at);
create index if not exists campaigns_status_created_idx on public.campaigns (status, created_at desc);
create index if not exists campaigns_type_created_idx on public.campaigns (campaign_type, created_at desc);
create index if not exists campaigns_channels_idx on public.campaigns using gin (channels);
create index if not exists campaigns_tags_idx on public.campaigns using gin (tags);
create index if not exists coupons_code_idx on public.coupons (code);
create index if not exists coupons_status_validity_idx on public.coupons (status, starts_at, ends_at, created_at desc);
create index if not exists coupons_assigned_user_idx on public.coupons (assigned_user_id);
create index if not exists coupons_assigned_customer_email_idx on public.coupons (assigned_customer_email);
create index if not exists orders_order_number_idx on public.orders (order_number);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_coupon_id_idx on public.orders (coupon_id);
create index if not exists orders_coupon_code_idx on public.orders (coupon_code);
create index if not exists orders_attribution_idx on public.orders (source, utm_source, campaign_name, utm_campaign);
create index if not exists order_items_order_id_idx on public.order_items (order_id, created_at asc);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists coupon_redemptions_coupon_created_idx on public.coupon_redemptions (coupon_id, created_at desc);
create index if not exists coupon_redemptions_order_id_idx on public.coupon_redemptions (order_id);
create index if not exists coupon_redemptions_user_coupon_idx on public.coupon_redemptions (user_id, coupon_id);
create index if not exists coupon_redemptions_email_coupon_idx on public.coupon_redemptions (customer_email, coupon_id);
create index if not exists reviews_product_status_idx on public.reviews (product_id, status, is_featured desc, submitted_at desc);
create index if not exists reviews_status_idx on public.reviews (status, submitted_at desc);
create index if not exists reviews_order_id_idx on public.reviews (order_id);
create index if not exists reviews_customer_key_idx on public.reviews (customer_key, submitted_at desc);
create index if not exists blog_posts_slug_idx on public.blog_posts (slug);
create index if not exists blog_posts_status_publish_idx on public.blog_posts (status, visibility, publish_at desc, created_at desc);
create index if not exists blog_posts_categories_idx on public.blog_posts using gin (categories);
create index if not exists blog_posts_tags_idx on public.blog_posts using gin (tags);
create index if not exists site_pages_slug_idx on public.site_pages (slug);
create index if not exists site_pages_status_order_idx on public.site_pages (status, visibility, display_order, created_at desc);
create index if not exists site_pages_parent_idx on public.site_pages (parent_page_id);
create index if not exists banners_status_order_idx on public.banners (status, visibility, priority, display_order, created_at desc);
create index if not exists banners_display_on_idx on public.banners (display_on, device, priority, display_order);
create index if not exists fund_allocation_rules_active_order_idx on public.fund_allocation_rules (is_active, display_order);
create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_chain_id_idx on public.payments (chain_id);
create index if not exists orders_product_id_idx on public.orders (product_id);
create unique index if not exists payments_tx_hash_unique_idx on public.payments (tx_hash) where tx_hash is not null;
create index if not exists payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create index if not exists payment_allocations_code_idx on public.payment_allocations (allocation_code);
create unique index if not exists payment_allocations_payment_code_unique_idx on public.payment_allocations (payment_id, allocation_code);
create index if not exists admin_cash_outs_payment_method_created_idx on public.admin_cash_outs (payment_method, created_at desc);
create unique index if not exists admin_cash_outs_request_id_unique_idx on public.admin_cash_outs (request_id);
create unique index if not exists admin_cash_outs_tx_hash_unique_idx on public.admin_cash_outs (tx_hash);
create index if not exists admin_cash_out_breakdowns_cash_out_id_idx on public.admin_cash_out_breakdowns (cash_out_id);
create index if not exists admin_cash_out_breakdowns_code_idx on public.admin_cash_out_breakdowns (allocation_code);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fund_allocation_rules'
  ) then
    alter publication supabase_realtime add table public.fund_allocation_rules;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payment_allocations'
  ) then
    alter publication supabase_realtime add table public.payment_allocations;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_cash_outs'
  ) then
    alter publication supabase_realtime add table public.admin_cash_outs;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_cash_out_breakdowns'
  ) then
    alter publication supabase_realtime add table public.admin_cash_out_breakdowns;
  end if;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

drop trigger if exists admin_settings_set_updated_at on public.admin_settings;
create trigger admin_settings_set_updated_at
before update on public.admin_settings
for each row execute function public.set_updated_at();

drop trigger if exists admin_notifications_set_updated_at on public.admin_notifications;
create trigger admin_notifications_set_updated_at
before update on public.admin_notifications
for each row execute function public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists order_items_set_updated_at on public.order_items;
create trigger order_items_set_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
before update on public.blog_posts
for each row execute function public.set_updated_at();

drop trigger if exists site_pages_set_updated_at on public.site_pages;
create trigger site_pages_set_updated_at
before update on public.site_pages
for each row execute function public.set_updated_at();

drop trigger if exists banners_set_updated_at on public.banners;
create trigger banners_set_updated_at
before update on public.banners
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists fund_allocation_rules_set_updated_at on public.fund_allocation_rules;
create trigger fund_allocation_rules_set_updated_at
before update on public.fund_allocation_rules
for each row execute function public.set_updated_at();

drop trigger if exists payment_allocations_set_updated_at on public.payment_allocations;
create trigger payment_allocations_set_updated_at
before update on public.payment_allocations
for each row execute function public.set_updated_at();

drop trigger if exists admin_cash_outs_set_updated_at on public.admin_cash_outs;
create trigger admin_cash_outs_set_updated_at
before update on public.admin_cash_outs
for each row execute function public.set_updated_at();

drop trigger if exists admin_cash_out_breakdowns_set_updated_at on public.admin_cash_out_breakdowns;
create trigger admin_cash_out_breakdowns_set_updated_at
before update on public.admin_cash_out_breakdowns
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create or replace function public.is_management_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'owner')
  );
$$;

create or replace function public.rebuild_payment_allocations(target_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.payments%rowtype;
  allocation_rule public.fund_allocation_rules%rowtype;
  base_amount numeric;
  base_currency text;
  active_rule_count integer := 0;
  current_rule_index integer := 0;
  allocated_amount numeric;
  remaining_amount numeric;
begin
  select *
  into payment_record
  from public.payments
  where id = target_payment_id;

  if not found then
    delete from public.payment_allocations where payment_id = target_payment_id;
    return;
  end if;

  if payment_record.status <> 'paid' then
    delete from public.payment_allocations where payment_id = target_payment_id;
    return;
  end if;

  if payment_record.amount_expected_fiat is not null and payment_record.amount_expected_fiat > 0 then
    base_amount := payment_record.amount_expected_fiat;
    base_currency := coalesce(nullif(payment_record.fiat_currency, ''), 'PHP');
  elsif payment_record.amount_received is not null and payment_record.amount_received > 0 then
    base_amount := payment_record.amount_received;
    base_currency := upper(coalesce(nullif(payment_record.payment_method, ''), 'FUNDS'));
  else
    base_amount := payment_record.amount_expected;
    base_currency := upper(coalesce(nullif(payment_record.payment_method, ''), 'FUNDS'));
  end if;

  if base_amount is null or base_amount <= 0 then
    delete from public.payment_allocations where payment_id = target_payment_id;
    return;
  end if;

  select count(*)
  into active_rule_count
  from public.fund_allocation_rules
  where is_active = true;

  if active_rule_count = 0 then
    delete from public.payment_allocations where payment_id = target_payment_id;
    return;
  end if;

  remaining_amount := base_amount;

  for allocation_rule in
    select *
    from public.fund_allocation_rules
    where is_active = true
    order by display_order asc, created_at asc, id asc
  loop
    current_rule_index := current_rule_index + 1;

    if current_rule_index = active_rule_count then
      allocated_amount := round(remaining_amount, 8);
    else
      allocated_amount := round((base_amount * allocation_rule.percentage_basis_points::numeric) / 10000, 8);
      remaining_amount := remaining_amount - allocated_amount;
    end if;

    insert into public.payment_allocations (
      payment_id,
      allocation_rule_id,
      allocation_code,
      allocation_name,
      allocation_description,
      allocation_color,
      percentage_basis_points,
      base_amount,
      currency,
      allocated_amount
    )
    values (
      payment_record.id,
      allocation_rule.id,
      allocation_rule.code,
      allocation_rule.name,
      allocation_rule.description,
      allocation_rule.color,
      allocation_rule.percentage_basis_points,
      base_amount,
      base_currency,
      allocated_amount
    )
    on conflict (payment_id, allocation_code)
    do update set
      allocation_rule_id = excluded.allocation_rule_id,
      allocation_name = excluded.allocation_name,
      allocation_description = excluded.allocation_description,
      allocation_color = excluded.allocation_color,
      percentage_basis_points = excluded.percentage_basis_points,
      base_amount = excluded.base_amount,
      currency = excluded.currency,
      allocated_amount = excluded.allocated_amount,
      updated_at = timezone('utc', now());
  end loop;

  delete from public.payment_allocations
  where payment_id = target_payment_id
    and allocation_code not in (
      select code
      from public.fund_allocation_rules
      where is_active = true
    );
end;
$$;

create or replace function public.sync_payment_allocations_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rebuild_payment_allocations(new.id);
  return new;
end;
$$;

create or replace function public.finalize_verified_payment(
  p_payment_id uuid,
  p_tx_hash text,
  p_wallet_address text,
  p_recipient_address text,
  p_chain_id bigint,
  p_amount_received numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.payments%rowtype;
  order_record public.orders%rowtype;
  payment_payload jsonb;
  order_payload jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role access required.';
  end if;

  if p_payment_id is null then
    raise exception 'Payment ID is invalid.';
  end if;

  if nullif(trim(coalesce(p_tx_hash, '')), '') is null then
    raise exception 'Transaction hash is invalid.';
  end if;

  if nullif(trim(coalesce(p_wallet_address, '')), '') is null then
    raise exception 'Wallet address is invalid.';
  end if;

  if nullif(trim(coalesce(p_recipient_address, '')), '') is null then
    raise exception 'Recipient address is invalid.';
  end if;

  if p_chain_id is null or p_chain_id <= 0 then
    raise exception 'Chain ID is invalid.';
  end if;

  if p_amount_received is null or p_amount_received <= 0 then
    raise exception 'Received amount is invalid.';
  end if;

  select *
  into payment_record
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found.';
  end if;

  if payment_record.order_id is null then
    raise exception 'Payment is not attached to an order.';
  end if;

  select *
  into order_record
  from public.orders
  where id = payment_record.order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if order_record.status = 'cancelled' then
    raise exception 'Cancelled orders cannot be paid.';
  end if;

  if exists (
    select 1
    from public.payments
    where id <> p_payment_id
      and tx_hash = trim(p_tx_hash)
  ) then
    raise exception 'This transaction hash is already attached to another payment.';
  end if;

  update public.payments
  set
    tx_hash = trim(p_tx_hash),
    wallet_address = trim(p_wallet_address),
    recipient_address = trim(p_recipient_address),
    chain_id = p_chain_id,
    amount_received = p_amount_received,
    status = 'paid'
  where id = p_payment_id
  returning * into payment_record;

  update public.orders
  set status = 'paid'
  where id = order_record.id
  returning * into order_record;

  perform public.rebuild_payment_allocations(payment_record.id);

  payment_payload := to_jsonb(payment_record);
  order_payload := to_jsonb(order_record);

  return jsonb_build_object(
    'payment', payment_payload,
    'order', order_payload
  );
end;
$$;

revoke execute on function public.finalize_verified_payment(uuid, text, text, text, bigint, numeric) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(uuid, text, text, text, bigint, numeric) to service_role;

create or replace function public.record_admin_cash_out_transfer(
  p_amount numeric,
  p_payment_method text,
  p_request_id uuid,
  p_created_by uuid,
  p_chain_id bigint,
  p_source_mode text,
  p_source_allocation_code text default null,
  p_amount_input_mode text default 'asset',
  p_amount_php_equivalent numeric default null,
  p_quote_php_per_eth numeric default null,
  p_quote_source text default null,
  p_quote_updated_at timestamptz default null,
  p_sender_wallet_address text default null,
  p_destination_wallet_address text default null,
  p_tx_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_payment_method text := lower(trim(coalesce(p_payment_method, '')));
  normalized_source_mode text := lower(trim(coalesce(p_source_mode, '')));
  normalized_source_allocation_code text := nullif(lower(trim(coalesce(p_source_allocation_code, ''))), '');
  normalized_amount_input_mode text := lower(trim(coalesce(p_amount_input_mode, 'asset')));
  cash_out_php_equivalent numeric := case
    when p_amount_php_equivalent is null then null
    else round(p_amount_php_equivalent, 2)
  end;
  quote_php_per_eth_value numeric := case
    when p_quote_php_per_eth is null then null
    else round(p_quote_php_per_eth, 6)
  end;
  normalized_quote_source text := nullif(trim(coalesce(p_quote_source, '')), '');
  normalized_sender_wallet_address text := trim(coalesce(p_sender_wallet_address, ''));
  normalized_destination_wallet_address text := trim(coalesce(p_destination_wallet_address, ''));
  normalized_tx_hash text := lower(trim(coalesce(p_tx_hash, '')));
  cash_out_amount numeric := round(coalesce(p_amount, 0), 8);
  available_before_total numeric := 0;
  positive_available_total numeric := 0;
  positive_bucket_count integer := 0;
  processed_positive_bucket_count integer := 0;
  remaining_amount numeric := 0;
  selected_bucket_found boolean := false;
  selected_allocation_rule_id uuid := null;
  selected_allocation_name text := null;
  selected_allocation_color text := '#111114';
  selected_available_before numeric := 0;
  breakdown_amount numeric := 0;
  bucket_record record;
  inserted_cash_out public.admin_cash_outs%rowtype;
begin
  if not public.is_management_user() then
    raise exception 'Management access required.';
  end if;

  if p_request_id is null then
    raise exception 'Request ID is invalid.';
  end if;

  if auth.uid() is distinct from p_created_by then
    raise exception 'Cash-out actor mismatch.';
  end if;

  if normalized_payment_method = '' then
    raise exception 'Cash-out asset is invalid.';
  end if;

  if cash_out_amount <= 0 then
    raise exception 'Cash-out amount must be greater than zero.';
  end if;

  if normalized_amount_input_mode not in ('asset', 'eth', 'php') then
    raise exception 'Cash-out amount mode is invalid.';
  end if;

  if p_chain_id is null or p_chain_id <= 0 then
    raise exception 'Cash-out chain is invalid.';
  end if;

  if normalized_source_mode not in ('bucket', 'proportional') then
    raise exception 'Cash-out source mode is invalid.';
  end if;

  if normalized_source_mode = 'bucket' and normalized_source_allocation_code is null then
    raise exception 'Cash-out source bucket is required.';
  end if;

  if normalized_sender_wallet_address = '' then
    raise exception 'Merchant wallet address is required.';
  end if;

  if normalized_destination_wallet_address = '' then
    raise exception 'Destination wallet address is required.';
  end if;

  if normalized_tx_hash = '' then
    raise exception 'Transaction hash is invalid.';
  end if;

  if normalized_payment_method = 'eth' then
    if normalized_amount_input_mode not in ('eth', 'php') then
      raise exception 'ETH cash-out amount mode is invalid.';
    end if;

    if quote_php_per_eth_value is null or quote_php_per_eth_value <= 0 then
      raise exception 'ETH/PHP quote is required for ETH cash-outs.';
    end if;

    if normalized_quote_source is null then
      raise exception 'Quote source is required for ETH cash-outs.';
    end if;

    if cash_out_php_equivalent is null or cash_out_php_equivalent <= 0 then
      raise exception 'Cash-out PHP equivalent is required for ETH cash-outs.';
    end if;
  else
    if normalized_amount_input_mode <> 'asset' then
      raise exception 'Only ETH cash-outs support PHP amount mode.';
    end if;

    cash_out_php_equivalent := null;
    quote_php_per_eth_value := null;
    normalized_quote_source := null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('admin_cash_out:' || normalized_payment_method, 0));

  if exists (
    select 1
    from public.admin_cash_outs
    where request_id = p_request_id
  ) then
    select *
    into inserted_cash_out
    from public.admin_cash_outs
    where request_id = p_request_id;
  else
    if exists (
      select 1
      from public.admin_cash_outs
      where tx_hash = normalized_tx_hash
    ) then
      raise exception 'This cash-out transaction hash is already recorded.';
    end if;

    for bucket_record in
      select
        r.id as allocation_rule_id,
        r.code as allocation_code,
        r.name as allocation_name,
        r.color as allocation_color,
        coalesce(
          (
            select sum(
              case
                when coalesce(p.amount_received, 0) > 0
                  then case
                    when pa.percentage_basis_points = 10000
                      then round(p.amount_received, 8)
                    else round((p.amount_received * pa.percentage_basis_points::numeric) / 10000, 8)
                  end
                else case
                  when pa.percentage_basis_points = 10000
                    then round(p.amount_expected, 8)
                  else round((p.amount_expected * pa.percentage_basis_points::numeric) / 10000, 8)
                end
              end
            )
            from public.payment_allocations pa
            join public.payments p on p.id = pa.payment_id
            where pa.allocation_code = r.code
              and p.status = 'paid'
              and lower(coalesce(nullif(p.payment_method, ''), '')) = normalized_payment_method
          ),
          0
        ) as gross_amount,
        coalesce(
          (
            select sum(b.amount)
            from public.admin_cash_out_breakdowns b
            join public.admin_cash_outs c on c.id = b.cash_out_id
            where b.allocation_code = r.code
              and lower(coalesce(nullif(c.payment_method, ''), '')) = normalized_payment_method
          ),
          0
        ) as withdrawn_amount,
        round(
          coalesce(
            (
              select sum(
                case
                  when coalesce(p.amount_received, 0) > 0
                    then case
                      when pa.percentage_basis_points = 10000
                        then round(p.amount_received, 8)
                      else round((p.amount_received * pa.percentage_basis_points::numeric) / 10000, 8)
                    end
                  else case
                    when pa.percentage_basis_points = 10000
                      then round(p.amount_expected, 8)
                    else round((p.amount_expected * pa.percentage_basis_points::numeric) / 10000, 8)
                  end
                end
              )
              from public.payment_allocations pa
              join public.payments p on p.id = pa.payment_id
              where pa.allocation_code = r.code
                and p.status = 'paid'
                and lower(coalesce(nullif(p.payment_method, ''), '')) = normalized_payment_method
            ),
            0
          ) -
          coalesce(
            (
              select sum(b.amount)
              from public.admin_cash_out_breakdowns b
              join public.admin_cash_outs c on c.id = b.cash_out_id
              where b.allocation_code = r.code
                and lower(coalesce(nullif(c.payment_method, ''), '')) = normalized_payment_method
            ),
            0
          ),
          8
        ) as available_amount
      from public.fund_allocation_rules r
      where r.is_active = true
      order by r.display_order asc, r.created_at asc, r.id asc
    loop
      available_before_total := round(available_before_total + bucket_record.available_amount, 8);

      if bucket_record.available_amount > 0 then
        positive_available_total := round(positive_available_total + bucket_record.available_amount, 8);
        positive_bucket_count := positive_bucket_count + 1;
      end if;

      if normalized_source_mode = 'bucket' and bucket_record.allocation_code = normalized_source_allocation_code then
        selected_bucket_found := true;
        selected_allocation_rule_id := bucket_record.allocation_rule_id;
        selected_allocation_name := bucket_record.allocation_name;
        selected_allocation_color := bucket_record.allocation_color;
        selected_available_before := bucket_record.available_amount;
      end if;
    end loop;

    available_before_total := round(available_before_total, 8);

    if available_before_total < cash_out_amount then
      raise exception 'Insufficient withdrawable balance for this cash-out.';
    end if;

    if normalized_source_mode = 'bucket' then
      if not selected_bucket_found then
        raise exception 'Selected cash-out source bucket was not found.';
      end if;

      if selected_available_before < cash_out_amount then
        raise exception 'Insufficient withdrawable balance for the selected cash-out source bucket.';
      end if;
    else
      if positive_bucket_count = 0 or positive_available_total <= 0 then
        raise exception 'No bucket balance is available for a proportional cash-out.';
      end if;
    end if;

    insert into public.admin_cash_outs (
      request_id,
      created_by,
      payment_method,
      chain_id,
      source_mode,
      source_allocation_code,
      source_allocation_name,
      amount,
      amount_input_mode,
      amount_php_equivalent,
      quote_php_per_eth,
      quote_source,
      quote_updated_at,
      sender_wallet_address,
      destination_wallet_address,
      tx_hash,
      available_before,
      available_after
    )
    values (
      p_request_id,
      p_created_by,
      normalized_payment_method,
      p_chain_id,
      normalized_source_mode,
      case when normalized_source_mode = 'bucket' then normalized_source_allocation_code else null end,
      case when normalized_source_mode = 'bucket' then selected_allocation_name else 'All Buckets / Proportional' end,
      cash_out_amount,
      normalized_amount_input_mode,
      cash_out_php_equivalent,
      quote_php_per_eth_value,
      normalized_quote_source,
      p_quote_updated_at,
      normalized_sender_wallet_address,
      normalized_destination_wallet_address,
      normalized_tx_hash,
      available_before_total,
      round(available_before_total - cash_out_amount, 8)
    )
    returning *
    into inserted_cash_out;

    if normalized_source_mode = 'bucket' then
      insert into public.admin_cash_out_breakdowns (
        cash_out_id,
        allocation_rule_id,
        allocation_code,
        allocation_name,
        allocation_color,
        amount,
        available_before,
        available_after
      )
      values (
        inserted_cash_out.id,
        selected_allocation_rule_id,
        normalized_source_allocation_code,
        selected_allocation_name,
        selected_allocation_color,
        cash_out_amount,
        selected_available_before,
        round(selected_available_before - cash_out_amount, 8)
      );
    else
      remaining_amount := cash_out_amount;

      for bucket_record in
        select
          r.id as allocation_rule_id,
          r.code as allocation_code,
          r.name as allocation_name,
          r.color as allocation_color,
          round(
            coalesce(
              (
                select sum(
                  case
                    when coalesce(p.amount_received, 0) > 0
                      then case
                        when pa.percentage_basis_points = 10000
                          then round(p.amount_received, 8)
                        else round((p.amount_received * pa.percentage_basis_points::numeric) / 10000, 8)
                      end
                    else case
                      when pa.percentage_basis_points = 10000
                        then round(p.amount_expected, 8)
                      else round((p.amount_expected * pa.percentage_basis_points::numeric) / 10000, 8)
                    end
                  end
                )
                from public.payment_allocations pa
                join public.payments p on p.id = pa.payment_id
                where pa.allocation_code = r.code
                  and p.status = 'paid'
                  and lower(coalesce(nullif(p.payment_method, ''), '')) = normalized_payment_method
              ),
              0
            ) -
            coalesce(
              (
                select sum(b.amount)
                from public.admin_cash_out_breakdowns b
                join public.admin_cash_outs c on c.id = b.cash_out_id
                where b.allocation_code = r.code
                  and lower(coalesce(nullif(c.payment_method, ''), '')) = normalized_payment_method
              ),
              0
            ),
            8
          ) as available_amount
        from public.fund_allocation_rules r
        where r.is_active = true
        order by r.display_order asc, r.created_at asc, r.id asc
      loop
        if bucket_record.available_amount <= 0 then
          continue;
        end if;

        processed_positive_bucket_count := processed_positive_bucket_count + 1;

        if processed_positive_bucket_count = positive_bucket_count then
          breakdown_amount := round(remaining_amount, 8);
        else
          breakdown_amount := round((cash_out_amount * bucket_record.available_amount) / positive_available_total, 8);
        end if;

        if breakdown_amount <= 0 then
          continue;
        end if;

        if breakdown_amount > bucket_record.available_amount then
          breakdown_amount := bucket_record.available_amount;
        end if;

        remaining_amount := round(remaining_amount - breakdown_amount, 8);

        insert into public.admin_cash_out_breakdowns (
          cash_out_id,
          allocation_rule_id,
          allocation_code,
          allocation_name,
          allocation_color,
          amount,
          available_before,
          available_after
        )
        values (
          inserted_cash_out.id,
          bucket_record.allocation_rule_id,
          bucket_record.allocation_code,
          bucket_record.allocation_name,
          bucket_record.allocation_color,
          breakdown_amount,
          bucket_record.available_amount,
          round(bucket_record.available_amount - breakdown_amount, 8)
        );
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'id', inserted_cash_out.id,
    'request_id', inserted_cash_out.request_id,
    'created_by', inserted_cash_out.created_by,
    'payment_method', inserted_cash_out.payment_method,
    'chain_id', inserted_cash_out.chain_id,
    'source_mode', inserted_cash_out.source_mode,
    'source_allocation_code', inserted_cash_out.source_allocation_code,
    'source_allocation_name', inserted_cash_out.source_allocation_name,
    'amount', inserted_cash_out.amount,
    'amount_input_mode', inserted_cash_out.amount_input_mode,
    'amount_php_equivalent', inserted_cash_out.amount_php_equivalent,
    'quote_php_per_eth', inserted_cash_out.quote_php_per_eth,
    'quote_source', inserted_cash_out.quote_source,
    'quote_updated_at', inserted_cash_out.quote_updated_at,
    'sender_wallet_address', inserted_cash_out.sender_wallet_address,
    'destination_wallet_address', inserted_cash_out.destination_wallet_address,
    'tx_hash', inserted_cash_out.tx_hash,
    'available_before', inserted_cash_out.available_before,
    'available_after', inserted_cash_out.available_after,
    'created_at', inserted_cash_out.created_at,
    'updated_at', inserted_cash_out.updated_at
  );
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists payment_allocations_sync_after_payment on public.payments;
create trigger payment_allocations_sync_after_payment
after insert or update of status, amount_received, amount_expected_fiat, fiat_currency, payment_method on public.payments
for each row execute function public.sync_payment_allocations_trigger();

insert into public.fund_allocation_rules (code, name, description, color, percentage_basis_points, display_order, is_active)
values
  ('product_reinvestment', 'Product Reinvestment', 'Reinvested into product creation, inventory depth, and collection growth.', '#111114', 5000, 1, true),
  ('liquidity_pool', 'Liquidity Pool (LPs)', 'Supports the liquidity side of the ecosystem and market stability initiatives.', '#7e7468', 1500, 2, true),
  ('rewards_cashback', 'Rewards / Cashback', 'Customer rewards, cashback, and loyalty-aligned incentives.', '#b88b5c', 1000, 3, true),
  ('ops_cto', 'Ops & CTO', 'Operations, technical oversight, and core execution support.', '#5c6670', 1000, 4, true),
  ('marketing', 'Marketing', 'Campaigns, launches, visibility, and audience growth programs.', '#d7c8b5', 1000, 5, true),
  ('emergency_fund', 'Emergency Fund', 'Protective reserve for volatility, urgent support, and downside events.', '#3f3b39', 500, 6, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  percentage_basis_points = excluded.percentage_basis_points,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

delete from public.fund_allocation_rules
where code in ('atelier', 'growth', 'operations', 'community', 'reserve');

insert into public.products (
  id,
  name,
  brand,
  description,
  price_php_cents,
  department,
  category_label,
  main_image_url,
  hover_image_url,
  gallery_image_urls,
  size_inventory,
  status,
  show_in_new_arrivals,
  show_in_featured,
  published_at
)
values
  (
    'MIUF-WZ238',
    'Maison Mary Jane Flat',
    'VIONE HERNAL',
    'Glossed leather lines with an editorial finish for day-to-night dressing.',
    50000,
    'Womens',
    'Shoes',
    '/assets/images/maryjaneshoe.png',
    '/assets/images/maryjaneshoe.png',
    '[]'::jsonb,
    '{"36": 5, "37": 4, "38": 4, "39": 3}'::jsonb,
    'published',
    true,
    true,
    timezone('utc', now())
  ),
  (
    'BOFE-WS139',
    'Sheer Layered Co-Ord Set',
    'VIONE HERNAL',
    'Layered tailoring with a softened structure that keeps the silhouette refined.',
    150000,
    'Womens',
    'Ready to Wear',
    '/assets/images/SheerLayeredCo-OrdSet-1.png',
    '/assets/images/SheerLayeredCo-OrdSet.png',
    '[]'::jsonb,
    '{"XS": 5, "S": 4, "M": 3, "L": 2}'::jsonb,
    'published',
    true,
    true,
    timezone('utc', now())
  ),
  (
    'BOFE-WY20',
    'Rose Tweed Top Handle Bag',
    'VIONE HERNAL',
    'A statement carryall shaped with couture texture and a polished top-handle profile.',
    200000,
    'Womens',
    'Bags',
    '/assets/images/RoseTweedTopHandleBag.png',
    '/assets/images/RoseTweedTopHandleBag-1.png',
    '[]'::jsonb,
    '{"One Size": 4}'::jsonb,
    'published',
    true,
    true,
    timezone('utc', now())
  )
on conflict (id) do update set
  name = excluded.name,
  brand = excluded.brand,
  description = excluded.description,
  price_php_cents = excluded.price_php_cents,
  department = excluded.department,
  category_label = excluded.category_label,
  main_image_url = excluded.main_image_url,
  hover_image_url = excluded.hover_image_url,
  gallery_image_urls = excluded.gallery_image_urls,
  size_inventory = excluded.size_inventory,
  status = excluded.status,
  show_in_new_arrivals = excluded.show_in_new_arrivals,
  show_in_featured = excluded.show_in_featured,
  published_at = coalesce(products.published_at, excluded.published_at),
  updated_at = timezone('utc', now());

insert into public.collections (
  name,
  slug,
  description,
  image_url,
  status,
  collection_type,
  display_order,
  is_featured,
  created_at,
  updated_at
)
select
  category_label as name,
  lower(trim(both '-' from regexp_replace(category_label, '[^a-zA-Z0-9]+', '-', 'g'))) as slug,
  count(*)::text || ' product' || case when count(*) = 1 then '' else 's' end || ' assigned to this collection.' as description,
  min(main_image_url) as image_url,
  'active' as status,
  'manual' as collection_type,
  (row_number() over (order by category_label) - 1)::integer as display_order,
  bool_or(status = 'published' and show_in_featured) as is_featured,
  min(created_at) as created_at,
  max(updated_at) as updated_at
from public.products
where char_length(trim(category_label)) > 0
  and lower(trim(category_label)) not in ('collection', 'uncategorized')
group by category_label
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = coalesce(public.collections.image_url, excluded.image_url),
  is_featured = public.collections.is_featured or excluded.is_featured,
  updated_at = timezone('utc', now());

do $$
declare
  existing_payment record;
begin
  for existing_payment in
    select id
    from public.payments
    where status = 'paid'
  loop
    perform public.rebuild_payment_allocations(existing_payment.id);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.collections enable row level security;
alter table public.admin_settings enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.campaigns enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.blog_posts enable row level security;
alter table public.site_pages enable row level security;
alter table public.banners enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.payments enable row level security;
alter table public.fund_allocation_rules enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.admin_cash_outs enable row level security;
alter table public.admin_cash_out_breakdowns enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_select_management" on public.profiles;
create policy "profiles_select_management"
on public.profiles
for select
using (public.is_management_user());

drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "customers_select_management" on public.customers;
create policy "customers_select_management"
on public.customers
for select
using (public.is_management_user());

drop policy if exists "customers_insert_management" on public.customers;
create policy "customers_insert_management"
on public.customers
for insert
with check (public.is_management_user());

drop policy if exists "customers_update_management" on public.customers;
create policy "customers_update_management"
on public.customers
for update
using (public.is_management_user())
with check (public.is_management_user());

drop policy if exists "products_select_published" on public.products;
create policy "products_select_published"
on public.products
for select
using (status = 'published');

drop policy if exists "products_select_management" on public.products;
create policy "products_select_management"
on public.products
for select
using (public.is_management_user());

drop policy if exists "products_insert_management" on public.products;
create policy "products_insert_management"
on public.products
for insert
with check (public.is_management_user());

drop policy if exists "products_update_management" on public.products;
create policy "products_update_management"
on public.products
for update
using (public.is_management_user())
with check (public.is_management_user());

drop policy if exists "collections_select_active" on public.collections;
create policy "collections_select_active"
on public.collections
for select
using (status = 'active');

drop policy if exists "collections_select_management" on public.collections;
create policy "collections_select_management"
on public.collections
for select
using (public.is_management_user());

drop policy if exists "collections_insert_management" on public.collections;
create policy "collections_insert_management"
on public.collections
for insert
with check (public.is_management_user());

drop policy if exists "collections_update_management" on public.collections;
create policy "collections_update_management"
on public.collections
for update
using (public.is_management_user())
with check (public.is_management_user());

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

drop policy if exists "admin_notifications_select_management" on public.admin_notifications;
create policy "admin_notifications_select_management"
on public.admin_notifications
for select
using (public.is_management_user());

drop policy if exists "admin_notifications_insert_management" on public.admin_notifications;
create policy "admin_notifications_insert_management"
on public.admin_notifications
for insert
with check (public.is_management_user());

drop policy if exists "admin_notifications_update_management" on public.admin_notifications;
create policy "admin_notifications_update_management"
on public.admin_notifications
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

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
on public.orders
for select
using (auth.uid() = user_id);

drop policy if exists "orders_select_management" on public.orders;
create policy "orders_select_management"
on public.orders
for select
using (public.is_management_user());

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own"
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

drop policy if exists "order_items_select_management" on public.order_items;
create policy "order_items_select_management"
on public.order_items
for select
using (public.is_management_user());

drop policy if exists "reviews_select_approved" on public.reviews;
create policy "reviews_select_approved"
on public.reviews
for select
using (status = 'approved');

drop policy if exists "reviews_select_management" on public.reviews;
create policy "reviews_select_management"
on public.reviews
for select
using (public.is_management_user());

drop policy if exists "reviews_insert_management" on public.reviews;
create policy "reviews_insert_management"
on public.reviews
for insert
with check (public.is_management_user());

drop policy if exists "reviews_update_management" on public.reviews;
create policy "reviews_update_management"
on public.reviews
for update
using (public.is_management_user())
with check (public.is_management_user());

drop policy if exists "blog_posts_select_published" on public.blog_posts;
create policy "blog_posts_select_published"
on public.blog_posts
for select
using (
  status = 'published'
  and visibility = 'public'
  and (publish_at is null or publish_at <= now())
);

drop policy if exists "blog_posts_select_management" on public.blog_posts;
create policy "blog_posts_select_management"
on public.blog_posts
for select
using (public.is_management_user());

drop policy if exists "blog_posts_insert_management" on public.blog_posts;
create policy "blog_posts_insert_management"
on public.blog_posts
for insert
with check (public.is_management_user());

drop policy if exists "blog_posts_update_management" on public.blog_posts;
create policy "blog_posts_update_management"
on public.blog_posts
for update
using (public.is_management_user())
with check (public.is_management_user());

drop policy if exists "site_pages_select_published" on public.site_pages;
create policy "site_pages_select_published"
on public.site_pages
for select
using (status = 'published' and visibility = 'public');

drop policy if exists "site_pages_select_management" on public.site_pages;
create policy "site_pages_select_management"
on public.site_pages
for select
using (public.is_management_user());

drop policy if exists "site_pages_insert_management" on public.site_pages;
create policy "site_pages_insert_management"
on public.site_pages
for insert
with check (public.is_management_user());

drop policy if exists "site_pages_update_management" on public.site_pages;
create policy "site_pages_update_management"
on public.site_pages
for update
using (public.is_management_user())
with check (public.is_management_user());

drop policy if exists "banners_select_public_active" on public.banners;
create policy "banners_select_public_active"
on public.banners
for select
using (
  status = 'active'
  and visibility = 'public'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "banners_select_authenticated_active" on public.banners;
create policy "banners_select_authenticated_active"
on public.banners
for select
to authenticated
using (
  status = 'active'
  and visibility in ('public', 'logged_in')
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "banners_select_management" on public.banners;
create policy "banners_select_management"
on public.banners
for select
using (public.is_management_user());

drop policy if exists "banners_insert_management" on public.banners;
create policy "banners_insert_management"
on public.banners
for insert
with check (public.is_management_user());

drop policy if exists "banners_update_management" on public.banners;
create policy "banners_update_management"
on public.banners
for update
using (public.is_management_user())
with check (public.is_management_user());

drop policy if exists "coupons_select_active" on public.coupons;
create policy "coupons_select_active"
on public.coupons
for select
using (
  status = 'active'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "coupons_select_management" on public.coupons;
create policy "coupons_select_management"
on public.coupons
for select
using (public.is_management_user());

drop policy if exists "coupons_insert_management" on public.coupons;
create policy "coupons_insert_management"
on public.coupons
for insert
with check (public.is_management_user());

drop policy if exists "coupons_update_management" on public.coupons;
create policy "coupons_update_management"
on public.coupons
for update
using (public.is_management_user())
with check (public.is_management_user());

drop policy if exists "coupon_redemptions_select_own" on public.coupon_redemptions;
create policy "coupon_redemptions_select_own"
on public.coupon_redemptions
for select
using (auth.uid() = user_id);

drop policy if exists "coupon_redemptions_select_management" on public.coupon_redemptions;
create policy "coupon_redemptions_select_management"
on public.coupon_redemptions
for select
using (public.is_management_user());

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
on public.payments
for select
using (auth.uid() = user_id);

drop policy if exists "payments_select_management" on public.payments;
create policy "payments_select_management"
on public.payments
for select
using (public.is_management_user());

drop policy if exists "fund_allocation_rules_select_management" on public.fund_allocation_rules;
create policy "fund_allocation_rules_select_management"
on public.fund_allocation_rules
for select
using (public.is_management_user());

drop policy if exists "payment_allocations_select_management" on public.payment_allocations;
create policy "payment_allocations_select_management"
on public.payment_allocations
for select
using (public.is_management_user());

drop policy if exists "admin_cash_outs_select_management" on public.admin_cash_outs;
create policy "admin_cash_outs_select_management"
on public.admin_cash_outs
for select
using (public.is_management_user());

drop policy if exists "admin_cash_out_breakdowns_select_management" on public.admin_cash_out_breakdowns;
create policy "admin_cash_out_breakdowns_select_management"
on public.admin_cash_out_breakdowns
for select
using (public.is_management_user());

grant select on public.fund_allocation_rules to authenticated;
grant select on public.payment_allocations to authenticated;
grant select on public.admin_cash_outs to authenticated;
grant select on public.admin_cash_out_breakdowns to authenticated;
grant select on public.customers to authenticated;
grant select on public.admin_settings to authenticated;
grant select, insert, update on public.admin_notifications to authenticated;
grant select on public.campaigns to authenticated;
grant select on public.order_items to authenticated;
grant select on public.reviews to anon;
grant select on public.reviews to authenticated;
grant select on public.blog_posts to anon;
grant select on public.blog_posts to authenticated;
grant select on public.site_pages to anon;
grant select on public.site_pages to authenticated;
grant select on public.banners to anon;
grant select on public.banners to authenticated;
grant select on public.coupons to anon;
grant select on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;
grant select on public.products to anon;
grant select on public.products to authenticated;
grant select on public.collections to anon;
grant select on public.collections to authenticated;
grant execute on function public.record_admin_cash_out_transfer(numeric, text, uuid, uuid, bigint, text, text, text, numeric, numeric, text, timestamptz, text, text, text) to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Service-role operations from the Next.js backend bypass RLS, which keeps
-- client reads restricted while still allowing secure server-side writes.

insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "product_media_public_read" on storage.objects;
create policy "product_media_public_read"
on storage.objects
for select
using (bucket_id = 'product-media');
