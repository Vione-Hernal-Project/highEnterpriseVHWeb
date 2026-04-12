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

create table if not exists public.admin_cash_outs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  payment_method text not null,
  chain_id bigint not null default 11155111,
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
alter table public.admin_cash_outs add column if not exists chain_id bigint not null default 11155111;
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
grant execute on function public.record_admin_cash_out_transfer(numeric, text, uuid, uuid, bigint, text, text, text, numeric, numeric, text, timestamptz, text, text, text) to authenticated;

-- Service-role operations from the Next.js backend bypass RLS, which keeps
-- client reads restricted while still allowing secure server-side writes.
