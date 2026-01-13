const { createClient } = require('@supabase/supabase-js');

// Load Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncLeadUsage() {
  try {
    console.log('🔄 Syncing lead usage data...');

    // First, let's check what leads exist
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, user_id, status, created_at, price_at_purchase')
      .in('status', ['accepted', 'approved']);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return;
    }

    console.log(`Found ${leads.length} accepted/approved leads`);

    // Group leads by user and month
    const usageMap = new Map();
    
    leads.forEach(lead => {
      if (!lead.user_id || !lead.created_at) return;
      
      const month = new Date(lead.created_at).toISOString().slice(0, 7) + '-01';
      const key = `${lead.user_id}-${month}`;
      
      if (!usageMap.has(key)) {
        usageMap.set(key, {
          user_id: lead.user_id,
          period_month: month,
          leads_count: 0,
          total_amount: 0
        });
      }
      
      const usage = usageMap.get(key);
      usage.leads_count += 1;
      usage.total_amount += lead.price_at_purchase || 0;
    });

    console.log(`Found ${usageMap.size} user-month combinations`);

    // Insert/update lead_usage records
    for (const [key, usage] of usageMap) {
      console.log(`Syncing user ${usage.user_id} for ${usage.period_month}: ${usage.leads_count} leads, €${usage.total_amount}`);
      
      const { error: upsertError } = await supabase
        .from('lead_usage')
        .upsert({
          user_id: usage.user_id,
          period_month: usage.period_month,
          leads_count: usage.leads_count,
          total_amount: usage.total_amount
        }, {
          onConflict: 'user_id,period_month'
        });

      if (upsertError) {
        console.error(`Error upserting usage for ${key}:`, upsertError);
      } else {
        console.log(`✅ Synced ${key}`);
      }
    }

    console.log('🎉 Lead usage sync completed!');

  } catch (error) {
    console.error('Error in syncLeadUsage:', error);
  }
}

syncLeadUsage();
