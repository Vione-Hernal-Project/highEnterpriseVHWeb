alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
add constraint profiles_role_check check (
  role in (
    'user',
    'super_admin',
    'full_admin',
    'product_manager',
    'orders_manager',
    'customer_support',
    'marketing_content_manager',
    'finance_ledger',
    'staff',
    'admin',
    'owner'
  )
);

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when role in ('owner', 'super_admin') then 'super_admin'
    when role in ('admin', 'full_admin') then 'full_admin'
    when role = 'staff' then 'orders_manager'
    when role in ('product_manager', 'orders_manager', 'customer_support', 'marketing_content_manager', 'finance_ledger') then role
    else null
  end
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.has_admin_access(access_area text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  admin_role text := public.current_admin_role();
begin
  if admin_role = 'super_admin' then
    return true;
  end if;

  if admin_role = 'full_admin' then
    return access_area in (
      'dashboard',
      'orders',
      'orders:write',
      'products',
      'collections',
      'customers',
      'payments',
      'ledger',
      'reports',
      'coupons',
      'marketing',
      'content',
      'reviews',
      'settings'
    );
  end if;

  if admin_role = 'product_manager' then
    return access_area in ('products', 'collections');
  end if;

  if admin_role = 'orders_manager' then
    return access_area in ('orders', 'orders:write');
  end if;

  if admin_role = 'customer_support' then
    return access_area in ('orders', 'customers');
  end if;

  if admin_role = 'marketing_content_manager' then
    return access_area in ('coupons', 'marketing', 'content');
  end if;

  if admin_role = 'finance_ledger' then
    return access_area in ('payments', 'ledger', 'reports');
  end if;

  return false;
end;
$$;

create or replace function public.is_management_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_access('dashboard');
$$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "profiles_select_management" on public.profiles';
    execute $policy$
      create policy "profiles_select_management"
      on public.profiles
      for select
      using (public.has_admin_access('admin-settings'))
    $policy$;
  end if;

  if to_regclass('public.customers') is not null then
    execute 'drop policy if exists "customers_select_management" on public.customers';
    execute $policy$
      create policy "customers_select_management"
      on public.customers
      for select
      using (public.has_admin_access('customers'))
    $policy$;

    execute 'drop policy if exists "customers_insert_management" on public.customers';
    execute $policy$
      create policy "customers_insert_management"
      on public.customers
      for insert
      with check (public.has_admin_access('customers'))
    $policy$;

    execute 'drop policy if exists "customers_update_management" on public.customers';
    execute $policy$
      create policy "customers_update_management"
      on public.customers
      for update
      using (public.has_admin_access('customers'))
      with check (public.has_admin_access('customers'))
    $policy$;
  end if;

  if to_regclass('public.products') is not null then
    execute 'drop policy if exists "products_select_management" on public.products';
    execute $policy$
      create policy "products_select_management"
      on public.products
      for select
      using (public.has_admin_access('products'))
    $policy$;

    execute 'drop policy if exists "products_insert_management" on public.products';
    execute $policy$
      create policy "products_insert_management"
      on public.products
      for insert
      with check (public.has_admin_access('products'))
    $policy$;

    execute 'drop policy if exists "products_update_management" on public.products';
    execute $policy$
      create policy "products_update_management"
      on public.products
      for update
      using (public.has_admin_access('products'))
      with check (public.has_admin_access('products'))
    $policy$;
  end if;

  if to_regclass('public.collections') is not null then
    execute 'drop policy if exists "collections_select_management" on public.collections';
    execute $policy$
      create policy "collections_select_management"
      on public.collections
      for select
      using (public.has_admin_access('collections'))
    $policy$;

    execute 'drop policy if exists "collections_insert_management" on public.collections';
    execute $policy$
      create policy "collections_insert_management"
      on public.collections
      for insert
      with check (public.has_admin_access('collections'))
    $policy$;

    execute 'drop policy if exists "collections_update_management" on public.collections';
    execute $policy$
      create policy "collections_update_management"
      on public.collections
      for update
      using (public.has_admin_access('collections'))
      with check (public.has_admin_access('collections'))
    $policy$;
  end if;

  if to_regclass('public.admin_settings') is not null then
    execute 'drop policy if exists "admin_settings_select_management" on public.admin_settings';
    execute $policy$
      create policy "admin_settings_select_management"
      on public.admin_settings
      for select
      using (public.has_admin_access('settings'))
    $policy$;

    execute 'drop policy if exists "admin_settings_insert_management" on public.admin_settings';
    execute $policy$
      create policy "admin_settings_insert_management"
      on public.admin_settings
      for insert
      with check (public.has_admin_access('settings'))
    $policy$;

    execute 'drop policy if exists "admin_settings_update_management" on public.admin_settings';
    execute $policy$
      create policy "admin_settings_update_management"
      on public.admin_settings
      for update
      using (public.has_admin_access('settings'))
      with check (public.has_admin_access('settings'))
    $policy$;
  end if;

  if to_regclass('public.admin_notifications') is not null then
    execute 'drop policy if exists "admin_notifications_select_management" on public.admin_notifications';
    execute $policy$
      create policy "admin_notifications_select_management"
      on public.admin_notifications
      for select
      using (public.has_admin_access('settings'))
    $policy$;

    execute 'drop policy if exists "admin_notifications_insert_management" on public.admin_notifications';
    execute $policy$
      create policy "admin_notifications_insert_management"
      on public.admin_notifications
      for insert
      with check (public.has_admin_access('settings'))
    $policy$;

    execute 'drop policy if exists "admin_notifications_update_management" on public.admin_notifications';
    execute $policy$
      create policy "admin_notifications_update_management"
      on public.admin_notifications
      for update
      using (public.has_admin_access('settings'))
      with check (public.has_admin_access('settings'))
    $policy$;
  end if;

  if to_regclass('public.campaigns') is not null then
    execute 'drop policy if exists "campaigns_select_management" on public.campaigns';
    execute $policy$
      create policy "campaigns_select_management"
      on public.campaigns
      for select
      using (public.has_admin_access('marketing'))
    $policy$;

    execute 'drop policy if exists "campaigns_insert_management" on public.campaigns';
    execute $policy$
      create policy "campaigns_insert_management"
      on public.campaigns
      for insert
      with check (public.has_admin_access('marketing'))
    $policy$;

    execute 'drop policy if exists "campaigns_update_management" on public.campaigns';
    execute $policy$
      create policy "campaigns_update_management"
      on public.campaigns
      for update
      using (public.has_admin_access('marketing'))
      with check (public.has_admin_access('marketing'))
    $policy$;
  end if;

  if to_regclass('public.orders') is not null then
    execute 'drop policy if exists "orders_select_management" on public.orders';
    execute $policy$
      create policy "orders_select_management"
      on public.orders
      for select
      using (public.has_admin_access('orders'))
    $policy$;
  end if;

  if to_regclass('public.order_items') is not null then
    execute 'drop policy if exists "order_items_select_management" on public.order_items';
    execute $policy$
      create policy "order_items_select_management"
      on public.order_items
      for select
      using (public.has_admin_access('orders'))
    $policy$;
  end if;

  if to_regclass('public.reviews') is not null then
    execute 'drop policy if exists "reviews_select_management" on public.reviews';
    execute $policy$
      create policy "reviews_select_management"
      on public.reviews
      for select
      using (public.has_admin_access('reviews'))
    $policy$;

    execute 'drop policy if exists "reviews_insert_management" on public.reviews';
    execute $policy$
      create policy "reviews_insert_management"
      on public.reviews
      for insert
      with check (public.has_admin_access('reviews'))
    $policy$;

    execute 'drop policy if exists "reviews_update_management" on public.reviews';
    execute $policy$
      create policy "reviews_update_management"
      on public.reviews
      for update
      using (public.has_admin_access('reviews'))
      with check (public.has_admin_access('reviews'))
    $policy$;
  end if;

  if to_regclass('public.blog_posts') is not null then
    execute 'drop policy if exists "blog_posts_select_management" on public.blog_posts';
    execute $policy$
      create policy "blog_posts_select_management"
      on public.blog_posts
      for select
      using (public.has_admin_access('content'))
    $policy$;

    execute 'drop policy if exists "blog_posts_insert_management" on public.blog_posts';
    execute $policy$
      create policy "blog_posts_insert_management"
      on public.blog_posts
      for insert
      with check (public.has_admin_access('content'))
    $policy$;

    execute 'drop policy if exists "blog_posts_update_management" on public.blog_posts';
    execute $policy$
      create policy "blog_posts_update_management"
      on public.blog_posts
      for update
      using (public.has_admin_access('content'))
      with check (public.has_admin_access('content'))
    $policy$;
  end if;

  if to_regclass('public.site_pages') is not null then
    execute 'drop policy if exists "site_pages_select_management" on public.site_pages';
    execute $policy$
      create policy "site_pages_select_management"
      on public.site_pages
      for select
      using (public.has_admin_access('content'))
    $policy$;

    execute 'drop policy if exists "site_pages_insert_management" on public.site_pages';
    execute $policy$
      create policy "site_pages_insert_management"
      on public.site_pages
      for insert
      with check (public.has_admin_access('content'))
    $policy$;

    execute 'drop policy if exists "site_pages_update_management" on public.site_pages';
    execute $policy$
      create policy "site_pages_update_management"
      on public.site_pages
      for update
      using (public.has_admin_access('content'))
      with check (public.has_admin_access('content'))
    $policy$;
  end if;

  if to_regclass('public.banners') is not null then
    execute 'drop policy if exists "banners_select_management" on public.banners';
    execute $policy$
      create policy "banners_select_management"
      on public.banners
      for select
      using (public.has_admin_access('content'))
    $policy$;

    execute 'drop policy if exists "banners_insert_management" on public.banners';
    execute $policy$
      create policy "banners_insert_management"
      on public.banners
      for insert
      with check (public.has_admin_access('content'))
    $policy$;

    execute 'drop policy if exists "banners_update_management" on public.banners';
    execute $policy$
      create policy "banners_update_management"
      on public.banners
      for update
      using (public.has_admin_access('content'))
      with check (public.has_admin_access('content'))
    $policy$;
  end if;

  if to_regclass('public.coupons') is not null then
    execute 'drop policy if exists "coupons_select_management" on public.coupons';
    execute $policy$
      create policy "coupons_select_management"
      on public.coupons
      for select
      using (public.has_admin_access('coupons'))
    $policy$;

    execute 'drop policy if exists "coupons_insert_management" on public.coupons';
    execute $policy$
      create policy "coupons_insert_management"
      on public.coupons
      for insert
      with check (public.has_admin_access('coupons'))
    $policy$;

    execute 'drop policy if exists "coupons_update_management" on public.coupons';
    execute $policy$
      create policy "coupons_update_management"
      on public.coupons
      for update
      using (public.has_admin_access('coupons'))
      with check (public.has_admin_access('coupons'))
    $policy$;
  end if;

  if to_regclass('public.coupon_redemptions') is not null then
    execute 'drop policy if exists "coupon_redemptions_select_management" on public.coupon_redemptions';
    execute $policy$
      create policy "coupon_redemptions_select_management"
      on public.coupon_redemptions
      for select
      using (public.has_admin_access('coupons'))
    $policy$;
  end if;

  if to_regclass('public.payments') is not null then
    execute 'drop policy if exists "payments_select_management" on public.payments';
    execute $policy$
      create policy "payments_select_management"
      on public.payments
      for select
      using (public.has_admin_access('payments'))
    $policy$;
  end if;

  if to_regclass('public.fund_allocation_rules') is not null then
    execute 'drop policy if exists "fund_allocation_rules_select_management" on public.fund_allocation_rules';
    execute $policy$
      create policy "fund_allocation_rules_select_management"
      on public.fund_allocation_rules
      for select
      using (public.has_admin_access('ledger'))
    $policy$;
  end if;

  if to_regclass('public.payment_allocations') is not null then
    execute 'drop policy if exists "payment_allocations_select_management" on public.payment_allocations';
    execute $policy$
      create policy "payment_allocations_select_management"
      on public.payment_allocations
      for select
      using (public.has_admin_access('ledger'))
    $policy$;
  end if;

  if to_regclass('public.admin_cash_outs') is not null then
    execute 'drop policy if exists "admin_cash_outs_select_management" on public.admin_cash_outs';
    execute $policy$
      create policy "admin_cash_outs_select_management"
      on public.admin_cash_outs
      for select
      using (public.has_admin_access('ledger'))
    $policy$;
  end if;

  if to_regclass('public.admin_cash_out_breakdowns') is not null then
    execute 'drop policy if exists "admin_cash_out_breakdowns_select_management" on public.admin_cash_out_breakdowns';
    execute $policy$
      create policy "admin_cash_out_breakdowns_select_management"
      on public.admin_cash_out_breakdowns
      for select
      using (public.has_admin_access('ledger'))
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null
    and exists (
      select 1
      from pg_publication
      where pubname = 'supabase_realtime'
    )
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    )
  then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.has_admin_access(text) to authenticated;
