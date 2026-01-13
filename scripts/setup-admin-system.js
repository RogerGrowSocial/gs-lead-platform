#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupAdminSystem() {
  try {
    console.log('🔧 Setting up admin system...\n');

    // Step 1: Check if admin user exists in Supabase Auth
    const adminEmail = 'info@growsocialmedia.nl';
    console.log(`📧 Checking for admin user: ${adminEmail}`);

    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
      filters: {
        email: adminEmail
      }
    });

    if (listError) {
      console.error('❌ Error checking existing users:', listError);
      return;
    }

    let adminUser = null;
    if (existingUsers?.users?.length > 0) {
      adminUser = existingUsers.users[0];
      console.log(`✅ Admin user found in Supabase Auth: ${adminUser.id}`);
    } else {
      // Create admin user
      console.log('👤 Creating new admin user...');
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: 'Kh356HbfneKh23Hfkwd', // Your provided password
        user_metadata: { 
          is_admin: true,
          first_name: 'Admin',
          last_name: 'User',
          company_name: 'GrowSocial'
        },
        email_confirm: true
      });

      if (createError) {
        console.error('❌ Error creating admin user:', createError);
        return;
      }

      adminUser = newUser.user;
      console.log(`✅ Admin user created: ${adminUser.id}`);
    }

    // Step 2: Update admin user metadata if needed
    if (!adminUser.user_metadata?.is_admin) {
      console.log('🔧 Updating user metadata to admin...');
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        adminUser.id,
        { 
          user_metadata: { 
            ...adminUser.user_metadata,
            is_admin: true,
            first_name: adminUser.user_metadata?.first_name || 'Admin',
            last_name: adminUser.user_metadata?.last_name || 'User',
            company_name: adminUser.user_metadata?.company_name || 'GrowSocial'
          }
        }
      );

      if (updateError) {
        console.error('❌ Error updating user metadata:', updateError);
        return;
      }
      console.log('✅ User metadata updated to admin');
    }

    // Step 3: Ensure profile exists in database
    console.log('📊 Checking/creating profile in database...');
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error checking profile:', profileError);
      return;
    }

    if (!existingProfile) {
      // Get the admin role
      console.log('🔍 Getting admin role...');
      const { data: adminRole, error: rolesError } = await supabase
        .from('roles')
        .select('id, name')
        .eq('name', 'admin')
        .single();

      let roleId = null;
      if (!rolesError && adminRole) {
        roleId = adminRole.id;
        console.log('✅ Using admin role:', adminRole.name);
      } else {
        console.log('⚠️  Admin role not found, using customer role');
        const { data: customerRole } = await supabase
          .from('roles')
          .select('id, name')
          .eq('name', 'customer')
          .single();
        roleId = customerRole?.id || null;
      }

      // Create profile
      console.log('👤 Creating profile in database...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          id: adminUser.id,
          email: adminUser.email,
          role_id: roleId, // Use existing role or NULL
          company_name: adminUser.user_metadata?.company_name || 'GrowSocial',
          first_name: adminUser.user_metadata?.first_name || 'Admin',
          last_name: adminUser.user_metadata?.last_name || 'User',
          phone: adminUser.user_metadata?.phone || null,
          balance: 0,
          is_admin: true,
          status: 'active',
          created_at: adminUser.created_at,
          updated_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error('❌ Error creating profile:', insertError);
        return;
      }
      console.log('✅ Profile created in database');
    } else {
      // Update existing profile to ensure admin status
      console.log('🔧 Updating existing profile to admin...');
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          is_admin: true,
          company_name: adminUser.user_metadata?.company_name || existingProfile.company_name || 'GrowSocial',
          first_name: adminUser.user_metadata?.first_name || existingProfile.first_name || 'Admin',
          last_name: adminUser.user_metadata?.last_name || existingProfile.last_name || 'User',
          updated_at: new Date().toISOString()
        })
        .eq('id', adminUser.id);

      if (updateProfileError) {
        console.error('❌ Error updating profile:', updateProfileError);
        return;
      }
      console.log('✅ Profile updated to admin');
    }

    // Step 4: Verify admin setup
    console.log('\n🔍 Verifying admin setup...');
    
    // Check Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(adminUser.id);
    if (authError) {
      console.error('❌ Error verifying auth user:', authError);
      return;
    }

    // Check Database Profile
    const { data: dbProfile, error: dbError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser.id)
      .single();

    if (dbError) {
      console.error('❌ Error verifying database profile:', dbError);
      return;
    }

    console.log('\n✅ Admin Setup Complete!');
    console.log('📧 Email:', adminUser.email);
    console.log('🔑 Password: Kh356HbfneKh23Hfkwd');
    console.log('🆔 User ID:', adminUser.id);
    console.log('👑 Auth Admin Status:', authUser.user.user_metadata?.is_admin);
    console.log('👑 DB Admin Status:', dbProfile.is_admin);
    console.log('\n🌐 You can now login at: http://localhost:3000/login');
    console.log('🔗 Admin panel: http://localhost:3000/admin');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the setup
setupAdminSystem();
