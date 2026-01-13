// @ts-ignore
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Define the profile interface matching the new schema
interface Profile {
  id: string;
  email: string;
  role_id: string;
  created_at?: string;
  updated_at?: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  vat_number?: string;
  coc_number?: string;
  mollie_customer_id?: string;
  balance?: number;
  is_admin?: boolean;
  last_login?: string;
}

// Define the webhook payload interface
interface WebhookPayload {
  type: string;
  record: {
    id: string;
    email: string;
    phone?: string;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
  };
  table: string;
  schema: string;
  commit_timestamp: string;
  event: string;
}

serve(async (req: Request) => {
  try {
    // Verify the request method
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Get the request body
    const body = await req.json() as WebhookPayload;
    const { record, type, event } = body;

    // Only process user.created events
    if (type !== 'user.created' || event !== 'INSERT') {
      return new Response('Event type not supported', { status: 400 });
    }

    // Validate required fields
    if (!record?.id || !record?.email) {
      console.error('Missing required fields:', record);
      return new Response('Missing required fields', { status: 400 });
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables');
      return new Response('Server configuration error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if profile already exists (idempotency)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', record.id)
      .single();

    if (existingProfile) {
      console.log('Profile already exists:', record.id);
      return new Response(
        JSON.stringify({ 
          message: 'Profile already exists',
          profile: { id: record.id, email: record.email }
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create the profile object with metadata
    const profile: Profile = {
      id: record.id,
      email: record.email,
      role_id: record.app_metadata?.role || 'customer',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      balance: 0.00,
      is_admin: false,
      // Include any additional metadata from user_metadata if needed
      ...(record.user_metadata?.company_name && { company_name: record.user_metadata.company_name }),
      ...(record.user_metadata?.first_name && { first_name: record.user_metadata.first_name }),
      ...(record.user_metadata?.last_name && { last_name: record.user_metadata.last_name }),
      ...(record.user_metadata?.phone && { phone: record.user_metadata.phone }),
      ...(record.user_metadata?.postal_code && { postal_code: record.user_metadata.postal_code }),
      ...(record.user_metadata?.city && { city: record.user_metadata.city }),
      ...(record.user_metadata?.country && { country: record.user_metadata.country }),
      ...(record.user_metadata?.vat_number && { vat_number: record.user_metadata.vat_number }),
      ...(record.user_metadata?.coc_number && { coc_number: record.user_metadata.coc_number })
    };

    // Insert the profile
    const { error } = await supabase
      .from('profiles')
      .insert(profile);

    if (error) {
      console.error('Profile creation failed:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Profile creation failed', 
          details: error,
          code: error.code
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        message: 'Profile created successfully',
        profile: { 
          id: profile.id, 
          email: profile.email,
          role_id: profile.role_id
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Function error:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Server error',
        details: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}); 