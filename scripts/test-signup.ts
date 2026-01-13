#!/usr/bin/env tsx

/**
 * Test script to verify the signup flow works correctly
 * This script tests that profiles are created automatically via database trigger
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSignupFlow() {
  console.log('🧪 Testing signup flow with automatic profile creation...\n');

  // Generate unique test email
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  try {
    console.log(`📧 Creating test user: ${testEmail}`);

    // Step 1: Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          email_confirmed: true // Skip email confirmation for testing
        }
      }
    });

    if (authError) {
      console.error('❌ Signup failed:', authError.message);
      return false;
    }

    if (!authData.user) {
      console.error('❌ No user data returned from signup');
      return false;
    }

    console.log('✅ User created in auth.users:', authData.user.id);

    // Step 2: Wait a moment for trigger to execute
    console.log('⏳ Waiting for trigger to create profile...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Check if profile was created automatically
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile not found:', profileError.message);
      return false;
    }

    if (!profile) {
      console.error('❌ Profile was not created automatically');
      return false;
    }

    console.log('✅ Profile created automatically:', {
      id: profile.id,
      email: profile.email,
      created_at: profile.created_at
    });

    // Step 4: Test RLS by signing in as the user
    console.log('🔐 Testing user authentication...');
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return false;
    }

    console.log('✅ User can sign in successfully');

    // Step 5: Test RLS - user should only see their own profile
    const { data: userProfiles, error: userProfilesError } = await supabase
      .from('profiles')
      .select('*');

    if (userProfilesError) {
      console.error('❌ RLS test failed:', userProfilesError.message);
      return false;
    }

    // User should only see their own profile due to RLS
    if (userProfiles.length === 1 && userProfiles[0].id === authData.user.id) {
      console.log('✅ RLS working correctly - user only sees their own profile');
    } else {
      console.error('❌ RLS not working correctly - user sees', userProfiles.length, 'profiles');
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  } finally {
    // Cleanup: Delete the test user
    try {
      console.log('🧹 Cleaning up test user...');
      
      // Delete from profiles first (due to foreign key constraint)
      await supabase
        .from('profiles')
        .delete()
        .eq('email', testEmail);

      // Delete from auth.users
      await supabase.auth.admin.deleteUser(authData?.user?.id || '');
      
      console.log('✅ Test user cleaned up');
    } catch (cleanupError) {
      console.error('⚠️  Cleanup failed:', cleanupError);
    }
  }
}

async function checkDatabaseSetup() {
  console.log('🔍 Checking database setup...\n');

  try {
    // Check if trigger exists
    const { data: triggers, error: triggerError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT tgname, tgrelid::regclass as table_name 
          FROM pg_trigger 
          WHERE tgname = 'on_auth_user_created'
        `
      });

    if (triggerError) {
      console.log('⚠️  Could not check triggers (this is normal if exec_sql function is not available)');
    } else if (triggers && triggers.length > 0) {
      console.log('✅ Trigger exists:', triggers[0].tgname, 'on table:', triggers[0].table_name);
    } else {
      console.log('❌ Trigger not found - migration may not have been applied');
    }

    // Check if function exists
    const { data: functions, error: functionError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT proname 
          FROM pg_proc 
          WHERE proname = 'create_profile_for_new_user'
        `
      });

    if (functionError) {
      console.log('⚠️  Could not check functions (this is normal if exec_sql function is not available)');
    } else if (functions && functions.length > 0) {
      console.log('✅ Function exists:', functions[0].proname);
    } else {
      console.log('❌ Function not found - migration may not have been applied');
    }

    // Check RLS policies
    const { data: policies, error: policyError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT policyname, cmd 
          FROM pg_policies 
          WHERE tablename = 'profiles'
        `
      });

    if (policyError) {
      console.log('⚠️  Could not check policies (this is normal if exec_sql function is not available)');
    } else if (policies && policies.length > 0) {
      console.log('✅ RLS policies found:', policies.map(p => `${p.policyname} (${p.cmd})`).join(', '));
    } else {
      console.log('❌ No RLS policies found - migration may not have been applied');
    }

  } catch (error) {
    console.log('⚠️  Database setup check failed (this is normal if exec_sql function is not available)');
  }
}

async function main() {
  console.log('🚀 Starting signup flow test...\n');

  await checkDatabaseSetup();
  console.log('');

  const success = await testSignupFlow();

  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 All tests passed! Signup flow is working correctly.');
    console.log('✅ Profiles are created automatically via database trigger');
    console.log('✅ RLS is working correctly');
    console.log('✅ Users can authenticate successfully');
  } else {
    console.log('❌ Tests failed! Please check the migration and configuration.');
    console.log('💡 Make sure to run the migration: supabase/migrations/20250909215240_profiles_trigger.sql');
  }
  console.log('='.repeat(50));

  process.exit(success ? 0 : 1);
}

// Run the test
main().catch(error => {
  console.error('💥 Test script crashed:', error);
  process.exit(1);
});
