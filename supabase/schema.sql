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
  role text not null default 'user' check (role in ('user', 'admin', 'owner')),
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
add constraint profiles_role_check check (role in ('user', 'admin', 'owner'));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  user_id uuid null references auth.users(id) on delete set null,
  email text null,
  product_id text null,
  product_name text null,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  customer_name text not null default '',
  phone text not null default '',
  shipping_address text not null default '',
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
  constraint orders_confirmation_email_status_check check (
    confirmation_email_status in ('pending', 'sent', 'failed', 'not_configured')
  )
);

alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists user_id uuid null references auth.users(id) on delete set null;
alter table public.orders add column if not exists email text null;
alter table public.orders add column if not exists product_id text null;
alter table public.orders add column if not exists product_name text null;
alter table public.orders add column if not exists quantity integer not null default 1;
alter table public.orders add column if not exists unit_price numeric not null default 0;
alter table public.orders add column if not exists customer_name text not null default '';
alter table public.orders add column if not exists phone text not null default '';
alter table public.orders add column if not exists shipping_address text not null default '';
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

alter table public.orders drop constraint if exists orders_confirmation_email_status_check;
alter table public.orders
add constraint orders_confirmation_email_status_check check (
  confirmation_email_status in ('pending', 'sent', 'failed', 'not_configured')
);

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
  tx_hash text null,
  wallet_address text null,
  recipient_address text null,
  chain_id bigint null,
  amount_expected numeric not null,
  amount_expected_fiat numeric null,
  fiat_currency text null,
  conversion_rate numeric null,
  quote_source text null,
  quote_updated_at timestamptz null,
  amount_received numeric null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_status_check check (status in ('pending', 'paid', 'cancelled', 'failed'))
);

alter table public.payments add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.payments add column if not exists user_id uuid null references auth.users(id) on delete set null;
alter table public.payments add column if not exists payment_method text not null default 'mock';
alter table public.payments add column if not exists tx_hash text null;
alter table public.payments add column if not exists wallet_address text null;
alter table public.payments add column if not exists recipient_address text null;
alter table public.payments add column if not exists chain_id bigint null;
alter table public.payments add column if not exists amount_expected numeric not null default 0;
alter table public.payments add column if not exists amount_expected_fiat numeric null;
alter table public.payments add column if not exists fiat_currency text null;
alter table public.payments add column if not exists conversion_rate numeric null;
alter table public.payments add column if not exists quote_source text null;
alter table public.payments add column if not exists quote_updated_at timestamptz null;
alter table public.payments add column if not exists amount_received numeric null;
alter table public.payments add column if not exists status text not null default 'pending';
alter table public.payments add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.payments add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
add constraint payments_status_check check (status in ('pending', 'paid', 'cancelled', 'failed'));

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

alter table public.payment_allocations
  alter column payment_id set not null,
  alter column allocation_code set not null,
  alter column allocation_name set not null,
  alter column allocation_color set not null,
  alter column percentage_basis_points set not null,
  alter column base_amount set not null,
  alter column currency set not null,
  alter column allocated_amount set not null;

alter table public.payment_allocations drop constraint if exists payment_allocations_percentage_check;
alter table public.payment_allocations
add constraint payment_allocations_percentage_check check (percentage_basis_points >= 0 and percentage_basis_points <= 10000);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_wallet_address_idx on public.profiles (wallet_address);
create index if not exists orders_order_number_idx on public.orders (order_number);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);
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
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
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
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.fund_allocation_rules enable row level security;
alter table public.payment_allocations enable row level security;

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
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

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

grant select on public.fund_allocation_rules to authenticated;
grant select on public.payment_allocations to authenticated;

-- Service-role operations from the Next.js backend bypass RLS, which keeps
-- client reads restricted while still allowing secure server-side writes.
