#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, description) {
  log(`\n${step}. ${description}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function migrateUsers() {
  log('🔄 User Migration Script', 'bright');
  log('This script will help migrate users from old to new Supabase project', 'reset');
  
  // Check for old project credentials
  const oldProjectUrl = process.env.OLD_SUPABASE_URL;
  const oldProjectKey = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!oldProjectUrl || !oldProjectKey) {
    logError('Missing old project credentials');
    logInfo('Please add the following to your .env file:');
    logInfo('  OLD_SUPABASE_URL=https://old-project.supabase.co');
    logInfo('  OLD_SUPABASE_SERVICE_ROLE_KEY=old-service-role-key');
    process.exit(1);
  }
  
  // Initialize clients
  const oldSupabase = createClient(oldProjectUrl, oldProjectKey);
  const newSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    logStep('1', 'Fetching users from old project...');
    
    // Get all users from old project
    const { data: oldUsers, error: oldUsersError } = await oldSupabase.auth.admin.listUsers();
    
    if (oldUsersError) {
      throw oldUsersError;
    }
    
    logSuccess(`Found ${oldUsers.users.length} users in old project`);
    
    // Get profiles from old project
    const { data: oldProfiles, error: oldProfilesError } = await oldSupabase
      .from('profiles')
      .select('*');
    
    if (oldProfilesError) {
      logWarning('Could not fetch profiles from old project (table might not exist)');
    } else {
      logSuccess(`Found ${oldProfiles.length} profiles in old project`);
    }
    
    logStep('2', 'Creating users in new project...');
    
    let createdUsers = 0;
    let skippedUsers = 0;
    let failedUsers = 0;
    
    for (const user of oldUsers.users) {
      try {
        // Check if user already exists in new project
        const { data: existingUser } = await newSupabase.auth.admin.getUserById(user.id);
        
        if (existingUser.user) {
          logInfo(`User ${user.email} already exists, skipping...`);
          skippedUsers++;
          continue;
        }
        
        // Create user in new project
        const { data: newUser, error: createError } = await newSupabase.auth.admin.createUser({
          email: user.email,
          password: 'temporary-password-123!', // Users will need to reset their password
          email_confirm: true,
          user_metadata: user.user_metadata,
          app_metadata: user.app_metadata
        });
        
        if (createError) {
          logError(`Failed to create user ${user.email}: ${createError.message}`);
          failedUsers++;
          continue;
        }
        
        logSuccess(`Created user: ${user.email}`);
        createdUsers++;
        
        // Wait a bit to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        logError(`Error processing user ${user.email}: ${error.message}`);
        failedUsers++;
      }
    }
    
    logStep('3', 'Migrating profiles...');
    
    if (oldProfiles && oldProfiles.length > 0) {
      let createdProfiles = 0;
      let failedProfiles = 0;
      
      for (const profile of oldProfiles) {
        try {
          // Check if profile already exists
          const { data: existingProfile } = await newSupabase
            .from('profiles')
            .select('id')
            .eq('id', profile.id)
            .single();
          
          if (existingProfile) {
            logInfo(`Profile for ${profile.id} already exists, skipping...`);
            continue;
          }
          
          // Create profile in new project
          const { error: profileError } = await newSupabase
            .from('profiles')
            .insert(profile);
          
          if (profileError) {
            logError(`Failed to create profile for ${profile.id}: ${profileError.message}`);
            failedProfiles++;
            continue;
          }
          
          logSuccess(`Created profile for: ${profile.id}`);
          createdProfiles++;
          
        } catch (error) {
          logError(`Error processing profile ${profile.id}: ${error.message}`);
          failedProfiles++;
        }
      }
      
      logInfo(`Profile migration: ${createdProfiles} created, ${failedProfiles} failed`);
    }
    
    logStep('4', 'Migration Summary');
    
    log('\n📊 Migration Results:', 'bright');
    log(`Users: ${createdUsers} created, ${skippedUsers} skipped, ${failedUsers} failed`);
    log(`Total processed: ${oldUsers.users.length}`);
    
    log('\n🎯 Next Steps:', 'bright');
    log('1. Users will need to reset their passwords (they were set to temporary values)');
    log('2. Test login with a few migrated users');
    log('3. Check that profiles are properly linked');
    log('4. Verify Mollie integration works');
    
    log('\n⚠️ Important Notes:', 'yellow');
    log('- All users have temporary passwords: "temporary-password-123!"');
    log('- Users should reset their passwords on first login');
    log('- Monitor for any authentication issues');
    log('- Check that all user data migrated correctly');
    
    log('\n✨ User migration completed!', 'green');
    
  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  logError(`Unhandled promise rejection: ${error.message}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  migrateUsers().catch((error) => {
    logError(`Script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { migrateUsers }; 