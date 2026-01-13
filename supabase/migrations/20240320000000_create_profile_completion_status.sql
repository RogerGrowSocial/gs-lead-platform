-- Drop existing policies if they exist
drop policy if exists "Users can view their own completion status" on profile_completion_status;
drop policy if exists "Users can update their own completion status" on profile_completion_status;
drop policy if exists "Service role can manage all completion statuses" on profile_completion_status;

-- Create profile_completion_status table
create table if not exists profile_completion_status (
  id uuid references auth.users on delete cascade primary key,
  is_complete boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table profile_completion_status enable row level security;

-- Create policies
create policy "Users can view their own completion status"
  on profile_completion_status for select
  using (auth.uid() = id);

create policy "Users can update their own completion status"
  on profile_completion_status for update
  using (auth.uid() = id);

create policy "Service role can manage all completion statuses"
  on profile_completion_status for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- Create trigger to update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_profile_completion_status_updated_at on profile_completion_status;

create trigger update_profile_completion_status_updated_at
  before update on profile_completion_status
  for each row
  execute function update_updated_at_column();

-- Insert initial records for existing profiles
insert into profile_completion_status (id, is_complete)
select 
  p.id,
  case 
    when p.company_name is not null 
    and p.postal_code is not null 
    and p.city is not null 
    and p.country is not null 
    and p.vat_number is not null 
    and p.coc_number is not null 
    then true 
    else false 
  end as is_complete
from profiles p
on conflict (id) do nothing; 