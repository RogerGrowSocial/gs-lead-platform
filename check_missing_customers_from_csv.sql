-- =====================================================
-- CHECK WHICH CUSTOMERS FROM CSV ARE MISSING IN DATABASE
-- =====================================================
-- Deze query laat zien welke klanten uit de CSV niet gevonden worden
-- in de customers tabel, zodat je ze handmatig kunt toevoegen
-- =====================================================

WITH csv_customers AS (
  SELECT DISTINCT
    'Steck013' AS customer_name UNION ALL
  SELECT 'Dakmeester Nederland' UNION ALL
  SELECT 'Jouwgeboortewijn' UNION ALL
  SELECT 'Dakpreventie van der Steen' UNION ALL
  SELECT 'Lammy Yarns B.V.' UNION ALL
  SELECT 'Amsterdam Design' UNION ALL
  SELECT 'The Workspot' UNION ALL
  SELECT 'Dakbeheer Acuut' UNION ALL
  SELECT 'DTiG Beheer' UNION ALL
  SELECT 'EGD Dakwerken' UNION ALL
  SELECT 'Intest' UNION ALL
  SELECT 'Nightcode Events' UNION ALL
  SELECT 'Van Mossel' UNION ALL
  SELECT 'Excali' UNION ALL
  SELECT 'SVO Totaal Onderhoud' UNION ALL
  SELECT '365 Dagen Duurzaam' UNION ALL
  SELECT 'AddSolar' UNION ALL
  SELECT 'Koos Kluytmans' UNION ALL
  SELECT 'Gruter Duurzaam' UNION ALL
  SELECT 'Coolwijk Onderhoud' UNION ALL
  SELECT 'Timeless Fits' UNION ALL
  SELECT 'VD Broek Dakonderhoud' UNION ALL
  SELECT 'VA Dakwerken' UNION ALL
  SELECT 'Lommers Installatiebedrijf B.V.' UNION ALL
  SELECT 'Like It Harder Bookings' UNION ALL
  SELECT 'Hard Music' UNION ALL
  SELECT 'B&G Onderhoud' UNION ALL
  SELECT 'Probouws B.V.' UNION ALL
  SELECT 'Bart beveiliging / Bart Huismeesters' UNION ALL
  SELECT 'J Hoenderdos' UNION ALL
  SELECT 'JVS dienstverlening' UNION ALL
  SELECT 'Trusted Future' UNION ALL
  SELECT 'Hard Dance Store' UNION ALL
  SELECT 'Ethereal Design' UNION ALL
  SELECT 'Spica Lifestyle' UNION ALL
  SELECT 'Westrik Installaties' UNION ALL
  SELECT 'Stukadoorsbedrijf Rick Verstappen' UNION ALL
  SELECT 'Stukadoorsbedrijf Freek Mulder' UNION ALL
  SELECT 'Irma Wolf' UNION ALL
  SELECT 'YT Installatietechniek' UNION ALL
  SELECT 'Klussenbedrijf MZ' UNION ALL
  SELECT 'OptiKlimaat' UNION ALL
  SELECT 'Estremo Haarstudio' UNION ALL
  SELECT 'Petra Martinot' UNION ALL
  SELECT 'Edelweiss'
)
SELECT 
  cc.customer_name,
  CASE 
    WHEN c.id IS NULL THEN '❌ NIET GEVONDEN'
    ELSE '✅ GEVONDEN'
  END AS status,
  c.id AS customer_id,
  c.name AS db_name,
  c.company_name AS db_company_name
FROM csv_customers cc
LEFT JOIN public.customers c 
  ON c.company_name ILIKE '%' || cc.customer_name || '%'
  OR c.name ILIKE '%' || cc.customer_name || '%'
ORDER BY 
  CASE WHEN c.id IS NULL THEN 0 ELSE 1 END,
  cc.customer_name;

-- =====================================================
-- TOTAALBEDRAG PER KLANT (CSV)
-- =====================================================
-- Dit laat zien hoeveel er per klant in de CSV staat
-- zodat je kunt zien welke klanten het meeste geld missen
