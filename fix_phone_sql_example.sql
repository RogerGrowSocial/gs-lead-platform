-- VOORBEELD: Correct gebruik van telefoonnummers in SQL queries
-- Telefoonnummers MOETEN altijd tussen quotes staan!

-- ✅ CORRECT: Telefoonnummer tussen quotes
INSERT INTO public.customers (name, phone, email)
VALUES ('Test Klant', '+31 618 54 97 85', 'test@example.com');

-- ✅ CORRECT: UPDATE met telefoonnummer tussen quotes
-- Gebruik een echte UUID uit je database, bijvoorbeeld:
-- UPDATE public.customers
-- SET phone = '+31 618 54 97 85'
-- WHERE id = '8aed7087-658c-47cc-a55f-a2cac0f070f5'::uuid;

-- ✅ ALTERNATIEF: UPDATE op basis van naam of email (geen UUID nodig)
UPDATE public.customers
SET phone = '+31 618 54 97 85'
WHERE email = 'test@example.com';

-- ✅ CORRECT: UPDATE meerdere klanten met hetzelfde telefoonnummer
-- UPDATE public.customers
-- SET phone = '+31 618 54 97 85'
-- WHERE name ILIKE '%test%';

-- ❌ FOUT: Telefoonnummer zonder quotes (dit geeft syntax error!)
-- INSERT INTO public.customers (name, phone) VALUES ('Test', +31 618 54 97 85);

-- ✅ CORRECT: SELECT met telefoonnummer in WHERE clause
SELECT * FROM public.customers
WHERE phone = '+31 618 54 97 85';

-- ✅ CORRECT: Zoek klant op basis van telefoonnummer (deel van nummer)
SELECT * FROM public.customers
WHERE phone LIKE '%618%';

-- ✅ HANDIG: Vind een klant UUID op basis van naam of email
SELECT id, name, email, phone
FROM public.customers
WHERE name ILIKE '%test%' OR email = 'test@example.com'
LIMIT 5;

-- ✅ CORRECT: LIKE query met telefoonnummer
SELECT * FROM public.customers
WHERE phone LIKE '%618%';

-- Check of er klanten zijn met telefoonnummers die problemen kunnen veroorzaken
-- (bijv. telefoonnummers die beginnen met + maar niet correct zijn gequote in queries)
SELECT 
  id,
  name,
  phone,
  email,
  CASE 
    WHEN phone IS NULL THEN 'Geen telefoonnummer'
    WHEN phone LIKE '+%' THEN 'Begint met + (OK)'
    WHEN phone LIKE '0%' THEN 'Begint met 0 (Nederlands formaat)'
    ELSE 'Ander formaat'
  END as phone_format
FROM public.customers
WHERE phone IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
