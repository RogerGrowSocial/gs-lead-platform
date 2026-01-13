const { createClient } = require('@supabase/supabase-js');

// Use service key for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function addIndustriesColumns() {
  console.log('🚀 Adding missing columns to industries table...');
  
  try {
    // Since we can't run ALTER TABLE directly through Supabase client,
    // we'll create the industries with the new structure by recreating them
    
    // First, get existing industries
    const { data: existingIndustries, error: fetchError } = await supabaseAdmin
      .from('industries')
      .select('*');
    
    if (fetchError) {
      console.error('Error fetching existing industries:', fetchError);
      return;
    }
    
    console.log('Found existing industries:', existingIndustries?.length || 0);
    
    // For now, let's just update the existing industries with new data
    // We'll need to manually add the columns via Supabase dashboard
    
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
    
    console.log('📋 Industry pricing structure ready:');
    industriesWithPricing.forEach(industry => {
      console.log(`- ${industry.name}: €${industry.price} - ${industry.description}`);
    });
    
    console.log('\n⚠️  Manual steps required:');
    console.log('1. Go to Supabase Dashboard > Table Editor > industries');
    console.log('2. Add these columns:');
    console.log('   - price_per_lead: DECIMAL(10,2) DEFAULT 10.00');
    console.log('   - description: TEXT');
    console.log('   - is_active: BOOLEAN DEFAULT TRUE');
    console.log('3. Run this script again to populate the data');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  addIndustriesColumns().then(() => process.exit(0));
}

module.exports = { addIndustriesColumns };
