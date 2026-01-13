const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', JSON.stringify(error, null, 2));
  } else {
    console.log('All Auth users:');
    data.users.forEach(u => {
      console.log({
        email: u.email,
        id: u.id,
        user_metadata: u.user_metadata,
        email_confirmed_at: u.email_confirmed_at,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at
      });
    });
  }
})(); 