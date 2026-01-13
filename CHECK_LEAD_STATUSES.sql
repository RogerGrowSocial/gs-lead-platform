-- SQL Query om lead statuses te bekijken
-- Voer dit uit in je Supabase SQL Editor

-- 1. Bekijk de huidige constraint op leads.status
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'leads'::regclass
    AND conname LIKE '%status%';

-- 2. Bekijk alle unieke status waarden die gebruikt worden
SELECT DISTINCT status, COUNT(*) as count
FROM leads
GROUP BY status
ORDER BY count DESC;

-- 3. Bekijk de tabel structuur voor leads
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'leads'
    AND column_name = 'status';

-- 4. Als je custom statuses wilt toevoegen, kun je de constraint aanpassen:
-- Eerst de oude constraint verwijderen (als die bestaat):
-- ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
-- ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check_extended;

-- Dan een nieuwe constraint toevoegen die custom statuses toestaat:
-- ALTER TABLE leads ADD CONSTRAINT leads_status_check_extended 
--   CHECK (status ~ '^[a-z0-9_]+$'); -- Alleen lowercase letters, numbers en underscores

-- OF behoud de bestaande statuses en voeg custom statuses toe via een aparte kolom:
-- ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_status TEXT;

