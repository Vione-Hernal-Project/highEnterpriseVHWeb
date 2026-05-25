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

create unique index if not exists admin_notifications_dedupe_channel_idx
on public.admin_notifications (dedupe_key, channel);

create index if not exists admin_notifications_created_at_idx
on public.admin_notifications (created_at desc);

create index if not exists admin_notifications_read_at_idx
on public.admin_notifications (read_at);

drop trigger if exists admin_notifications_set_updated_at on public.admin_notifications;
create trigger admin_notifications_set_updated_at
before update on public.admin_notifications
for each row execute function public.set_updated_at();

alter table public.admin_notifications enable row level security;

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

grant select, insert, update on public.admin_notifications to authenticated;
