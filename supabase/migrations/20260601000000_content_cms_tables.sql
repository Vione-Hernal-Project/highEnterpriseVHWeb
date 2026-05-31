create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

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

create table if not exists public.banner_events (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banners(id) on delete cascade,
  event_type text not null,
  location text not null default '',
  path text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  constraint banner_events_type_check check (event_type in ('impression', 'click'))
);

create index if not exists blog_posts_slug_idx on public.blog_posts (slug);
create index if not exists blog_posts_status_publish_idx on public.blog_posts (status, visibility, publish_at desc, created_at desc);
create index if not exists blog_posts_categories_idx on public.blog_posts using gin (categories);
create index if not exists blog_posts_tags_idx on public.blog_posts using gin (tags);
create index if not exists site_pages_slug_idx on public.site_pages (slug);
create index if not exists site_pages_status_order_idx on public.site_pages (status, visibility, display_order, created_at desc);
create index if not exists site_pages_parent_idx on public.site_pages (parent_page_id);
create index if not exists banners_status_order_idx on public.banners (status, visibility, priority, display_order, created_at desc);
create index if not exists banners_display_on_idx on public.banners (display_on, device, priority, display_order);
create index if not exists banner_events_banner_type_idx on public.banner_events (banner_id, event_type, created_at desc);

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

alter table public.blog_posts enable row level security;
alter table public.site_pages enable row level security;
alter table public.banners enable row level security;
alter table public.banner_events enable row level security;

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
using (public.has_admin_access('content'));

drop policy if exists "blog_posts_insert_management" on public.blog_posts;
create policy "blog_posts_insert_management"
on public.blog_posts
for insert
with check (public.has_admin_access('content'));

drop policy if exists "blog_posts_update_management" on public.blog_posts;
create policy "blog_posts_update_management"
on public.blog_posts
for update
using (public.has_admin_access('content'))
with check (public.has_admin_access('content'));

drop policy if exists "blog_posts_delete_management" on public.blog_posts;
create policy "blog_posts_delete_management"
on public.blog_posts
for delete
using (public.has_admin_access('content'));

drop policy if exists "site_pages_select_published" on public.site_pages;
create policy "site_pages_select_published"
on public.site_pages
for select
using (status = 'published' and visibility = 'public');

drop policy if exists "site_pages_select_management" on public.site_pages;
create policy "site_pages_select_management"
on public.site_pages
for select
using (public.has_admin_access('content'));

drop policy if exists "site_pages_insert_management" on public.site_pages;
create policy "site_pages_insert_management"
on public.site_pages
for insert
with check (public.has_admin_access('content'));

drop policy if exists "site_pages_update_management" on public.site_pages;
create policy "site_pages_update_management"
on public.site_pages
for update
using (public.has_admin_access('content'))
with check (public.has_admin_access('content'));

drop policy if exists "site_pages_delete_management" on public.site_pages;
create policy "site_pages_delete_management"
on public.site_pages
for delete
using (public.has_admin_access('content'));

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
using (public.has_admin_access('content'));

drop policy if exists "banners_insert_management" on public.banners;
create policy "banners_insert_management"
on public.banners
for insert
with check (public.has_admin_access('content'));

drop policy if exists "banners_update_management" on public.banners;
create policy "banners_update_management"
on public.banners
for update
using (public.has_admin_access('content'))
with check (public.has_admin_access('content'));

drop policy if exists "banners_delete_management" on public.banners;
create policy "banners_delete_management"
on public.banners
for delete
using (public.has_admin_access('content'));

drop policy if exists "banner_events_select_management" on public.banner_events;
create policy "banner_events_select_management"
on public.banner_events
for select
using (public.has_admin_access('content') or public.has_admin_access('reports'));

drop policy if exists "campaigns_delete_management" on public.campaigns;
create policy "campaigns_delete_management"
on public.campaigns
for delete
using (public.has_admin_access('marketing'));

grant select on public.blog_posts to anon;
grant select on public.blog_posts to authenticated;
grant select on public.site_pages to anon;
grant select on public.site_pages to authenticated;
grant select on public.banners to anon;
grant select on public.banners to authenticated;
