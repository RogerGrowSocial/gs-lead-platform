#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncAdminStatus(userId, isAdmin) {
  try {
    console.log(`🔄 Syncing admin status for user ${userId}: ${isAdmin}`);

    // Update Supabase Auth user metadata
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        user_metadata: { 
          is_admin: isAdmin
        }
      }
    );

    if (authError) {
      console.error('❌ Error updating auth user metadata:', authError);
      return false;
    }

    // Update database profile
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        is_admin: isAdmin,
        role_id: isAdmin ? 'admin' : 'customer',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (dbError) {
      console.error('❌ Error updating database profile:', dbError);
      return false;
    }

    console.log(`✅ Admin status synced successfully: ${isAdmin}`);
    return true;

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// If called directly, sync all users
async function syncAllUsers() {
  try {
    console.log('🔄 Syncing admin status for all users...\n');

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, is_admin');

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    console.log(`📊 Found ${profiles.length} profiles to sync`);

    for (const profile of profiles) {
      // Get auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
      
      if (authError) {
        console.log(`⚠️  Could not fetch auth user for ${profile.email}: ${authError.message}`);
        continue;
      }

      const authIsAdmin = authUser.user.user_metadata?.is_admin === true;
      const dbIsAdmin = profile.is_admin === true;

      if (authIsAdmin !== dbIsAdmin) {
        console.log(`🔄 Syncing ${profile.email}: Auth=${authIsAdmin}, DB=${dbIsAdmin}`);
        await syncAdminStatus(profile.id, authIsAdmin);
      } else {
        console.log(`✅ ${profile.email}: Already in sync (Admin=${authIsAdmin})`);
      }
    }

    console.log('\n✅ Sync complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Export functions for use in other scripts
module.exports = { syncAdminStatus, syncAllUsers };

// If called directly, run sync all
if (require.main === module) {
  syncAllUsers();
}
