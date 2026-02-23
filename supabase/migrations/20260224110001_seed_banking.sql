-- Seed banking: one bank account + 30 fake transactions for testing AI Bankier
-- Run after 20260224110000_banking_module.sql

INSERT INTO public.bank_accounts (id, name, iban, currency)
SELECT gen_random_uuid(), 'Zakelijke rekening', 'NL42RABO0357384644', 'EUR'
WHERE NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE iban = 'NL42RABO0357384644')
LIMIT 1;

DO $$
DECLARE
  acc_id UUID;
  i INT;
  booked DATE;
  amount_cents INT;
  dir bank_transaction_direction;
  ref_hash TEXT;
BEGIN
  SELECT id INTO acc_id FROM public.bank_accounts WHERE iban = 'NL42RABO0357384644' LIMIT 1;
  IF acc_id IS NULL THEN RETURN; END IF;

  FOR i IN 1..30 LOOP
    booked := (CURRENT_DATE - (i * 3 + (i % 5))::INT);
    amount_cents := (500 + (i * 47) % 5000) * 100;
    IF i % 3 = 0 THEN
      dir := 'out';
      amount_cents := (100 + (i * 31) % 2000) * 100;
    ELSE
      dir := 'in';
    END IF;
    ref_hash := encode(sha256(('seed-' || acc_id::TEXT || booked::TEXT || amount_cents::TEXT || i::TEXT)::BYTEA), 'hex');
    INSERT INTO public.bank_transactions (
      bank_account_id, booked_at, amount_cents, currency, direction,
      counterparty_name, counterparty_iban, description, remittance_info, reference_hash, status
    ) VALUES (
      acc_id,
      (booked || ' 12:00:00')::TIMESTAMPTZ,
      amount_cents,
      'EUR',
      dir,
      CASE i % 5 WHEN 0 THEN 'Mollie B.V.' WHEN 1 THEN 'Klant ABC B.V.' WHEN 2 THEN 'Stripe' WHEN 3 THEN 'Interne overboeking' ELSE 'Diverse debiteur' END,
      CASE WHEN i % 5 = 4 THEN 'NL91ABNA0417164300' ELSE NULL END,
      'Omschrijving transactie ' || i || ' Ref GS-2026-' || LPAD((i % 20)::TEXT, 3, '0'),
      'GS-2026-' || LPAD((i % 20)::TEXT, 3, '0'),
      ref_hash,
      'new'
    )
    ON CONFLICT (bank_account_id, reference_hash) DO NOTHING;
  END LOOP;
END $$;
