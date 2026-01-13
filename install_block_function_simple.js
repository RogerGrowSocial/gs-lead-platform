const { supabaseAdmin } = require('./config/supabase');

async function installBlockFunction() {
  try {
    console.log('🔧 Installing should_block_user_for_status_change function...');
    
    const sql = `
CREATE OR REPLACE FUNCTION should_block_user_for_status_change(p_user_id UUID)
RETURNS TABLE(block BOOLEAN, reason TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_outstanding_payments INTEGER := 0;
    v_pending_mandates INTEGER := 0;
    v_outstanding_total DECIMAL := 0;
BEGIN
    -- Check for outstanding payments
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_outstanding_payments, v_outstanding_total
    FROM payments 
    WHERE user_id = p_user_id 
    AND status IN ('pending', 'failed', 'open')
    AND amount > 0;
    
    -- Check for pending SEPA mandates
    SELECT COUNT(*)
    INTO v_pending_mandates
    FROM pending_mandates 
    WHERE user_id = p_user_id 
    AND status = 'pending';
    
    -- Block if there are outstanding payments or pending mandates
    IF v_outstanding_payments > 0 OR v_pending_mandates > 0 THEN
        RETURN QUERY SELECT 
            TRUE as block,
            CASE 
                WHEN v_outstanding_payments > 0 AND v_pending_mandates > 0 THEN 
                    'Openstaande betalingen (€' || v_outstanding_total || ') en wachtende SEPA-mandaten'
                WHEN v_outstanding_payments > 0 THEN 
                    'Openstaande betalingen (€' || v_outstanding_total || ')'
                WHEN v_pending_mandates > 0 THEN 
                    'Wachtende SEPA-mandaten'
                ELSE 'Onbekende reden'
            END as reason;
    ELSE
        RETURN QUERY SELECT FALSE as block, NULL::TEXT as reason;
    END IF;
END;
$$;
    `;
    
    // Execute the SQL using a direct query
    const { data, error } = await supabaseAdmin
      .from('_sql')
      .select('*')
      .eq('query', sql);
    
    if (error) {
      console.error('❌ Error installing function:', error);
      console.log('💡 Try running this SQL manually in Supabase SQL Editor:');
      console.log(sql);
      return;
    }
    
    console.log('✅ Function installed successfully!');
    
  } catch (err) {
    console.error('❌ Error:', err);
    console.log('💡 Please run the SQL manually in Supabase SQL Editor');
  }
}

installBlockFunction();
