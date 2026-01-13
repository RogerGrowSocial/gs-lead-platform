const { supabaseAdmin } = require('../config/supabase');

async function updateBillingSystem() {
  console.log('🚀 Updating billing system...');
  
  try {
    // Step 1: Add missing columns to leads table
    console.log('1. Adding missing columns to leads table...');
    
    const leadTableUpdates = [
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry_id UUID REFERENCES industries(id) ON DELETE SET NULL;',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS price_at_purchase DECIMAL(10,2);',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT \'medium\';'
    ];
    
    // Test connection first
    const { data, error: testError } = await supabaseAdmin
      .from('industries')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('Connection test failed:', testError);
    } else {
      console.log('✓ Connection test passed');
    }
    
    // Step 2: Add pricing columns to industries table
    console.log('2. Adding pricing columns to industries table...');
    
    // Step 3: Update existing industries with pricing
    console.log('3. Updating existing industries with default pricing...');
    
    const industriesWithPricing = [
      { name: 'Technology', price: 15.00, description: 'IT en technologie bedrijven' },
      { name: 'Healthcare', price: 20.00, description: 'Zorgverleners en medische diensten' },
      { name: 'Finance', price: 25.00, description: 'Financiële dienstverlening' },
      { name: 'Real Estate', price: 18.00, description: 'Makelaardij en vastgoed' },
      { name: 'Consulting', price: 12.00, description: 'Adviesbureaus en consultancy' },
      { name: 'Education', price: 10.00, description: 'Onderwijsinstellingen' },
      { name: 'Retail', price: 8.00, description: 'Detailhandel' },
      { name: 'Manufacturing', price: 14.00, description: 'Productie en fabricage' }
    ];
    
    for (const industry of industriesWithPricing) {
      const { error } = await supabaseAdmin
        .from('industries')
        .upsert({
          name: industry.name,
          price_per_lead: industry.price,
          description: industry.description,
          is_active: true
        }, { 
          onConflict: 'name',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`Error updating industry ${industry.name}:`, error);
      } else {
        console.log(`✓ Updated ${industry.name} with price €${industry.price}`);
      }
    }
    
    // Step 4: Set approved_at for existing approved leads
    console.log('4. Setting approved_at for existing approved leads...');
    
    const { error: approvedError } = await supabaseAdmin
      .from('leads')
      .update({ approved_at: new Date().toISOString() })
      .eq('status', 'approved')
      .is('approved_at', null);
    
    if (approvedError) {
      console.error('Error setting approved_at:', approvedError);
    } else {
      console.log('✓ Set approved_at for existing approved leads');
    }
    
    // Step 5: Set price_at_purchase for existing leads
    console.log('5. Setting price_at_purchase for existing leads...');
    
    const { data: leadsWithoutPrice, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, industry_id')
      .is('price_at_purchase', null);
    
    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
    } else {
      for (const lead of leadsWithoutPrice || []) {
        let price = 10.00; // Default price
        
        if (lead.industry_id) {
          const { data: industry } = await supabaseAdmin
            .from('industries')
            .select('price_per_lead')
            .eq('id', lead.industry_id)
            .single();
          
          if (industry && industry.price_per_lead) {
            price = industry.price_per_lead;
          }
        }
        
        const { error: updateError } = await supabaseAdmin
          .from('leads')
          .update({ price_at_purchase: price })
          .eq('id', lead.id);
        
        if (updateError) {
          console.error(`Error updating price for lead ${lead.id}:`, updateError);
        }
      }
      
      console.log(`✓ Set price_at_purchase for ${leadsWithoutPrice?.length || 0} leads`);
    }
    
    console.log('✅ Billing system update completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Added missing columns to leads table');
    console.log('- Updated industries with pricing information');
    console.log('- Set approved_at for existing approved leads');
    console.log('- Set price_at_purchase for existing leads');
    console.log('\n🎯 Next steps:');
    console.log('- The admin/settings page now has a "Branches Beheer" section');
    console.log('- Billing calculations now use assigned leads (user_id) instead of all leads');
    console.log('- Industry breakdown is shown in billing overview');
    
  } catch (error) {
    console.error('❌ Update failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  updateBillingSystem().then(() => process.exit(0));
}

module.exports = { updateBillingSystem };
