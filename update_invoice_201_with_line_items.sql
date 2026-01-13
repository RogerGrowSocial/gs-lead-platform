-- =====================================================
-- UPDATE INVOICE 201 WITH COMPLETE LINE ITEMS
-- =====================================================
-- Update factuur 201 (Rijschool Intest B.V.) met volledige line items
-- Factuurdatum: 11-03-2020
-- Vervaldatum: 17-03-2020
-- Totaal: €1.149,50 (incl. BTW 21%)
-- =====================================================

-- =====================================================
-- STAP 1: Controleren of de factuur bestaat
-- =====================================================
-- Run eerst deze query om te zien of de factuur al bestaat:
SELECT 
  id,
  invoice_number,
  customer_id,
  amount,
  status,
  line_items,
  jsonb_array_length(COALESCE(line_items, '[]'::jsonb)) as line_items_count
FROM public.customer_invoices
WHERE invoice_number = '201'
  AND customer_id = '3284e8b0-a2a0-4111-b2ab-5dacaf602a7f';

-- =====================================================
-- STAP 2A: UPDATE (als factuur al bestaat)
-- =====================================================
-- Update factuur 201 met volledige line items
UPDATE public.customer_invoices
SET
  -- Update factuur details
  invoice_date = '2020-03-11',
  due_date = '2020-03-17',
  order_number = 'ORD-20200311',
  amount = 1149.50,
  outstanding_amount = 0,
  status = 'paid',
  notes = 'Geïmporteerd uit e-boekhouden - Relatie: Rijschool Intest B.V.',
  
  -- Line items met BTW berekening
  -- Subtotaal (excl. BTW): €950,00 | BTW (21%): €199,50 | Totaal (incl. BTW): €1.149,50
  -- Note: De regeltotalen in de factuur zijn exclusief BTW
  line_items = '[
    {
      "description": "Ontwerpen + publiceren Facebook, Instagram",
      "quantity": 16,
      "unit_price": 25.00,
      "has_vat": true,
      "subtotal": 400.00,
      "vat_amount": 84.00,
      "total": 484.00
    },
    {
      "description": "Contact functie bij advertentie",
      "quantity": 12,
      "unit_price": 0.00,
      "has_vat": false,
      "subtotal": 0.00,
      "vat_amount": 0.00,
      "total": 0.00
    },
    {
      "description": "Instagram kopjes ontwerpen / make-over",
      "quantity": 1,
      "unit_price": 48.00,
      "has_vat": true,
      "subtotal": 48.00,
      "vat_amount": 10.08,
      "total": 58.08
    },
    {
      "description": "Geanimeerde versie advertentie",
      "quantity": 4,
      "unit_price": 62.75,
      "has_vat": true,
      "subtotal": 251.00,
      "vat_amount": 52.71,
      "total": 303.71
    },
    {
      "description": "Verhaal versie advertentie",
      "quantity": 12,
      "unit_price": 20.92,
      "has_vat": true,
      "subtotal": 251.04,
      "vat_amount": 52.72,
      "total": 303.76
    }
  ]'::jsonb,
  
  updated_at = NOW()
WHERE 
  invoice_number = '201'
  AND customer_id = '3284e8b0-a2a0-4111-b2ab-5dacaf602a7f';

-- =====================================================
-- STAP 2B: INSERT (als factuur nog niet bestaat)
-- =====================================================
-- Als de factuur nog niet bestaat, gebruik dan dit INSERT commando:
INSERT INTO public.customer_invoices (
  customer_id,
  invoice_number,
  invoice_date,
  due_date,
  order_number,
  amount,
  outstanding_amount,
  status,
  notes,
  line_items,
  external_id,
  external_system,
  created_by
)
SELECT 
  '3284e8b0-a2a0-4111-b2ab-5dacaf602a7f'::uuid,
  '201',
  '2020-03-11'::date,
  '2020-03-17'::date,
  'ORD-20200311',
  1149.50,
  0,
  'paid',
  'Geïmporteerd uit e-boekhouden - Relatie: Rijschool Intest B.V.',
  '[
    {
      "description": "Ontwerpen + publiceren Facebook, Instagram",
      "quantity": 16,
      "unit_price": 25.00,
      "has_vat": true,
      "subtotal": 400.00,
      "vat_amount": 84.00,
      "total": 484.00
    },
    {
      "description": "Contact functie bij advertentie",
      "quantity": 12,
      "unit_price": 0.00,
      "has_vat": false,
      "subtotal": 0.00,
      "vat_amount": 0.00,
      "total": 0.00
    },
    {
      "description": "Instagram kopjes ontwerpen / make-over",
      "quantity": 1,
      "unit_price": 48.00,
      "has_vat": true,
      "subtotal": 48.00,
      "vat_amount": 10.08,
      "total": 58.08
    },
    {
      "description": "Geanimeerde versie advertentie",
      "quantity": 4,
      "unit_price": 62.75,
      "has_vat": true,
      "subtotal": 251.00,
      "vat_amount": 52.71,
      "total": 303.71
    },
    {
      "description": "Verhaal versie advertentie",
      "quantity": 12,
      "unit_price": 20.92,
      "has_vat": true,
      "subtotal": 251.04,
      "vat_amount": 52.72,
      "total": 303.76
    }
  ]'::jsonb,
  '201',
  'eboekhouden',
  (SELECT id FROM public.profiles WHERE email = 'rogier@growsocialmedia.nl' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.customer_invoices 
  WHERE invoice_number = '201' 
    AND customer_id = '3284e8b0-a2a0-4111-b2ab-5dacaf602a7f'
);

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run deze query om te verifiëren dat de update is gelukt:
-- SELECT 
--   invoice_number,
--   invoice_date,
--   due_date,
--   order_number,
--   amount,
--   outstanding_amount,
--   status,
--   line_items,
--   jsonb_array_length(line_items) as line_items_count
-- FROM public.customer_invoices
-- WHERE invoice_number = '201';

