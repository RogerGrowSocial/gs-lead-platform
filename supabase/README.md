# Supabase Edge Functions

This directory contains Supabase Edge Functions for the GS Lead Platform.

## Profile Creation Function

The `create-profile` function automatically creates a profile record when a new user signs up via Supabase Auth.

### Setup Instructions

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Set up environment variables:
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy your project URL and service_role key
   - Set these as secrets for your function:
     ```bash
     supabase secrets set SUPABASE_URL=your-project-url
     supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     ```

5. Deploy the function:
   ```bash
   supabase functions deploy create-profile
   ```

6. Set up the Auth webhook:
   - Go to your Supabase dashboard
   - Navigate to Authentication > Webhooks
   - Add a new webhook for the `user.created` event
   - Set the URL to your deployed function URL (e.g., `https://your-project.functions.supabase.co/create-profile`)
   - Set the method to POST
   - Save the webhook

### Database Setup

Ensure your `profiles` table has the following structure:

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  role_id text not null default 'customer',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  company_name text,
  postal_code text,
  city text,
  country text,
  vat_number text,
  coc_number text,
  mollie_customer_id text
);

-- Enable Row Level Security
alter table profiles enable row level security;

-- Create policies
create policy "Users can view own profile"
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

create policy "Service role can insert profiles"
  on profiles for insert
  with check ( true );
```

### Testing

To test the function locally:

1. Start the function locally:
   ```bash
   supabase functions serve create-profile --env-file ./supabase/.env
   ```

2. Send a test request:
   ```bash
   curl -i --location --request POST 'http://localhost:54321/functions/v1/create-profile' \
   --header 'Authorization: Bearer YOUR_ANON_KEY' \
   --header 'Content-Type: application/json' \
   --data '{
     "type": "user.created",
     "record": {
       "id": "test-user-id",
       "email": "test@example.com"
     }
   }'
   ```

### Error Handling

The function handles various error cases:
- Missing required fields
- Invalid event types
- Database errors
- Environment configuration errors

All errors are logged and returned with appropriate HTTP status codes and error messages.

### Security

- The function uses the service role key to create profiles
- JWT verification is enabled
- Row Level Security is enforced on the profiles table
- Environment variables are stored as secrets 