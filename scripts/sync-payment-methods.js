const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncPaymentMethods() {
  console.log('🔄 Syncing payment methods with profiles...');
  
  try {
    // Get all users who have payment methods
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('user_id, type, provider_method, is_default')
      .order('user_id');
    
    if (pmError) {
      console.error('❌ Error fetching payment methods:', pmError);
      return;
    }
    
    console.log(`📊 Found ${paymentMethods?.length || 0} payment methods`);
    
    if (!paymentMethods || paymentMethods.length === 0) {
      console.log('✅ No payment methods to sync');
      return;
    }
    
    // Group by user_id
    const userPaymentMethods = {};
    paymentMethods.forEach(pm => {
      if (!userPaymentMethods[pm.user_id]) {
        userPaymentMethods[pm.user_id] = [];
      }
      userPaymentMethods[pm.user_id].push(pm);
    });
    
    console.log(`👥 Found ${Object.keys(userPaymentMethods).length} users with payment methods`);
    
    // Update each user's profile
    for (const [userId, methods] of Object.entries(userPaymentMethods)) {
      const defaultMethod = methods.find(m => m.is_default) || methods[0];
      const paymentMethodType = defaultMethod.type === 'credit_card' ? 'creditcard' : 
                               defaultMethod.type === 'sepa' ? 'sepa' : 
                               defaultMethod.provider_method;
      
      console.log(`🔄 Updating profile for user ${userId}: ${paymentMethodType}`);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          has_payment_method: true,
          payment_method: paymentMethodType,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error(`❌ Error updating profile for user ${userId}:`, updateError);
      } else {
        console.log(`✅ Updated profile for user ${userId}`);
      }
    }
    
    console.log('🎉 Sync completed!');
    
  } catch (error) {
    console.error('❌ Error in sync:', error);
  }
}

syncPaymentMethods();
