-- =====================================================
-- INSERT DAKMEESTER NEDERLAND FACTUREN
-- =====================================================
-- Deze facturen zijn niet geïmporteerd omdat de klantnaam niet matchte
-- Voeg ze nu handmatig toe
-- =====================================================

BEGIN;

INSERT INTO public.customer_invoices (
  customer_id,
  invoice_number,
  invoice_date,
  due_date,
  order_number,
  amount,
  outstanding_amount,
  status,
  external_id,
  external_system,
  notes,
  line_items,
  created_at,
  updated_at
)
VALUES
-- GS-0466
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,  -- Dakmeester Nederland
  'GS-0466',
  '2023-08-26'::date,
  '2023-08-26'::date,
  'ORD-20230826',
  1439.90,
  0,
  'paid',
  'GS-0466',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
),
-- GS-0473
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,
  'GS-0473',
  '2023-10-27'::date,
  '2023-10-27'::date,
  'ORD-20231027',
  1439.90,
  0,
  'paid',
  'GS-0473',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
),
-- GS-0480
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,
  'GS-0480',
  '2023-11-24'::date,
  '2023-11-24'::date,
  'ORD-20231124',
  1439.90,
  0,
  'paid',
  'GS-0480',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
),
-- GS-0487
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,
  'GS-0487',
  '2023-12-21'::date,
  '2023-12-21'::date,
  'ORD-20231221',
  1439.90,
  0,
  'paid',
  'GS-0487',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
),
-- GS-0497
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,
  'GS-0497',
  '2024-01-29'::date,
  '2024-01-29'::date,
  'ORD-20240129',
  1439.90,
  0,
  'paid',
  'GS-0497',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
),
-- GS-0504
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,
  'GS-0504',
  '2024-02-25'::date,
  '2024-02-25'::date,
  'ORD-20240225',
  1439.90,
  0,
  'paid',
  'GS-0504',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
),
-- GS-0512
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,
  'GS-0512',
  '2024-03-18'::date,
  '2024-03-18'::date,
  'ORD-20240318',
  1439.90,
  0,
  'paid',
  'GS-0512',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
),
-- GS-0531
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,
  'GS-0531',
  '2024-04-25'::date,
  '2024-05-25'::date,
  'ORD-20240425',
  1439.90,
  0,
  'paid',
  'GS-0531',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
),
-- GS-0545
(
  '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,
  'GS-0545',
  '2024-05-20'::date,
  '2024-06-03'::date,
  'ORD-20240520',
  1439.90,
  0,
  'paid',
  'GS-0545',
  'zoho_books',
  'Geïmporteerd uit Zoho Books',
  '[{"description": "Google ads + SEO plus", "quantity": 1, "unit_price": 1190.0, "has_vat": true, "subtotal": 1190.0, "vat_amount": 249.9, "total": 1439.9}]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (customer_id, invoice_number)
DO UPDATE SET
  invoice_date = EXCLUDED.invoice_date,
  due_date = EXCLUDED.due_date,
  order_number = EXCLUDED.order_number,
  amount = EXCLUDED.amount,
  outstanding_amount = EXCLUDED.outstanding_amount,
  status = EXCLUDED.status,
  line_items = EXCLUDED.line_items,
  updated_at = NOW();

-- Verificatie
SELECT 
  c.name,
  COUNT(ci.id) as invoice_count,
  COALESCE(SUM(ci.amount), 0) as total_revenue
FROM public.customers c
LEFT JOIN public.customer_invoices ci ON c.id = ci.customer_id
WHERE c.id = '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid
GROUP BY c.id, c.name;

COMMIT;
