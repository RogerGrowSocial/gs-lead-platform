const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const SystemLogService = require('../services/systemLogService');

/**
 * Middleware to sync Supabase Auth users with public.users table
 * This should be used as a webhook handler for Supabase Auth events
 */
async function handleAuthEvent(req, res) {
  try {
    const { type, record, table } = req.body;
    
    // Only handle auth.users events
    if (table !== 'auth.users') {
      return res.status(400).json({ error: 'Invalid table' });
    }

    switch (type) {
      case 'INSERT':
        await handleUserCreated(record);
        break;
      case 'UPDATE':
        await handleUserUpdated(record);
        break;
      case 'DELETE':
        await handleUserDeleted(record);
        break;
      default:
        logger.warn(`Unhandled auth event type: ${type}`);
        return res.status(400).json({ error: 'Unhandled event type' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error handling auth event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle new user creation in auth.users
 */
async function handleUserCreated(authUser) {
  try {
    // Check if user already exists in public.profiles
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('id, email, company_name')
      .eq('id', authUser.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw checkError;
    }

    if (existingUser) {
      logger.info(`User ${authUser.id} already exists in public.profiles`);
      
      // Log user profile update
      await SystemLogService.logUserManagement(
        'profile_updated',
        authUser.id,
        'Gebruiker profiel bijgewerkt via auth sync',
        null,
        {
          user_id: authUser.id,
          email: authUser.email,
          sync_type: 'existing_user_update'
        }
      );
      
      // Update the existing user with any new auth data
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          email: authUser.email,
          updated_at: authUser.updated_at,
          last_login: authUser.last_sign_in_at
        })
        .eq('id', authUser.id);
      
      if (updateError) throw updateError;
      return;
    }

    // Get user metadata from auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(authUser.id);
    if (authError) throw authError;

    const userMetadata = authData?.user?.user_metadata || {};
    
    // Create user in public.profiles with all necessary fields
    const { error } = await supabase
      .from('profiles')
      .insert([
        {
          id: authUser.id,
          email: authUser.email,
          role_id: 'customer',
          company_name: userMetadata.company_name || null,
          first_name: userMetadata.first_name || null,
          last_name: userMetadata.last_name || null,
          phone: userMetadata.phone || null,
          created_at: authUser.created_at,
          updated_at: authUser.updated_at,
          last_login: authUser.last_sign_in_at,
          balance: 0,
          is_admin: false
        }
      ]);

    if (error) {
      logger.error('Error creating user in public.profiles:', error);
      throw error;
    }
    
    logger.info(`Created user ${authUser.id} in public.profiles`);
  } catch (error) {
    logger.error('Error in handleUserCreated:', error);
    throw error;
  }
}

/**
 * Handle user updates in auth.users
 */
async function handleUserUpdated(authUser) {
  try {
    // Update user in public.profiles
    const { error } = await supabase
      .from('profiles')
      .update({
        email: authUser.email,
        updated_at: authUser.updated_at,
        last_login: authUser.last_sign_in_at
      })
      .eq('id', authUser.id);

    if (error) throw error;
    logger.info(`Updated user ${authUser.id} in public.profiles`);
  } catch (error) {
    logger.error('Error updating user in public.profiles:', error);
    throw error;
  }
}

/**
 * Handle user deletion in auth.users
 */
async function handleUserDeleted(authUser) {
  try {
    // Soft delete user in public.profiles by setting status to 'deleted'
    const { error } = await supabase
      .from('profiles')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', authUser.id);

    if (error) throw error;
    logger.info(`Soft deleted user ${authUser.id} in public.profiles`);
  } catch (error) {
    logger.error('Error deleting user in public.profiles:', error);
    throw error;
  }
}

module.exports = {
  handleAuthEvent
}; 