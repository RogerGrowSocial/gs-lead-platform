-- Migration: Create profiles table and trigger for automatic profile creation
-- This eliminates the need for Auth Hooks by using database triggers instead

-- Create profiles table if it doesn't exist
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role_id uuid,
  created_at timestamptz default now()
);

-- Add columns if missing (idempotent)
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role_id uuid;
alter table public.profiles add column if not exists created_at timestamptz default now();

-- Add other columns that might be needed based on existing schema
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.profiles add column if not exists last_login timestamptz;
alter table public.profiles add column if not exists balance numeric default 0;
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists status text default 'active';

-- Create function to automatically create profile for new users
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger for automatic profile creation
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.create_profile_for_new_user();

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Create RLS policies (idempotent)
do $$
begin
  -- Select policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'select own profile'
  ) then
    create policy "select own profile"
    on public.profiles for select
    using (auth.uid() = id);
  end if;

  -- Update policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'update own profile'
  ) then
    create policy "update own profile"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);
  end if;

  -- Insert policy (for admin operations)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'insert own profile'
  ) then
    create policy "insert own profile"
    on public.profiles for insert
    with check (auth.uid() = id);
  end if;
end $$;
