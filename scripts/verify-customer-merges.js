require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCustomer(id, name) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, company_name, name, domain')
    .eq('id', id)
    .single();

  if (error && error.code === 'PGRST116') {
    console.log(`   ❌ ${name} (${id}) - NOT FOUND (already deleted)`);
    return false;
  } else if (error) {
    console.log(`   ⚠️  ${name} (${id}) - Error: ${error.message}`);
    return false;
  } else {
    console.log(`   ✅ ${name} (${id}) - EXISTS: ${data.company_name || data.name}`);
    return true;
  }
}

async function checkInvoices(customerId, name) {
  const { data, error, count } = await supabase
    .from('customer_invoices')
    .select('*', { count: 'exact', head: false })
    .eq('customer_id', customerId);

  if (error) {
    console.log(`      ⚠️  Invoice check error: ${error.message}`);
    return 0;
  }

  const paidRevenue = data
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  console.log(`      📄 Invoices: ${count || 0} total, €${paidRevenue.toFixed(2)} paid revenue`);
  return count || 0;
}

async function checkDuplicateInvoices() {
  console.log('\n🔍 Checking for remaining duplicate invoices...\n');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        i.invoice_number,
        COUNT(*) AS rows,
        COUNT(DISTINCT i.customer_id) AS distinct_customers,
        array_agg(DISTINCT i.customer_id) AS customer_ids
      FROM public.customer_invoices i
      GROUP BY i.invoice_number
      HAVING COUNT(DISTINCT i.customer_id) > 1
      ORDER BY distinct_customers DESC, rows DESC, i.invoice_number
      LIMIT 10;
    `
  });

  if (error) {
    // Try alternative query
    const { data: altData, error: altError } = await supabase
      .from('customer_invoices')
      .select('invoice_number, customer_id');

    if (altError) {
      console.log(`   ⚠️  Could not check duplicates: ${altError.message}`);
      return;
    }

    // Group by invoice_number and find duplicates
    const grouped = {};
    altData.forEach(inv => {
      if (!grouped[inv.invoice_number]) {
        grouped[inv.invoice_number] = new Set();
      }
      grouped[inv.invoice_number].add(inv.customer_id);
    });

    const duplicates = Object.entries(grouped)
      .filter(([_, customers]) => customers.size > 1)
      .map(([invoice_number, customers]) => ({
        invoice_number,
        distinct_customers: customers.size,
        customer_ids: Array.from(customers)
      }));

    if (duplicates.length === 0) {
      console.log('   ✅ No duplicate invoices found!');
    } else {
      console.log(`   ⚠️  Found ${duplicates.length} duplicate invoice(s):`);
      duplicates.forEach(dup => {
        console.log(`      - ${dup.invoice_number}: ${dup.distinct_customers} customers`);
      });
    }
    return;
  }

  if (!data || data.length === 0) {
    console.log('   ✅ No duplicate invoices found!');
  } else {
    console.log(`   ⚠️  Found ${data.length} duplicate invoice(s):`);
    data.forEach(dup => {
      console.log(`      - ${dup.invoice_number}: ${dup.distinct_customers} customers`);
    });
  }
}

async function main() {
  console.log('🔍 Verifying customer merge status...\n');

  const customersToCheck = [
    { id: 'e7d18629-117f-4167-99a1-c5e99dc53aa6', name: 'Koos Kluytmans' },
    { id: '3cf95c6f-9be0-4b8a-bef5-d6f2f146e2f6', name: 'Kluytmans Beheer B.V.' },
    { id: '2ee8936c-9404-4052-b6c3-8a7aff365cba', name: 'Koos Kluytmans Interieurs B.V.' },
    { id: 'ba9b4985-995d-4c7b-a454-7754ca962d15', name: 'Steck013' },
    { id: '6a6baa8a-b42e-48b8-92ee-84896503f247', name: 'Steck 013' }
  ];

  console.log('📋 Customer Status:\n');
  const results = {};
  
  for (const customer of customersToCheck) {
    const exists = await checkCustomer(customer.id, customer.name);
    results[customer.id] = exists;
    
    if (exists) {
      await checkInvoices(customer.id, customer.name);
    }
  }

  await checkDuplicateInvoices();

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  const existing = Object.values(results).filter(r => r).length;
  const deleted = Object.values(results).filter(r => !r).length;
  console.log(`   ✅ Existing customers: ${existing}`);
  console.log(`   ❌ Deleted customers: ${deleted}`);
  
  if (deleted === 3) {
    console.log('\n   ✅ All merges appear to be complete!');
  } else if (deleted > 0) {
    console.log('\n   ⚠️  Some merges may be partially complete.');
  }
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
