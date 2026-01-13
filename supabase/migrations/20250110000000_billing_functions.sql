-- Migration: Create billing functions and views for the billing API
-- This migration adds the required functions and views for the billing system

-- =====================================================
-- VIEWS
-- =====================================================

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

-- =====================================================
-- FUNCTIONS
-- =====================================================

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

-- Add RLS policies if they don't exist
DO $$
BEGIN
    -- Enable RLS on subscriptions table if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'subscriptions' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Create policy for users to select their own subscriptions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='subscriptions' AND policyname='select own subscriptions'
    ) THEN
        CREATE POLICY "select own subscriptions"
        ON subscriptions FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
    
    -- Create policy for users to insert their own subscriptions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='subscriptions' AND policyname='insert own subscriptions'
    ) THEN
        CREATE POLICY "insert own subscriptions"
        ON subscriptions FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;
    
    -- Create policy for users to update their own subscriptions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='subscriptions' AND policyname='update own subscriptions'
    ) THEN
        CREATE POLICY "update own subscriptions"
        ON subscriptions FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
