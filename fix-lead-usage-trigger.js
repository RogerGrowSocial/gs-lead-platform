const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixLeadUsageTrigger() {
  try {
    console.log('🔧 Fixing lead usage trigger to handle "accepted" status...');

    // Update the trigger function to handle both 'approved' and 'accepted' status
    const updateFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.update_lead_usage()
      RETURNS TRIGGER AS $$
      DECLARE
        current_month DATE;
        existing_usage RECORD;
      BEGIN
        -- Only process approved/accepted leads
        IF NEW.status IN ('approved', 'accepted') AND (OLD IS NULL OR OLD.status NOT IN ('approved', 'accepted')) THEN
          -- Get current month start
          current_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
          
          -- Check if usage record exists for this user and month
          SELECT * INTO existing_usage 
          FROM public.lead_usage 
          WHERE user_id = NEW.user_id AND period_month = current_month;
          
          IF FOUND THEN
            -- Update existing record
            UPDATE public.lead_usage 
            SET 
              leads_count = leads_count + 1,
              total_amount = total_amount + COALESCE(NEW.price_at_purchase, 0),
              updated_at = NOW()
            WHERE user_id = NEW.user_id AND period_month = current_month;
          ELSE
            -- Create new record
            INSERT INTO public.lead_usage (user_id, period_month, leads_count, total_amount)
            VALUES (NEW.user_id, current_month, 1, COALESCE(NEW.price_at_purchase, 0));
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    const { error: functionError } = await supabase.rpc('exec_sql', { 
      sql: updateFunctionSQL 
    });

    if (functionError) {
      console.error('❌ Error updating function:', functionError);
      return;
    }

    console.log('✅ Lead usage trigger function updated successfully');

    // Update existing data to include accepted leads
    const updateDataSQL = `
      INSERT INTO public.lead_usage (user_id, period_month, leads_count, total_amount)
      SELECT 
        l.user_id,
        DATE_TRUNC('month', l.created_at)::DATE as period_month,
        COUNT(*) as leads_count,
        COALESCE(SUM(l.price_at_purchase), 0) as total_amount
      FROM public.leads l
      WHERE l.status = 'accepted'
        AND l.created_at IS NOT NULL
        AND l.user_id IS NOT NULL
      GROUP BY l.user_id, DATE_TRUNC('month', l.created_at)::DATE
      ON CONFLICT (user_id, period_month) DO UPDATE SET
        leads_count = lead_usage.leads_count + EXCLUDED.leads_count,
        total_amount = lead_usage.total_amount + EXCLUDED.total_amount,
        updated_at = NOW();
    `;

    const { error: dataError } = await supabase.rpc('exec_sql', { 
      sql: updateDataSQL 
    });

    if (dataError) {
      console.error('❌ Error updating existing data:', dataError);
      return;
    }

    console.log('✅ Existing accepted leads data updated successfully');
    console.log('🎉 Lead usage trigger fix completed!');

  } catch (error) {
    console.error('❌ Error fixing lead usage trigger:', error);
  }
}

// Run the fix
fixLeadUsageTrigger();
