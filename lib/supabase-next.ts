import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnon = process.env.SUPABASE_ANON_KEY!;
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY!; // service_role

export const supabase = createClient(supabaseUrl, supabaseAnon);
export const supabaseAdmin = createClient(supabaseUrl, supabaseService); 