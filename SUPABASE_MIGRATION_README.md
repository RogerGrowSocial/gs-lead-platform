# Supabase Migration Guide

This guide will help you migrate your GS Lead Platform from the old Supabase project to a new one with a clean schema and proper authentication setup.

## 🔥 Why This Migration is Needed

The original Supabase project has several critical issues:
- Broken foreign key relationships between `profiles.id` and `auth.users.id`
- Inconsistent RLS (Row Level Security) policies
- Corrupted user-profile linkage logic
- Mollie payment integration failures due to null `mollie_customer_id` values
- Authentication inconsistencies

## 🎯 Migration Goals

- ✅ Migrate to new Supabase project with clean schema
- ✅ Maintain all existing platform functionality
- ✅ Ensure proper auth/profile relationship
- ✅ Fix Mollie payment integration
- ✅ Keep all frontend/backend logic unchanged

## 📋 Pre-Migration Checklist

Before starting the migration, ensure you have:

- [ ] Access to Supabase dashboard
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Access to your current environment variables
- [ ] Backup of current user data (if needed)
- [ ] Development environment ready for testing

## 🚀 Migration Steps

### Step 1: Create New Supabase Project

1. **Create New Project**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Choose your organization
   - Enter project name (e.g., "gs-lead-platform-v2")
   - Set database password
   - Choose region
   - Click "Create new project"

2. **Get Project Credentials**
   - Go to Settings > API
   - Copy the following:
     - Project URL
     - `anon` public key
     - `service_role` secret key

### Step 2: Set Up Database Schema

1. **Run Migration SQL**
   - Go to SQL Editor in your new Supabase project
   - Copy and paste the contents of `migrations/new_supabase_setup.sql`
   - Execute the script

2. **Verify Schema**
   - Check that the `profiles` table was created
   - Verify RLS policies are in place
   - Confirm indexes are created

### Step 3: Deploy Edge Function

1. **Link Project**
   ```bash
   supabase login
   supabase link --project-ref your-new-project-ref
   ```

2. **Set Environment Variables**
   ```bash
   supabase secrets set SUPABASE_URL=your-new-project-url
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
   ```

3. **Deploy Function**
   ```bash
   supabase functions deploy create-profile
   ```

4. **Configure Auth Webhook**
   - Go to Authentication > Webhooks
   - Add new webhook
   - Event: `user.created`
   - URL: `https://your-project.functions.supabase.co/create-profile`
   - Method: `POST`

### Step 4: Update Environment Variables

1. **Create New .env File**
   ```env
   # New Supabase Project
   SUPABASE_URL=https://your-new-project.supabase.co
   SUPABASE_ANON_KEY=your-new-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
   
   # Old Project (for migration)
   OLD_SUPABASE_URL=https://old-project.supabase.co
   OLD_SUPABASE_SERVICE_ROLE_KEY=old-service-role-key
   
   # Other existing variables
   MOLLIE_API_KEY=your-mollie-key
   SESSION_SECRET=your-session-secret
   # ... other variables
   ```

### Step 5: Run Migration Scripts

1. **Test New Setup**
   ```bash
   node scripts/migrate-to-new-supabase.js
   ```

2. **Migrate Users (Optional)**
   ```bash
   node scripts/migrate-users.js
   ```

### Step 6: Update Code (Already Done)

The following files have been updated to use the new schema:

- ✅ `routes/auth.js` - Updated to use `profiles` table
- ✅ `routes/admin.js` - Updated profile queries
- ✅ `supabase/functions/create-profile/index.ts` - Updated schema
- ✅ `config/supabase.js` - No changes needed
- ✅ `lib/supabase.ts` - No changes needed

### Step 7: Testing

1. **Test User Registration**
   - Try registering a new user
   - Verify profile is created automatically
   - Check that user can log in

2. **Test User Login**
   - Test with existing users (if migrated)
   - Test with new users
   - Verify session management

3. **Test Mollie Integration**
   - Try adding a payment method
   - Verify Mollie customer creation
   - Test payment processing

4. **Test Admin Functions**
   - Verify admin dashboard access
   - Test user management
   - Check payment management

## 🔧 Troubleshooting

### Common Issues

1. **Profile Not Created on Signup**
   - Check edge function logs
   - Verify webhook is configured correctly
   - Check RLS policies

2. **Authentication Errors**
   - Verify environment variables
   - Check Supabase client configuration
   - Ensure RLS policies are correct

3. **Mollie Integration Fails**
   - Check `mollie_customer_id` field
   - Verify Mollie API key
   - Check payment method creation

### Debug Commands

```bash
# Check Supabase connection
node scripts/migrate-to-new-supabase.js

# View edge function logs
supabase functions logs create-profile

# Test database connection
supabase db reset
```

## 📊 Migration Validation

After migration, verify:

- [ ] New users can register and login
- [ ] Profiles are created automatically
- [ ] Mollie payments work correctly
- [ ] Admin dashboard functions properly
- [ ] All existing functionality remains intact
- [ ] No RLS policy violations
- [ ] No broken foreign key relationships

## 🔄 Rollback Plan

If issues arise:

1. **Keep Old Project Running**
   - Don't delete the old Supabase project immediately
   - Keep it as backup

2. **Revert Environment Variables**
   - Switch back to old project credentials
   - Update `.env` file

3. **Rollback Code Changes**
   - Revert changes to auth routes if needed
   - Switch back to old table structure

4. **Investigate Issues**
   - Check logs for errors
   - Test in development environment
   - Fix issues before retrying

## 📞 Support

If you encounter issues during migration:

1. Check the logs in Supabase dashboard
2. Review edge function logs
3. Test in development environment
4. Check RLS policies and permissions
5. Verify all environment variables are correct

## 🎉 Post-Migration

Once migration is successful:

1. **Monitor for Issues**
   - Watch for authentication errors
   - Monitor payment processing
   - Check user feedback

2. **Clean Up**
   - Remove old project credentials from `.env`
   - Archive old Supabase project
   - Update documentation

3. **Performance Optimization**
   - Monitor database performance
   - Optimize queries if needed
   - Set up monitoring and alerts

---

**Note**: This migration preserves all existing functionality while fixing the underlying authentication and database issues. The platform will continue to work exactly as before, but with improved reliability and consistency. 