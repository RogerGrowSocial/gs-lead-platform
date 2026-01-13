# Supabase Migration Plan

## 🔥 Current Issues Identified

1. **Inconsistent Table Usage**: Platform uses both `users` and `profiles` tables
2. **Broken Foreign Key Relationships**: `profiles.id → auth.users.id` integrity compromised
3. **RLS Policy Issues**: Inconsistent row-level security causing authentication failures
4. **Mollie Integration Problems**: `mollie_customer_id` null values breaking payment flow

## 🎯 Migration Objectives

- Migrate to new Supabase project with clean schema
- Maintain all existing platform functionality
- Ensure proper auth/profile relationship
- Fix Mollie payment integration
- Keep all frontend/backend logic unchanged

## 📋 Migration Checklist

### A. New Supabase Project Setup

1. **Create New Supabase Project**
   - Create new project in Supabase dashboard
   - Note down new project URL and keys

2. **Database Schema Setup**
   ```sql
   -- Create profiles table with proper structure
   CREATE TABLE profiles (
     id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     role_id TEXT NOT NULL DEFAULT 'customer',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
     company_name TEXT,
     first_name TEXT,
     last_name TEXT,
     phone TEXT,
     postal_code TEXT,
     city TEXT,
     country TEXT,
     vat_number TEXT,
     coc_number TEXT,
     mollie_customer_id TEXT,
     balance DECIMAL(10,2) DEFAULT 0.00,
     is_admin BOOLEAN DEFAULT FALSE,
     last_login TIMESTAMP WITH TIME ZONE
   );

   -- Enable RLS
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

   -- Create RLS policies
   CREATE POLICY "Users can view own profile"
     ON profiles FOR SELECT
     USING (auth.uid() = id);

   CREATE POLICY "Users can update own profile"
     ON profiles FOR UPDATE
     USING (auth.uid() = id);

   CREATE POLICY "Service role can insert profiles"
     ON profiles FOR INSERT
     WITH CHECK (true);

   -- Create indexes
   CREATE INDEX idx_profiles_email ON profiles(email);
   CREATE INDEX idx_profiles_mollie_customer_id ON profiles(mollie_customer_id);
   ```

3. **Edge Function Setup**
   - Deploy `create-profile` edge function
   - Configure auth webhook for `user.created` event

### B. Environment Configuration

1. **Update Environment Variables**
   - Replace old Supabase URLs and keys
   - Update all `.env` files and deployment configs

2. **Update Supabase Client Configurations**
   - Update `config/supabase.js`
   - Update `lib/supabase.ts`
   - Ensure consistent client usage

### C. Code Updates

1. **Auth Flow Updates**
   - Update auth routes to use `profiles` table consistently
   - Ensure proper session management
   - Fix user registration flow

2. **Profile Management**
   - Update all profile queries to use new table structure
   - Ensure proper foreign key relationships
   - Fix RLS policy compliance

3. **Mollie Integration**
   - Ensure `mollie_customer_id` is properly handled
   - Auto-create Mollie customers when needed
   - Fix payment method vaulting

### D. Testing & Validation

1. **Auth Testing**
   - User registration
   - User login/logout
   - Password reset
   - Session management

2. **Profile Testing**
   - Profile creation on signup
   - Profile updates
   - RLS policy enforcement

3. **Payment Testing**
   - Mollie customer creation
   - Credit card vaulting
   - Payment processing

4. **Integration Testing**
   - Dashboard access
   - Admin functionality
   - API endpoints

## 🚀 Implementation Steps

### Step 1: Create New Supabase Project
1. Create new project in Supabase dashboard
2. Set up database schema
3. Configure RLS policies
4. Deploy edge functions

### Step 2: Update Environment Configuration
1. Update all environment variables
2. Update Supabase client configurations
3. Test connection to new project

### Step 3: Update Code Base
1. Fix auth routes to use profiles table
2. Update profile queries
3. Fix Mollie integration
4. Update admin functionality

### Step 4: Testing & Deployment
1. Comprehensive testing
2. Fix any issues found
3. Deploy to production
4. Monitor for issues

## 🔧 Rollback Plan

If issues arise during migration:
1. Keep old Supabase project running
2. Revert environment variables
3. Rollback code changes
4. Investigate and fix issues
5. Retry migration

## 📊 Success Criteria

- [ ] Users can register and login successfully
- [ ] Profiles are created automatically on signup
- [ ] Mollie payments work correctly
- [ ] Admin dashboard functions properly
- [ ] All existing functionality remains intact
- [ ] No RLS policy violations
- [ ] No broken foreign key relationships 