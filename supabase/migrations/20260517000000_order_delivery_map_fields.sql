alter table public.orders add column if not exists delivery_latitude numeric null;
alter table public.orders add column if not exists delivery_longitude numeric null;
alter table public.orders add column if not exists delivery_place_id text null;
alter table public.orders add column if not exists delivery_map_provider text null;
alter table public.orders add column if not exists delivery_address_components jsonb not null default '{}'::jsonb;

alter table public.orders drop constraint if exists orders_delivery_latitude_check;
alter table public.orders
add constraint orders_delivery_latitude_check check (delivery_latitude is null or (delivery_latitude >= -90 and delivery_latitude <= 90));

alter table public.orders drop constraint if exists orders_delivery_longitude_check;
alter table public.orders
add constraint orders_delivery_longitude_check check (delivery_longitude is null or (delivery_longitude >= -180 and delivery_longitude <= 180));
