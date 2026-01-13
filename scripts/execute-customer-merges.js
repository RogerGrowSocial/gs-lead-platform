require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('  - SUPABASE_URL');
  if (!supabaseKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeMerge(fromId, intoId, description) {
  try {
    console.log(`\n🔄 ${description}`);
    console.log(`   Merging ${fromId} → ${intoId}`);
    
    const { data, error } = await supabase.rpc('merge_customers', {
      p_from_customer_id: fromId,
      p_into_customer_id: intoId,
      p_delete_from: true
    });

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Successfully merged!`);
    return true;
  } catch (err) {
    console.error(`   ❌ Exception: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting customer merges...\n');

  const merges = [
    {
      from: 'e7d18629-117f-4167-99a1-c5e99dc53aa6',
      into: '3cf95c6f-9be0-4b8a-bef5-d6f2f146e2f6',
      description: '1/3: Merge Koos Kluytmans into Kluytmans Beheer B.V.'
    },
    {
      from: '2ee8936c-9404-4052-b6c3-8a7aff365cba',
      into: '3cf95c6f-9be0-4b8a-bef5-d6f2f146e2f6',
      description: '2/3: Merge Koos Kluytmans Interieurs B.V. into Kluytmans Beheer B.V.'
    },
    {
      from: 'ba9b4985-995d-4c7b-a454-7754ca962d15',
      into: '6a6baa8a-b42e-48b8-92ee-84896503f247',
      description: '3/3: Merge Steck013 into Steck 013'
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const merge of merges) {
    const success = await executeMerge(merge.from, merge.into, merge.description);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay between merges
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Completed: ${successCount} successful, ${failCount} failed`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
