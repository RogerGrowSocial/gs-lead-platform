-- Verwijder de facturen van Van Mossel die we net hebben toegevoegd
-- Van Mossel Automotive Group B.V. — customer_id 8aed7087-658c-47cc-a55f-a2cac0f070f5

BEGIN;

DELETE FROM public.customer_invoices
WHERE customer_id = '8aed7087-658c-47cc-a55f-a2cac0f070f5'::uuid
  AND invoice_number IN ('52', '51', '52-20200706', '52-20200828', '51-20200325', '51-20200414');

COMMIT;
