const { createAdminClient } = require('../lib/supabase');
require('dotenv').config();

async function fixMissingProfiles() {
  console.log('🔍 Checking for missing profiles...');
  
  const supabase = createAdminClient();
  
  try {
    // Get all users from Supabase Auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    console.log(`📊 Found ${authUsers.users.length} users in Supabase Auth`);
    
    // Get all existing profiles
    const { data: existingProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id');
    
    if (profileError) {
      console.error('❌ Error fetching existing profiles:', profileError);
      return;
    }
    
    const existingProfileIds = new Set(existingProfiles.map(p => p.id));
    console.log(`📊 Found ${existingProfiles.length} existing profiles`);
    
    // Find users without profiles
    const usersWithoutProfiles = authUsers.users.filter(user => !existingProfileIds.has(user.id));
    
    if (usersWithoutProfiles.length === 0) {
      console.log('✅ All users have profiles!');
      return;
    }
    
    console.log(`⚠️  Found ${usersWithoutProfiles.length} users without profiles:`);
    
    // Get admin and customer role IDs
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name')
      .in('name', ['admin', 'customer']);
    
    if (rolesError) {
      console.error('❌ Error fetching roles:', rolesError);
      return;
    }
    
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.name] = role.id;
    });
    
    console.log('📋 Available roles:', roleMap);
    
    // Create profiles for missing users
    for (const user of usersWithoutProfiles) {
      console.log(`\n👤 Creating profile for user: ${user.email} (${user.id})`);
      
      // Determine role based on user_metadata
      const isAdmin = user.user_metadata?.is_admin === true;
      const roleId = isAdmin ? roleMap.admin : roleMap.customer;
      
      if (!roleId) {
        console.error(`❌ No role found for ${isAdmin ? 'admin' : 'customer'}`);
        continue;
      }
      
      const profileData = {
        id: user.id,
        email: user.email,
        role_id: roleId,
        company_name: user.user_metadata?.company_name || null,
        first_name: user.user_metadata?.first_name || null,
        last_name: user.user_metadata?.last_name || null,
        phone: user.user_metadata?.phone || null,
        is_admin: isAdmin,
        status: 'active',
        has_payment_method: false,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
      
      console.log('📝 Profile data:', profileData);
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();
      
      if (insertError) {
        console.error(`❌ Error creating profile for ${user.email}:`, insertError);
      } else {
        console.log(`✅ Created profile for ${user.email}:`, newProfile.id);
      }
    }
    
    console.log('\n🎉 Profile creation completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
fixMissingProfiles()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

