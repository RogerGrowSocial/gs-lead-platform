# Authentication Flow Documentation

## Overview

This document describes the authentication flow for the gs-lead-platform application, which uses Supabase Auth with automatic profile creation via database triggers.

## Current Implementation

### Profile Creation Flow

**IMPORTANT**: The Auth Hook has been disabled in the Supabase Dashboard (Auth → Hooks) to eliminate the 500 "Hook requires authorization token" error.

**Legacy Code**: The following files contain old implementations that are no longer used:
- `supabase/functions/create-profile/index.ts` - Old Edge Function hook
- `middleware/authSync.js` - Old webhook handler

These files can be safely ignored or removed as they are replaced by the database trigger.

Instead of relying on Auth Hooks, profile creation is now handled automatically by a database trigger:

1. User signs up via `supabase.auth.signUp()`
2. Supabase creates the user in `auth.users` table
3. Database trigger `on_auth_user_created` automatically creates a corresponding record in `public.profiles`
4. Client receives success response and can proceed to login

### Database Trigger

The trigger is implemented in the migration file:
- **File**: `supabase/migrations/20250909215240_profiles_trigger.sql`
- **Function**: `public.create_profile_for_new_user()`
- **Trigger**: `on_auth_user_created` on `auth.users` table

### Row Level Security (RLS)

The `public.profiles` table has RLS enabled with the following policies:
- **Select**: Users can only view their own profile (`auth.uid() = id`)
- **Update**: Users can only update their own profile (`auth.uid() = id`)
- **Insert**: Users can only insert their own profile (`auth.uid() = id`)

## Client-Side Changes

### Signup Flow
- Removed polling logic that waited for webhook to create profile
- Removed client-side profile inserts after `signUp()`
- Now shows success message and redirects to login after successful signup

### OAuth Flow
- Removed polling logic for OAuth callback
- Directly fetches user data from `profiles` table (created by trigger)

## Migration Instructions

### Option 1: Supabase CLI (Recommended)
```bash
cd gs-lead-platform
supabase db push
```

### Option 2: Supabase SQL Editor (Quick Fix)
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/20250909215240_profiles_trigger.sql`
3. Execute the SQL

## Alternative: Edge Function Hook (If Needed)

If you ever need to use an Edge Function as a hook instead of database triggers:

### Configuration
1. In `supabase/config.toml`, set `verify_jwt = false` for the function
2. Secure the function with `x-auth-secret` header
3. Use `SUPABASE_SERVICE_ROLE_KEY` server-side for authentication

### Example Function Setup
```toml
[functions.create-profile]
verify_jwt = false
```

### Security Considerations
- Always validate the `x-auth-secret` header
- Use service role key for database operations
- Implement proper error handling and logging

## Troubleshooting

### Common Issues

1. **Profile not created after signup**
   - Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
   - Verify function exists: `SELECT * FROM pg_proc WHERE proname = 'create_profile_for_new_user';`

2. **RLS blocking operations**
   - Ensure user is authenticated: `SELECT auth.uid();`
   - Check policies: `SELECT * FROM pg_policies WHERE tablename = 'profiles';`

3. **Migration not applied**
   - Run migration manually in SQL Editor
   - Check Supabase logs for errors

### Verification Queries

```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check if function exists
SELECT * FROM pg_proc WHERE proname = 'create_profile_for_new_user';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Test trigger manually (for debugging)
SELECT public.create_profile_for_new_user();
```

## Testing

Use the provided test script to verify the signup flow:
```bash
npm run test:signup
```

This will:
1. Create a test user via `supabase.auth.signUp()`
2. Verify the profile was created automatically
3. Clean up the test user
