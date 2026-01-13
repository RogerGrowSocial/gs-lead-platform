-- =====================================================
-- CUSTOMER MERGE + INVOICE RECONCILIATION (SUPABASE)
-- =====================================================
-- Purpose:
-- - Diagnose why a customer can show €0 revenue while invoices exist (usually duplicate customers)
-- - Safely merge a duplicate customer into a canonical customer by moving all foreign keys
-- - Provide optional hardening indexes to prevent future duplicates
--
-- How to use:
-- 1) Run the diagnostic queries to find duplicate customer rows + where invoices are attached
-- 2) Decide canonical customer_id (keep) + duplicate customer_id (merge-from)
-- 3) Run SELECT public.merge_customers('<from_uuid>', '<into_uuid>', true);
--
-- Notes:
-- - This script is idempotent (CREATE OR REPLACE / IF NOT EXISTS) where possible.
-- - It only touches tables that (in this repo) reference public.customers(id):
--   public.customer_invoices, public.mail_inbox, public.email_customer_mappings,
--   public.service_sales, public.service_line_items, public.tickets, public.contacts,
--   public.calendar_events
-- =====================================================

-- =====================================================
-- 0) QUICK DIAGNOSTICS
-- =====================================================

-- A) Find customer rows by name and see invoice totals per row.
--    Example: replace 'Dakmeester Nederland' with your search term.
SELECT
  c.id,
  c.name,
  c.company_name,
  c.domain,
  c.website,
  c.email,
  COUNT(i.*) FILTER (WHERE i.status = 'paid') AS paid_invoice_count,
  COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) AS paid_revenue,
  COUNT(i.*) AS invoice_count,
  COALESCE(SUM(i.amount), 0) AS invoice_amount_total
FROM public.customers c
LEFT JOIN public.customer_invoices i
  ON i.customer_id = c.id
WHERE
  c.company_name ILIKE '%Dakmeester%'
  OR c.name ILIKE '%Dakmeester%'
GROUP BY c.id
ORDER BY paid_revenue DESC, invoice_amount_total DESC, c.updated_at DESC NULLS LAST;

-- B) Find duplicate customers by domain (strong signal).
SELECT
  lower(c.domain) AS domain_norm,
  COUNT(*) AS customer_rows,
  array_agg(c.id ORDER BY c.created_at) AS customer_ids,
  array_agg(COALESCE(c.company_name, c.name) ORDER BY c.created_at) AS names
FROM public.customers c
WHERE c.domain IS NOT NULL AND btrim(c.domain) <> ''
GROUP BY lower(c.domain)
HAVING COUNT(*) > 1
ORDER BY customer_rows DESC, domain_norm;

-- C) Find duplicate invoices by invoice_number across different customers.
--    (Your unique index is on (customer_id, invoice_number), so this can happen.)
SELECT
  i.invoice_number,
  COUNT(*) AS rows,
  COUNT(DISTINCT i.customer_id) AS distinct_customers,
  array_agg(DISTINCT i.customer_id) AS customer_ids,
  array_agg(DISTINCT COALESCE(c.company_name, c.name)) AS customer_names
FROM public.customer_invoices i
LEFT JOIN public.customers c ON c.id = i.customer_id
GROUP BY i.invoice_number
HAVING COUNT(DISTINCT i.customer_id) > 1
ORDER BY distinct_customers DESC, rows DESC, i.invoice_number;

-- D) Compare 2 customer IDs (useful to decide which to keep before merging)
-- Replace the UUIDs with a pair from your duplicate list.
-- Example:
--  - Steck:   6a6baa8a-b42e-48b8-92ee-84896503f247  vs  ba9b4985-995d-4c7b-a454-7754ca962d15
--  - Kluytmans: 3cf95c6f-9be0-4b8a-bef5-d6f2f146e2f6 vs e7d18629-117f-4167-99a1-c5e99dc53aa6
WITH ids AS (
  SELECT unnest(ARRAY[
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  ]) AS id
)
SELECT
  c.id,
  COALESCE(c.company_name, c.name) AS display_name,
  c.domain,
  c.website,
  c.email,
  c.created_at,
  c.updated_at,
  (SELECT COUNT(*) FROM public.customer_invoices i WHERE i.customer_id = c.id) AS invoices,
  (SELECT COUNT(*) FROM public.customer_invoices i WHERE i.customer_id = c.id AND i.status = 'paid') AS paid_invoices,
  (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = c.id) AS paid_revenue,
  (SELECT COUNT(*) FROM public.tickets t WHERE t.customer_id = c.id) AS tickets,
  (SELECT COUNT(*) FROM public.contacts ct WHERE ct.customer_id = c.id) AS contacts,
  (SELECT COUNT(*) FROM public.mail_inbox m WHERE m.customer_id = c.id) AS mails
FROM public.customers c
JOIN ids ON ids.id = c.id
ORDER BY paid_revenue DESC, invoices DESC, updated_at DESC NULLS LAST;

-- E) AUTO-DETECT duplicate customer pairs from invoice conflicts + recommend which to keep
-- This finds all customer pairs that share invoice_numbers and shows which one to keep.
WITH duplicate_invoices AS (
  SELECT
    i.invoice_number,
    array_agg(DISTINCT i.customer_id ORDER BY i.customer_id) AS customer_ids
  FROM public.customer_invoices i
  GROUP BY i.invoice_number
  HAVING COUNT(DISTINCT i.customer_id) > 1
),
all_pairs AS (
  SELECT DISTINCT
    LEAST(c1.customer_id, c2.customer_id) AS id1,
    GREATEST(c1.customer_id, c2.customer_id) AS id2,
    di.invoice_number
  FROM duplicate_invoices di
  CROSS JOIN LATERAL unnest(di.customer_ids) AS c1(customer_id)
  CROSS JOIN LATERAL unnest(di.customer_ids) AS c2(customer_id)
  WHERE c1.customer_id < c2.customer_id
),
customer_pairs AS (
  SELECT
    id1,
    id2,
    COUNT(*) AS shared_invoice_count
  FROM all_pairs
  GROUP BY id1, id2
  HAVING COUNT(*) >= 2  -- At least 2 shared invoices
)
SELECT
  cp.id1,
  c1.company_name AS name1,
  cp.id2,
  c2.company_name AS name2,
  (SELECT COUNT(*) FROM public.customer_invoices i WHERE i.customer_id = cp.id1) AS invoices1,
  (SELECT COUNT(*) FROM public.customer_invoices i WHERE i.customer_id = cp.id2) AS invoices2,
  (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id1) AS revenue1,
  (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id2) AS revenue2,
  CASE
    WHEN (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id1) >
         (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id2)
    THEN cp.id1
    WHEN (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id2) >
         (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id1)
    THEN cp.id2
    ELSE cp.id1  -- Default to first if equal
  END AS recommended_keep_id,
  CASE
    WHEN (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id1) >
         (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id2)
    THEN cp.id2
    WHEN (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id2) >
         (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id1)
    THEN cp.id1
    ELSE cp.id2  -- Default to second if equal
  END AS recommended_merge_from_id
FROM customer_pairs cp
LEFT JOIN public.customers c1 ON c1.id = cp.id1
LEFT JOIN public.customers c2 ON c2.id = cp.id2
ORDER BY 
  (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id1) +
  (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id2) DESC;

-- F) READY-TO-RUN MERGE COMMANDS (based on query E results above)
-- Copy and run these one by one, or uncomment the batch script below.
--
-- 1) Merge Koos Kluytmans into Kluytmans Beheer B.V.
-- SELECT public.merge_customers(
--   'e7d18629-117f-4167-99a1-c5e99dc53aa6'::uuid,  -- Koos Kluytmans (merge from)
--   '3cf95c6f-9be0-4b8a-bef5-d6f2f146e2f6'::uuid,  -- Kluytmans Beheer B.V. (keep)
--   true  -- Delete the merged customer
-- );
--
-- 2) Merge Koos Kluytmans Interieurs B.V. into Kluytmans Beheer B.V.
-- SELECT public.merge_customers(
--   '2ee8936c-9404-4052-b6c3-8a7aff365cba'::uuid,  -- Koos Kluytmans Interieurs B.V. (merge from)
--   '3cf95c6f-9be0-4b8a-bef5-d6f2f146e2f6'::uuid,  -- Kluytmans Beheer B.V. (keep)
--   true  -- Delete the merged customer
-- );
--
-- 3) Merge Steck013 into Steck 013
-- SELECT public.merge_customers(
--   'ba9b4985-995d-4c7b-a454-7754ca962d15'::uuid,  -- Steck013 (merge from)
--   '6a6baa8a-b42e-48b8-92ee-84896503f247'::uuid,  -- Steck 013 (keep)
--   true  -- Delete the merged customer
-- );

-- =====================================================
-- 1) SAFE CUSTOMER MERGE (moves all foreign keys)
-- =====================================================

CREATE OR REPLACE FUNCTION public.merge_customers(
  p_from_customer_id UUID,
  p_into_customer_id UUID,
  p_delete_from BOOLEAN DEFAULT true
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_from_customer_id IS NULL OR p_into_customer_id IS NULL THEN
    RAISE EXCEPTION 'merge_customers: both customer ids are required';
  END IF;

  IF p_from_customer_id = p_into_customer_id THEN
    RAISE EXCEPTION 'merge_customers: from and into cannot be the same id';
  END IF;

  -- Ensure both customers exist
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_from_customer_id) THEN
    RAISE EXCEPTION 'merge_customers: from customer % not found', p_from_customer_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_into_customer_id) THEN
    RAISE EXCEPTION 'merge_customers: into customer % not found', p_into_customer_id;
  END IF;

  -- 1) Invoices
  -- IMPORTANT: you can have the same invoice_number on multiple customers because the unique index
  -- is (customer_id, invoice_number). When merging customers, moving invoices can violate that unique index.
  --
  -- Strategy:
  -- - For any invoice_number that exists on BOTH customers, keep exactly ONE "best" row and delete the other.
  -- - Then move remaining invoices from FROM -> INTO.
  --
  -- "Best" is decided by score:
  --   prefer zoho_books > paid > outstanding=0 > has line_items > has external_id > most recently updated.
  WITH candidates AS (
    SELECT
      i.id,
      i.customer_id,
      i.invoice_number,
      (
        CASE WHEN i.external_system = 'zoho_books' THEN 1000 ELSE 0 END
        + CASE WHEN i.status = 'paid' THEN 100 ELSE 0 END
        + CASE WHEN COALESCE(i.outstanding_amount, 0) = 0 THEN 50 ELSE 0 END
        + CASE
            WHEN i.line_items IS NOT NULL
              AND jsonb_typeof(i.line_items) = 'array'
              AND jsonb_array_length(i.line_items) > 0
            THEN 10 ELSE 0
          END
        + CASE WHEN i.external_id IS NOT NULL AND btrim(i.external_id) <> '' THEN 5 ELSE 0 END
        + CASE WHEN i.order_number IS NOT NULL AND btrim(i.order_number) <> '' THEN 1 ELSE 0 END
      ) AS score,
      COALESCE(i.updated_at, i.created_at) AS ts
    FROM public.customer_invoices i
    WHERE i.customer_id IN (p_from_customer_id, p_into_customer_id)
  ),
  winners AS (
    SELECT DISTINCT ON (invoice_number)
      invoice_number,
      id AS keep_id
    FROM candidates
    ORDER BY invoice_number, score DESC, ts DESC, id
  ),
  losers AS (
    SELECT c.id
    FROM candidates c
    JOIN winners w USING (invoice_number)
    WHERE c.id <> w.keep_id
  )
  DELETE FROM public.customer_invoices
  WHERE id IN (SELECT id FROM losers);

  -- Now safe to move remaining invoices
  UPDATE public.customer_invoices
  SET customer_id = p_into_customer_id,
      updated_at = NOW()
  WHERE customer_id = p_from_customer_id;

  -- 2) Tickets
  UPDATE public.tickets
  SET customer_id = p_into_customer_id,
      updated_at = NOW()
  WHERE customer_id = p_from_customer_id;

  -- 3) Contacts
  UPDATE public.contacts
  SET customer_id = p_into_customer_id,
      updated_at = NOW()
  WHERE customer_id = p_from_customer_id;

  -- 4) Calendar events
  UPDATE public.calendar_events
  SET customer_id = p_into_customer_id,
      updated_at = NOW()
  WHERE customer_id = p_from_customer_id;

  -- 5) Mail inbox (explicit + auto-linked)
  UPDATE public.mail_inbox
  SET customer_id = p_into_customer_id,
      updated_at = NOW()
  WHERE customer_id = p_from_customer_id;

  UPDATE public.mail_inbox
  SET auto_linked_customer_id = p_into_customer_id,
      updated_at = NOW()
  WHERE auto_linked_customer_id = p_from_customer_id;

  -- 6) Email customer mappings
  -- Move mappings without violating the UNIQUE(mapping_type, email_or_domain, customer_id) constraint
  INSERT INTO public.email_customer_mappings (
    mapping_type,
    email_or_domain,
    customer_id,
    confirmed,
    confirmed_by,
    confirmed_at,
    notes,
    created_at,
    updated_at
  )
  SELECT
    e.mapping_type,
    e.email_or_domain,
    p_into_customer_id,
    e.confirmed,
    e.confirmed_by,
    e.confirmed_at,
    e.notes,
    e.created_at,
    NOW()
  FROM public.email_customer_mappings e
  WHERE e.customer_id = p_from_customer_id
  ON CONFLICT (mapping_type, email_or_domain, customer_id) DO NOTHING;

  DELETE FROM public.email_customer_mappings
  WHERE customer_id = p_from_customer_id;

  -- 7) Services analytics tables
  UPDATE public.service_sales
  SET customer_id = p_into_customer_id
  WHERE customer_id = p_from_customer_id;

  UPDATE public.service_line_items
  SET customer_id = p_into_customer_id
  WHERE customer_id = p_from_customer_id;

  -- Finally delete the old customer row (optional)
  IF p_delete_from THEN
    DELETE FROM public.customers
    WHERE id = p_from_customer_id;
  END IF;
END;
$$;

-- =====================================================
-- 2) BATCH MERGE HELPER (merge all recommended pairs at once)
-- =====================================================
-- WARNING: Review query E output first! This will merge ALL detected duplicate pairs.
-- Run this ONLY after you've verified the recommendations are correct.
--
-- Uncomment and run this to merge all duplicate pairs automatically:
--
-- DO $$
-- DECLARE
--   rec RECORD;
-- BEGIN
--   FOR rec IN
--     WITH duplicate_invoices AS (
--       SELECT
--         i.invoice_number,
--         array_agg(DISTINCT i.customer_id ORDER BY i.customer_id) AS customer_ids
--       FROM public.customer_invoices i
--       GROUP BY i.invoice_number
--       HAVING COUNT(DISTINCT i.customer_id) > 1
--     ),
--     all_pairs AS (
--       SELECT DISTINCT
--         LEAST(c1.customer_id, c2.customer_id) AS id1,
--         GREATEST(c1.customer_id, c2.customer_id) AS id2,
--         di.invoice_number
--       FROM duplicate_invoices di
--       CROSS JOIN LATERAL unnest(di.customer_ids) AS c1(customer_id)
--       CROSS JOIN LATERAL unnest(di.customer_ids) AS c2(customer_id)
--       WHERE c1.customer_id < c2.customer_id
--     ),
--     customer_pairs AS (
--       SELECT
--         id1,
--         id2,
--         COUNT(*) AS shared_invoice_count
--       FROM all_pairs
--       GROUP BY id1, id2
--       HAVING COUNT(*) >= 2
--     )
--     SELECT
--       CASE
--         WHEN (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id1) >=
--              (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id2)
--         THEN cp.id1
--         ELSE cp.id2
--       END AS keep_id,
--       CASE
--         WHEN (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id1) >=
--              (SELECT COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) FROM public.customer_invoices i WHERE i.customer_id = cp.id2)
--         THEN cp.id2
--         ELSE cp.id1
--       END AS merge_from_id
--     FROM customer_pairs cp
--   LOOP
--     BEGIN
--       PERFORM public.merge_customers(rec.merge_from_id, rec.keep_id, true);
--       RAISE NOTICE 'Merged customer % into %', rec.merge_from_id, rec.keep_id;
--     EXCEPTION WHEN OTHERS THEN
--       RAISE WARNING 'Failed to merge % into %: %', rec.merge_from_id, rec.keep_id, SQLERRM;
--     END;
--   END LOOP;
-- END $$;

-- =====================================================
-- 3) OPTIONAL HARDENING (run after cleanup)
-- =====================================================
-- Prevent the same external invoice being attached twice (even to different customers).
-- Only enable if this doesn't currently fail due to existing duplicates.
--
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_invoices_external_system_id
--   ON public.customer_invoices (external_system, external_id)
--   WHERE external_system IS NOT NULL AND external_id IS NOT NULL;

