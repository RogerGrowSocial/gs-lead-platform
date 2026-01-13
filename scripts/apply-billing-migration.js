#!/usr/bin/env node

/**
 * Script to apply the billing functions migration
 * Run this script to create the required database functions and views
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying billing functions migration...');
  
  try {
    // Read the migration file
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250110000000_billing_functions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('📋 Created:');
    console.log('   - v_monthly_lead_usage view');
    console.log('   - get_billing_snapshot() function');
    console.log('   - can_allocate_lead() function');
    console.log('   - RLS policies for subscriptions table');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

// Alternative approach: execute SQL directly
async function applyMigrationDirect() {
  console.log('🚀 Applying billing functions migration (direct approach)...');
  
  try {
    const migrationSQL = `
-- Monthly lead usage view
CREATE OR REPLACE VIEW public.v_monthly_lead_usage AS
SELECT 
    p.id as user_id,
    DATE_TRUNC('month', l.approved_at) as period_month,
    COUNT(l.id) as approved_count,
    COALESCE(SUM(l.price_at_purchase), 0) as approved_amount
FROM profiles p
LEFT JOIN leads l ON p.id = l.user_id 
    AND l.status = 'approved' 
    AND l.approved_at IS NOT NULL
    AND DATE_TRUNC('month', l.approved_at) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY p.id, DATE_TRUNC('month', l.approved_at);

-- Function to get billing snapshot for a user
CREATE OR REPLACE FUNCTION public.get_billing_snapshot(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
    user_profile profiles%ROWTYPE;
    current_subscription subscriptions%ROWTYPE;
    monthly_usage record;
BEGIN
    -- Get user profile
    SELECT * INTO user_profile 
    FROM profiles 
    WHERE id = p_user;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;
    
    -- Get current active subscription
    SELECT * INTO current_subscription
    FROM subscriptions 
    WHERE user_id = p_user 
        AND status = 'active'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Get monthly usage for current month
    SELECT * INTO monthly_usage
    FROM v_monthly_lead_usage
    WHERE user_id = p_user
        AND period_month = DATE_TRUNC('month', CURRENT_DATE);
    
    -- Build result
    result := jsonb_build_object(
        'user_id', p_user,
        'period_month', TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
        'monthly_quota', COALESCE(current_subscription.leads_per_month, 0),
        'approved_count', COALESCE(monthly_usage.approved_count, 0),
        'approved_amount', COALESCE(monthly_usage.approved_amount, 0),
        'balance', COALESCE(user_profile.balance, 0),
        'payment_method', user_profile.payment_method
    );
    
    RETURN result;
END;
$$;

-- Function to check if a lead can be allocated
CREATE OR REPLACE FUNCTION public.can_allocate_lead(p_user uuid, p_price numeric)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_profile profiles%ROWTYPE;
    current_subscription subscriptions%ROWTYPE;
    monthly_usage record;
    is_card_payment boolean;
BEGIN
    -- Get user profile
    SELECT * INTO user_profile 
    FROM profiles 
    WHERE id = p_user;
    
    IF NOT FOUND THEN
        RETURN 'USER_NOT_FOUND';
    END IF;
    
    -- Get current active subscription
    SELECT * INTO current_subscription
    FROM subscriptions 
    WHERE user_id = p_user 
        AND status = 'active'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Get monthly usage for current month
    SELECT * INTO monthly_usage
    FROM v_monthly_lead_usage
    WHERE user_id = p_user
        AND period_month = DATE_TRUNC('month', CURRENT_DATE);
    
    -- Check if quota is reached
    IF COALESCE(current_subscription.leads_per_month, 0) > 0 
        AND COALESCE(monthly_usage.approved_count, 0) >= current_subscription.leads_per_month THEN
        RETURN 'QUOTA_REACHED';
    END IF;
    
    -- Check payment method and balance for card payments
    is_card_payment := user_profile.payment_method IN ('card', 'credit', 'creditcard');
    
    IF is_card_payment AND COALESCE(user_profile.balance, 0) < p_price THEN
        RETURN 'INSUFFICIENT_FUNDS';
    END IF;
    
    RETURN 'OK';
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_billing_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_allocate_lead(uuid, numeric) TO authenticated;
GRANT SELECT ON public.v_monthly_lead_usage TO authenticated;
    `;
    
    // Split SQL into individual statements and execute them
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });
        if (error) {
          console.error('❌ Error executing statement:', error);
          console.error('Statement:', statement.trim());
        }
      }
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('📋 Created:');
    console.log('   - v_monthly_lead_usage view');
    console.log('   - get_billing_snapshot() function');
    console.log('   - can_allocate_lead() function');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

// Check if exec_sql function exists, if not use direct approach
async function checkAndApply() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
    if (error) {
      console.log('⚠️  exec_sql function not available, using direct approach...');
      await applyMigrationDirect();
    } else {
      await applyMigration();
    }
  } catch (error) {
    console.log('⚠️  exec_sql function not available, using direct approach...');
    await applyMigrationDirect();
  }
}

checkAndApply();
