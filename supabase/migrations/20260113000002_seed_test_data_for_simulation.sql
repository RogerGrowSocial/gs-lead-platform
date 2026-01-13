-- =====================================================
-- SEED TEST DATA FOR KPI SIMULATION
-- =====================================================
-- This migration adds some test data to make the KPI simulation
-- more interesting and visible. It adds:
-- - Some paid invoices with revenue
-- - Some paid payments
-- - Some leads
-- - Some users/profiles
-- =====================================================

-- Note: This is optional test data. If you already have real data,
-- you can skip this migration or modify it to add more test data.

-- Add some test paid invoices (if customer_invoices table exists and has data)
-- This will only add invoices if there are existing customers
DO $$
DECLARE
  test_customer_id UUID;
  invoice_count INTEGER;
BEGIN
  -- Get first customer if exists
  SELECT id INTO test_customer_id 
  FROM public.customers 
  LIMIT 1;
  
  -- Count existing paid invoices
  SELECT COUNT(*) INTO invoice_count 
  FROM public.customer_invoices 
  WHERE status = 'paid';
  
  -- Only add test invoices if we have a customer and less than 10 paid invoices
  IF test_customer_id IS NOT NULL AND invoice_count < 10 THEN
    -- Add a few test paid invoices
    INSERT INTO public.customer_invoices (
      customer_id,
      invoice_number,
      invoice_date,
      due_date,
      amount,
      outstanding_amount,
      status,
      line_items,
      created_at
    )
    SELECT 
      test_customer_id,
      'TEST-' || LPAD((ROW_NUMBER() OVER () + invoice_count)::TEXT, 4, '0'),
      CURRENT_DATE - (ROW_NUMBER() OVER () * 7),
      CURRENT_DATE - (ROW_NUMBER() OVER () * 7) + INTERVAL '14 days',
      150.00 + (ROW_NUMBER() OVER () * 25.50),
      0,
      'paid',
      jsonb_build_array(
        jsonb_build_object(
          'description', 'Test dienst ' || ROW_NUMBER() OVER (),
          'quantity', 1,
          'unit_price', 123.97 + (ROW_NUMBER() OVER () * 21.07),
          'has_vat', true,
          'subtotal', 123.97 + (ROW_NUMBER() OVER () * 21.07),
          'vat_amount', (123.97 + (ROW_NUMBER() OVER () * 21.07)) * 0.21,
          'total', 150.00 + (ROW_NUMBER() OVER () * 25.50)
        )
      ),
      NOW() - (ROW_NUMBER() OVER () * INTERVAL '7 days')
    FROM generate_series(1, 5)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Added 5 test paid invoices';
  END IF;
END $$;

-- Add some test paid payments (if payments table exists)
DO $$
DECLARE
  test_user_id UUID;
  payment_count INTEGER;
BEGIN
  -- Get first user/profile if exists
  SELECT id INTO test_user_id 
  FROM public.profiles 
  WHERE is_admin = false
  LIMIT 1;
  
  -- Count existing paid payments
  SELECT COUNT(*) INTO payment_count 
  FROM public.payments 
  WHERE status = 'paid';
  
  -- Only add test payments if we have a user and less than 10 paid payments
  IF test_user_id IS NOT NULL AND payment_count < 10 THEN
    INSERT INTO public.payments (
      user_id,
      amount,
      status,
      created_at,
      updated_at
    )
    SELECT 
      test_user_id,
      100.00 + (ROW_NUMBER() OVER () * 15.75),
      'paid',
      NOW() - (ROW_NUMBER() OVER () * INTERVAL '5 days'),
      NOW() - (ROW_NUMBER() OVER () * INTERVAL '5 days')
    FROM generate_series(1, 5)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Added 5 test paid payments';
  END IF;
END $$;

-- Show summary of data
SELECT 
  'Summary' as info,
  (SELECT COUNT(*) FROM public.customer_invoices WHERE status = 'paid') as paid_invoices,
  (SELECT COALESCE(SUM(amount), 0) FROM public.customer_invoices WHERE status = 'paid') as total_invoice_revenue,
  (SELECT COUNT(*) FROM public.payments WHERE status = 'paid') as completed_payments,
  (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'paid') as total_payment_revenue,
  (SELECT COUNT(*) FROM public.profiles) as total_users,
  (SELECT COUNT(*) FROM public.leads) as total_leads,
  (SELECT COUNT(*) FROM public.leads WHERE status = 'new') as pending_leads;

