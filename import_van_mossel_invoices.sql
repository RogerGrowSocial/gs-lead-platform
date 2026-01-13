-- Van Mossel Automotive Group B.V. — customer_id 8aed7087-658c-47cc-a55f-a2cac0f070f5
-- Upsert op (customer_id, invoice_number) - let op: invoice_date wordt NIET gebruikt voor matching
-- Status: alles PAID + outstanding_amount = 0
-- 
-- OPGELOST: Er waren facturen met hetzelfde nummer maar verschillende datums.
-- De query maakt nu unieke invoice_numbers door de datum toe te voegen (bijv. "52-20200706").
-- Dit zorgt ervoor dat alle facturen kunnen worden geïmporteerd.

BEGIN;

WITH raw_data AS (
  SELECT *
  FROM (
    VALUES
    ('8aed7087-658c-47cc-a55f-a2cac0f070f5'::uuid, '52', '2020-07-06'::date, '2020-07-26'::date, 'ORD-20200706', 907.50, 0.00, 'paid', NULL, NULL, 'Leadgeneratie Van Mossel Exclusieve Occasions via social media.', $$[{"description": "Ontwerpen + publiceren (promoten) Facebook, Instagram, Linkedin", "quantity": 16, "unit_price": 37.5, "has_vat": true, "subtotal": 400.0, "vat_amount": 84.0, "total": 484.0}, {"description": "Contact functie bij advertentie.", "quantity": 12, "unit_price": 0.0, "has_vat": true, "subtotal": 0.0, "vat_amount": 0.0, "total": 0.0}, {"description": "Instagram kopjes ontwerpen / make-over", "quantity": 1, "unit_price": 48.0, "has_vat": true, "subtotal": 48.0, "vat_amount": 10.08, "total": 58.08}, {"description": "Geanimeerde versie advertentie (ontwerpen + promoten)", "quantity": 4, "unit_price": 62.5, "has_vat": true, "subtotal": 151.0, "vat_amount": 31.71, "total": 182.71}, {"description": "Verhaal versie advertentie (ontwerpen + promoten)", "quantity": 12, "unit_price": 20.92, "has_vat": true, "subtotal": 151.0, "vat_amount": 31.71, "total": 182.71}]$$::jsonb),
    ('8aed7087-658c-47cc-a55f-a2cac0f070f5'::uuid, '52', '2020-08-28'::date, '2020-09-13'::date, 'ORD-20200828', 907.50, 0.00, 'paid', NULL, NULL, 'Leadgeneratie Van Mossel Exclusieve Occasions via social media.', $$[{"description": "Ontwerpen + publiceren (promoten) Facebook, Instagram, Linkedin", "quantity": 16, "unit_price": 37.5, "has_vat": true, "subtotal": 400.0, "vat_amount": 84.0, "total": 484.0}, {"description": "Contact functie bij advertentie.", "quantity": 12, "unit_price": 0.0, "has_vat": true, "subtotal": 0.0, "vat_amount": 0.0, "total": 0.0}, {"description": "Instagram kopjes ontwerpen / make-over", "quantity": 1, "unit_price": 48.0, "has_vat": true, "subtotal": 48.0, "vat_amount": 10.08, "total": 58.08}, {"description": "Geanimeerde versie advertentie (ontwerpen + promoten)", "quantity": 4, "unit_price": 62.5, "has_vat": true, "subtotal": 151.0, "vat_amount": 31.71, "total": 182.71}, {"description": "Verhaal versie advertentie (ontwerpen + promoten)", "quantity": 12, "unit_price": 20.92, "has_vat": true, "subtotal": 151.0, "vat_amount": 31.71, "total": 182.71}]$$::jsonb),
    ('8aed7087-658c-47cc-a55f-a2cac0f070f5'::uuid, '51', '2020-04-14'::date, '2020-05-01'::date, 'ORD-20200414', 1149.50, 0.00, 'paid', NULL, NULL, 'Leadgeneratie Van Mossel Exclusieve Occasions via social media.', $$[{"description": "Ontwerpen + publiceren (promoten) Facebook, Instagram, Linkedin", "quantity": 16, "unit_price": 37.5, "has_vat": true, "subtotal": 400.0, "vat_amount": 84.0, "total": 484.0}, {"description": "Contact functie bij advertentie.", "quantity": 12, "unit_price": 0.0, "has_vat": true, "subtotal": 0.0, "vat_amount": 0.0, "total": 0.0}, {"description": "Instagram kopjes ontwerpen / make-over", "quantity": 1, "unit_price": 48.0, "has_vat": true, "subtotal": 48.0, "vat_amount": 10.08, "total": 58.08}, {"description": "Geanimeerde versie advertentie (ontwerpen + promoten)", "quantity": 4, "unit_price": 62.5, "has_vat": true, "subtotal": 251.0, "vat_amount": 52.71, "total": 303.71}, {"description": "Verhaal versie advertentie (ontwerpen + promoten)", "quantity": 12, "unit_price": 20.92, "has_vat": true, "subtotal": 251.0, "vat_amount": 52.71, "total": 303.71}]$$::jsonb),
    ('8aed7087-658c-47cc-a55f-a2cac0f070f5'::uuid, '51', '2020-03-25'::date, '2020-03-26'::date, 'ORD-20200325', 3800.00, 0.00, 'paid', NULL, NULL, 'Pakket All-In', $$[{"description": "Ontwerpen + publiceren Facebook, Instagram, LinkedIn", "quantity": 16, "unit_price": 47.9, "has_vat": true, "subtotal": 766.0, "vat_amount": 203.62, "total": 969.62}, {"description": "Contact functie bij advertentie.", "quantity": 12, "unit_price": 0.0, "has_vat": true, "subtotal": 0.0, "vat_amount": 0.0, "total": 0.0}, {"description": "Geanimeerde versie advertentie", "quantity": 8, "unit_price": 61.75, "has_vat": true, "subtotal": 495.0, "vat_amount": 131.58, "total": 626.58}, {"description": "Verhaal versie advertentie", "quantity": 12, "unit_price": 20.5, "has_vat": true, "subtotal": 246.0, "vat_amount": 65.39, "total": 311.39}, {"description": "Budgetkosten advertenties", "quantity": 1, "unit_price": 600.0, "has_vat": true, "subtotal": 600.0, "vat_amount": 159.49, "total": 759.49}, {"description": "Arbeidskosten Werknemers", "quantity": 1, "unit_price": 895.0, "has_vat": true, "subtotal": 895.0, "vat_amount": 237.92, "total": 1132.92}]$$::jsonb)
  ) AS t(
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
    line_items
  )
),
-- Maak unieke invoice_numbers door datum toe te voegen voor facturen met duplicaat nummers
data AS (
  SELECT 
    customer_id,
    -- Als er meerdere facturen met hetzelfde nummer zijn, voeg de datum toe aan het nummer
    CASE 
      WHEN COUNT(*) OVER (PARTITION BY customer_id, invoice_number) > 1 
      THEN invoice_number || '-' || TO_CHAR(invoice_date, 'YYYYMMDD')
      ELSE invoice_number
    END AS invoice_number,
    invoice_date,
    due_date,
    order_number,
    amount,
    outstanding_amount,
    status,
    external_id,
    external_system,
    notes,
    line_items
  FROM raw_data
),
updated AS (
  UPDATE public.customer_invoices ci
  SET
    invoice_date       = d.invoice_date,
    due_date           = d.due_date,
    order_number       = d.order_number,
    amount             = d.amount,
    outstanding_amount = d.outstanding_amount,
    status             = d.status,
    external_id        = d.external_id,
    external_system    = d.external_system,
    notes              = d.notes,
    line_items         = d.line_items,
    updated_at         = NOW()
  FROM data d
  WHERE ci.customer_id    = d.customer_id
    AND ci.invoice_number = d.invoice_number
  RETURNING ci.customer_id, ci.invoice_number
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
  d.customer_id,
  d.invoice_number,
  d.invoice_date,
  d.due_date,
  d.order_number,
  d.amount,
  d.outstanding_amount,
  d.status,
  d.external_id,
  d.external_system,
  d.notes,
  d.line_items,
  NOW(),
  NOW()
FROM data d
WHERE NOT EXISTS (
  SELECT 1
  FROM updated u
  WHERE u.customer_id    = d.customer_id
    AND u.invoice_number = d.invoice_number
);

COMMIT;
