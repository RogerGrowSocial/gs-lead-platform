-- =====================================================
-- IMPORT INVOICES FROM ZOHO BOOKS CSV EXPORT
-- =====================================================
-- Deze query importeert facturen uit een Zoho Books CSV export
-- 
-- STAP 1: Upload de CSV naar Supabase Storage of gebruik een temp table
-- STAP 2: Pas deze query aan met je CSV data
-- 
-- Let op: Deze query gebruikt een temp table om de CSV data te laden
-- Je moet eerst de CSV data in een temp table laden via Supabase Dashboard
-- of gebruik de Python/Node script om de CSV te converteren naar SQL VALUES
-- =====================================================

BEGIN;

-- Maak temp table voor CSV data
CREATE TEMP TABLE IF NOT EXISTS csv_invoices_temp (
  invoice_date DATE,
  invoice_id VARCHAR(255),
  invoice_number VARCHAR(255),
  invoice_status VARCHAR(50),
  customer_id_zoho VARCHAR(255),
  customer_name VARCHAR(255),
  due_date DATE,
  subtotal NUMERIC(10,2),
  total NUMERIC(10,2),
  balance NUMERIC(10,2),
  item_name TEXT,
  item_desc TEXT,
  quantity NUMERIC(10,2),
  item_total NUMERIC(10,2),
  item_price NUMERIC(10,2),
  item_tax_percent NUMERIC(5,2),
  item_tax_amount NUMERIC(10,2),
  notes TEXT
);

-- =====================================================
-- STAP 2: LAAD JE CSV DATA HIER
-- =====================================================
-- Optie A: Via Supabase Dashboard -> Table Editor -> Import CSV
--   1. Ga naar Supabase Dashboard
--   2. Table Editor -> Create new table "csv_invoices_temp"
--   3. Import CSV file
--   4. Pas de kolomnamen aan naar bovenstaande structuur
--
-- Optie B: Gebruik het Python script: convert_csv_to_sql.py
--   Dit script converteert de CSV naar SQL INSERT statements
--   Kopieer de output hieronder in plaats van deze comment
-- =====================================================

-- Voorbeeld: INSERT statements (vervang door je eigen data)
-- INSERT INTO csv_invoices_temp VALUES (...);

-- =====================================================
-- STAP 3: GROEPEER DATA PER FACTUUR EN MAAK LINE ITEMS
-- =====================================================

WITH invoice_summary AS (
  SELECT DISTINCT
    invoice_number,
    invoice_date,
    due_date,
    customer_name,
    subtotal,
    total,
    balance,
    invoice_status,
    notes
  FROM csv_invoices_temp
  WHERE invoice_number IS NOT NULL
),
invoice_line_items AS (
  SELECT
    invoice_number,
    invoice_date,
    jsonb_agg(
      jsonb_build_object(
        'description', COALESCE(NULLIF(item_desc, ''), item_name, 'Dienstverlening'),
        'quantity', COALESCE(quantity, 1),
        'unit_price', COALESCE(item_price, item_total / NULLIF(quantity, 0), 0),
        'has_vat', COALESCE(item_tax_percent, 0) > 0,
        'subtotal', COALESCE(item_total, 0),
        'vat_amount', COALESCE(item_tax_amount, item_total * 0.21, 0),
        'total', COALESCE(item_total + COALESCE(item_tax_amount, item_total * 0.21), item_total, 0)
      ) ORDER BY item_name, item_desc
    ) FILTER (WHERE item_name IS NOT NULL OR item_desc IS NOT NULL) AS line_items
  FROM csv_invoices_temp
  WHERE invoice_number IS NOT NULL
  GROUP BY invoice_number, invoice_date
),
invoice_data AS (
  SELECT
    s.invoice_number,
    s.invoice_date,
    COALESCE(s.due_date, s.invoice_date + INTERVAL '14 days') AS due_date,
    s.customer_name,
    s.subtotal,
    s.total AS amount,
    COALESCE(s.balance, 0) AS outstanding_amount,
    CASE 
      WHEN s.invoice_status = 'Closed' THEN 'paid'
      WHEN s.balance = 0 OR s.balance IS NULL THEN 'paid'
      WHEN s.balance < s.total THEN 'pending'
      ELSE 'pending'
    END AS status,
    COALESCE(s.notes, 'Geïmporteerd uit Zoho Books') AS notes,
    COALESCE(li.line_items, '[]'::jsonb) AS line_items,
    'ORD-' || TO_CHAR(s.invoice_date, 'YYYYMMDD') AS order_number
  FROM invoice_summary s
  LEFT JOIN invoice_line_items li 
    ON s.invoice_number = li.invoice_number 
    AND s.invoice_date = li.invoice_date
),
customer_mapping AS (
  SELECT DISTINCT
    id.customer_name,
    c.id AS customer_id
  FROM invoice_data id
  LEFT JOIN public.customers c 
    ON c.company_name ILIKE '%' || id.customer_name || '%'
    OR c.name ILIKE '%' || id.customer_name || '%'
  WHERE c.id IS NOT NULL
),
final_data AS (
  SELECT
    COALESCE(cm.customer_id, 
      (SELECT id FROM public.customers 
       WHERE company_name ILIKE '%' || id.customer_name || '%' 
       OR name ILIKE '%' || id.customer_name || '%' 
       LIMIT 1)
    ) AS customer_id,
    id.invoice_number,
    id.invoice_date,
    id.due_date,
    id.order_number,
    id.amount,
    id.outstanding_amount,
    id.status,
    id.notes,
    id.line_items,
    id.invoice_number AS external_id,
    'zoho_books' AS external_system
  FROM invoice_data id
  LEFT JOIN customer_mapping cm ON id.customer_name = cm.customer_name
  WHERE COALESCE(cm.customer_id, 
    (SELECT id FROM public.customers 
     WHERE company_name ILIKE '%' || id.customer_name || '%' 
     OR name ILIKE '%' || id.customer_name || '%' 
     LIMIT 1)
  ) IS NOT NULL
),
updated AS (
  UPDATE public.customer_invoices ci
  SET
    invoice_date = fd.invoice_date,
    due_date = fd.due_date,
    order_number = fd.order_number,
    amount = fd.amount,
    outstanding_amount = fd.outstanding_amount,
    status = fd.status,
    external_id = fd.external_id,
    external_system = fd.external_system,
    notes = fd.notes,
    line_items = fd.line_items,
    updated_at = NOW()
  FROM final_data fd
  WHERE ci.customer_id = fd.customer_id
    AND ci.invoice_number = fd.invoice_number
  RETURNING ci.id, ci.customer_id, ci.invoice_number
)
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
SELECT
  fd.customer_id,
  fd.invoice_number,
  fd.invoice_date,
  fd.due_date,
  fd.order_number,
  fd.amount,
  fd.outstanding_amount,
  fd.status,
  fd.external_id,
  fd.external_system,
  fd.notes,
  fd.line_items,
  NOW(),
  NOW()
FROM final_data fd
WHERE NOT EXISTS (
  SELECT 1
  FROM updated u
  WHERE u.customer_id = fd.customer_id
    AND u.invoice_number = fd.invoice_number
);

-- Cleanup
DROP TABLE IF EXISTS csv_invoices_temp;

COMMIT;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- SELECT 
--   COUNT(*) as total_imported,
--   COUNT(DISTINCT customer_id) as unique_customers,
--   SUM(amount) as total_amount
-- FROM public.customer_invoices
-- WHERE external_system = 'zoho_books'
--   AND created_at >= NOW() - INTERVAL '1 minute';
