const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  try {
    const email = 'info@growsocialmedia.nl';
    
    // First check if user exists
    const { data: existingUser, error: checkError } = await supabase.auth.admin.listUsers({
      filters: {
        email: email
      }
    });

    if (checkError) {
      console.error('Error checking existing user:', checkError);
      return;
    }

    if (existingUser?.users?.length > 0) {
      console.log('User already exists:', {
        id: existingUser.users[0].id,
        email: existingUser.users[0].email,
        metadata: existingUser.users[0].user_metadata
      });

      // Update user to admin if not already
      if (!existingUser.users[0].user_metadata?.is_admin) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.users[0].id,
          { user_metadata: { is_admin: 1 } }
        );

        if (updateError) {
          console.error('Error updating user to admin:', updateError);
          return;
        }
        console.log('User updated to admin role');
      }
      return;
    }

    // Create new user if doesn't exist
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: '123hoax123',
      user_metadata: { is_admin: 1 },
      email_confirm: true // Auto-confirm the email
    });

    if (error) {
      console.error('Supabase error (full):', JSON.stringify(error, null, 2));
      return;
    }

    console.log('Admin user created successfully:', {
      id: data.user.id,
      email: data.user.email,
      metadata: data.user.user_metadata
    });
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

main(); 