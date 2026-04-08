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

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_wallet_address_idx on public.profiles (wallet_address);
create index if not exists orders_order_number_idx on public.orders (order_number);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_chain_id_idx on public.payments (chain_id);
create index if not exists orders_product_id_idx on public.orders (product_id);
create unique index if not exists payments_tx_hash_unique_idx on public.payments (tx_hash) where tx_hash is not null;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

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

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
on public.payments
for select
using (auth.uid() = user_id);

-- Service-role operations from the Next.js backend bypass RLS, which keeps
-- client reads restricted while still allowing secure server-side writes.
