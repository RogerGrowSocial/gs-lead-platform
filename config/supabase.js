const { createClient } = require('@supabase/supabase-js')

// Only load dotenv locally (Vercel uses environment variables directly)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
if (!isVercel) {
  require('dotenv').config()
}

// CRITICAL: Validate environment variables before creating clients
// This prevents silent failures and provides clear error messages
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required. Check your .env file or Vercel environment variables.');
}
if (!supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required. Check your .env file or Vercel environment variables.');
}
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required. Check your .env file or Vercel environment variables.');
}

// Initialize Supabase client for regular operations
const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

// Initialize Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

module.exports = {
  supabase,
  supabaseAdmin
} 