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
  updated_at timestamptz not null default timezone('utc', now())
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

update public.coupons
set
  code = upper(substr(md5(id::text), 1, 10)),
  name = coalesce(name, ''),
  description = coalesce(description, ''),
  coupon_type = coalesce(coupon_type, 'percentage'),
  discount_value = coalesce(discount_value, 0),
  minimum_purchase_amount = coalesce(minimum_purchase_amount, 0),
  status = coalesce(status, 'active'),
  applicable_collection_slugs = coalesce(applicable_collection_slugs, '[]'::jsonb),
  applicable_product_ids = coalesce(applicable_product_ids, '[]'::jsonb),
  stackable = coalesce(stackable, false),
  apply_to_sale_items = coalesce(apply_to_sale_items, true),
  free_shipping = coalesce(free_shipping, false),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where code is null
  or trim(code) = ''
  or name is null
  or description is null
  or coupon_type is null
  or discount_value is null
  or minimum_purchase_amount is null
  or status is null
  or applicable_collection_slugs is null
  or applicable_product_ids is null
  or stackable is null
  or apply_to_sale_items is null
  or free_shipping is null
  or created_at is null
  or updated_at is null;

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
alter table public.coupons add constraint coupons_code_trimmed_check check (char_length(trim(code)) > 0);

alter table public.coupons drop constraint if exists coupons_type_check;
alter table public.coupons add constraint coupons_type_check check (coupon_type in ('percentage', 'fixed_amount', 'free_shipping'));

alter table public.coupons drop constraint if exists coupons_status_check;
alter table public.coupons add constraint coupons_status_check check (status in ('active', 'disabled'));

alter table public.coupons drop constraint if exists coupons_discount_value_check;
alter table public.coupons add constraint coupons_discount_value_check check (discount_value >= 0);

alter table public.coupons drop constraint if exists coupons_percentage_value_check;
alter table public.coupons add constraint coupons_percentage_value_check check (coupon_type <> 'percentage' or discount_value <= 100);

alter table public.coupons drop constraint if exists coupons_minimum_purchase_check;
alter table public.coupons add constraint coupons_minimum_purchase_check check (minimum_purchase_amount >= 0);

alter table public.coupons drop constraint if exists coupons_usage_limit_check;
alter table public.coupons add constraint coupons_usage_limit_check check (usage_limit is null or usage_limit > 0);

alter table public.coupons drop constraint if exists coupons_usage_limit_per_customer_check;
alter table public.coupons add constraint coupons_usage_limit_per_customer_check check (usage_limit_per_customer is null or usage_limit_per_customer > 0);

alter table public.coupons drop constraint if exists coupons_assigned_customer_email_check;
alter table public.coupons add constraint coupons_assigned_customer_email_check check (
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

alter table public.orders add column if not exists coupon_id uuid null references public.coupons(id) on delete set null;
alter table public.orders add column if not exists coupon_code text null;
alter table public.orders add column if not exists discount_amount numeric not null default 0;
alter table public.orders add column if not exists discount_breakdown jsonb not null default '{}'::jsonb;

update public.orders
set
  discount_amount = coalesce(discount_amount, 0),
  discount_breakdown = coalesce(discount_breakdown, '{}'::jsonb)
where discount_amount is null
  or discount_breakdown is null;

alter table public.orders
  alter column discount_amount set not null,
  alter column discount_breakdown set not null;

alter table public.orders drop constraint if exists orders_discount_amount_check;
alter table public.orders add constraint orders_discount_amount_check check (discount_amount >= 0);

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
  updated_at timestamptz not null default timezone('utc', now())
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

update public.coupon_redemptions
set
  coupon_code = coalesce(nullif(trim(coupon_code), ''), 'UNKNOWN'),
  discount_amount = coalesce(discount_amount, 0),
  product_discount_amount = coalesce(product_discount_amount, 0),
  shipping_discount_amount = coalesce(shipping_discount_amount, 0),
  order_subtotal_amount = coalesce(order_subtotal_amount, 0),
  order_total_before_discount = coalesce(order_total_before_discount, 0),
  order_total_after_discount = coalesce(order_total_after_discount, 0),
  status = coalesce(status, 'applied'),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where coupon_code is null
  or trim(coupon_code) = ''
  or discount_amount is null
  or product_discount_amount is null
  or shipping_discount_amount is null
  or order_subtotal_amount is null
  or order_total_before_discount is null
  or order_total_after_discount is null
  or status is null
  or metadata is null
  or created_at is null
  or updated_at is null;

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
alter table public.coupon_redemptions add constraint coupon_redemptions_discount_check check (discount_amount >= 0);

alter table public.coupon_redemptions drop constraint if exists coupon_redemptions_product_discount_check;
alter table public.coupon_redemptions add constraint coupon_redemptions_product_discount_check check (product_discount_amount >= 0);

alter table public.coupon_redemptions drop constraint if exists coupon_redemptions_shipping_discount_check;
alter table public.coupon_redemptions add constraint coupon_redemptions_shipping_discount_check check (shipping_discount_amount >= 0);

alter table public.coupon_redemptions drop constraint if exists coupon_redemptions_status_check;
alter table public.coupon_redemptions add constraint coupon_redemptions_status_check check (status in ('applied', 'cancelled', 'refunded'));

create unique index if not exists coupon_redemptions_applied_order_coupon_key
on public.coupon_redemptions (order_id, coupon_id)
where status = 'applied' and order_id is not null;

create index if not exists coupons_code_idx on public.coupons (code);
create index if not exists coupons_status_validity_idx on public.coupons (status, starts_at, ends_at, created_at desc);
create index if not exists coupons_assigned_user_idx on public.coupons (assigned_user_id);
create index if not exists coupons_assigned_customer_email_idx on public.coupons (assigned_customer_email);
create index if not exists orders_coupon_id_idx on public.orders (coupon_id);
create index if not exists orders_coupon_code_idx on public.orders (coupon_code);
create index if not exists coupon_redemptions_coupon_created_idx on public.coupon_redemptions (coupon_id, created_at desc);
create index if not exists coupon_redemptions_order_id_idx on public.coupon_redemptions (order_id);
create index if not exists coupon_redemptions_user_coupon_idx on public.coupon_redemptions (user_id, coupon_id);
create index if not exists coupon_redemptions_email_coupon_idx on public.coupon_redemptions (customer_email, coupon_id);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

drop trigger if exists coupon_redemptions_set_updated_at on public.coupon_redemptions;
create trigger coupon_redemptions_set_updated_at
before update on public.coupon_redemptions
for each row execute function public.set_updated_at();

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

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

grant select on public.coupons to anon;
grant select on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;
