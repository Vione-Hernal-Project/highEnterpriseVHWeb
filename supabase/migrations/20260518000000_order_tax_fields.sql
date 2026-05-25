alter table public.orders add column if not exists tax_amount numeric null;
alter table public.orders add column if not exists tax_rate_label text null;
alter table public.orders add column if not exists tax_rate_percent numeric null;
alter table public.orders add column if not exists tax_breakdown jsonb not null default '{}'::jsonb;

alter table public.orders drop constraint if exists orders_tax_amount_check;
alter table public.orders
add constraint orders_tax_amount_check check (tax_amount is null or tax_amount >= 0);
