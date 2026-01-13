-- Migration: Add ensure_profile RPC function
-- This function safely creates or updates a profile for a user
-- It runs with SECURITY DEFINER to bypass RLS for profile creation

create or replace function public.ensure_profile(uid uuid, p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare 
  rec public.profiles;
  admin_role_id uuid;
begin
  -- Get the admin role ID (fallback to customer if not found)
  select id into admin_role_id from public.roles where name = 'admin' limit 1;
  if admin_role_id is null then
    select id into admin_role_id from public.roles where name = 'customer' limit 1;
  end if;
  
  -- Insert or update profile
  insert into public.profiles(
    id, 
    email, 
    first_name, 
    last_name, 
    company_name,
    role_id,
    is_admin,
    created_at, 
    updated_at
  )
  values (
    uid, 
    p_email,
    'User',
    'Name', 
    'Company',
    admin_role_id,
    false,
    NOW(), 
    NOW()
  )
  on conflict (id) do update set 
    email = excluded.email,
    updated_at = NOW()
  returning * into rec;
  
  return rec;
end;
$$;

-- Grant execute permission to authenticated users
revoke all on function public.ensure_profile(uuid, text) from public;
grant execute on function public.ensure_profile(uuid, text) to authenticated;

-- Ensure RLS policies exist for profiles table
alter table public.profiles enable row level security;

-- Create policy for users to select their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='select own profile'
  ) then
    create policy "select own profile"
    on public.profiles for select
    using (auth.uid() = id);
  end if;
end $$;
