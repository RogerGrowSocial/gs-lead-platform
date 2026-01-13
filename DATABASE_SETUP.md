# 🚀 Database Setup Instructions

## Quick Setup voor Industries & Billing System

Om het nieuwe billing systeem volledig werkend te krijgen, voer je deze stappen uit in **Supabase Dashboard**:

### 1. Ga naar Supabase Dashboard
- Open je Supabase project
- Ga naar **SQL Editor**

### 2. Voer deze SQL uit:

```sql
-- Add missing columns to industries table
ALTER TABLE industries ADD COLUMN IF NOT EXISTS price_per_lead DECIMAL(10,2) DEFAULT 10.00;
ALTER TABLE industries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE industries ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create the industries pricing function
CREATE OR REPLACE FUNCTION public.get_industries_with_pricing()
RETURNS TABLE (
    id UUID,
    name TEXT,
    price_per_lead DECIMAL(10,2),
    description TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT i.id, i.name, 
           COALESCE(i.price_per_lead, 10.00) as price_per_lead,
           COALESCE(i.description, '') as description,
           COALESCE(i.is_active, true) as is_active,
           i.created_at
    FROM industries i
    ORDER BY i.name;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_industries_with_pricing() TO authenticated;

-- Update existing industries with default pricing
UPDATE industries SET 
    price_per_lead = CASE 
        WHEN name = 'Technology' THEN 15.00
        WHEN name = 'Healthcare' THEN 20.00
        WHEN name = 'Finance' THEN 25.00
        WHEN name = 'Real Estate' THEN 18.00
        WHEN name = 'Consulting' THEN 12.00
        WHEN name = 'Education' THEN 10.00
        WHEN name = 'Retail' THEN 8.00
        WHEN name = 'Manufacturing' THEN 14.00
        ELSE 10.00
    END,
    description = CASE
        WHEN name = 'Technology' THEN 'IT en technologie bedrijven'
        WHEN name = 'Healthcare' THEN 'Zorgverleners en medische diensten'
        WHEN name = 'Finance' THEN 'Financiële dienstverlening'
        WHEN name = 'Real Estate' THEN 'Makelaardij en vastgoed'
        WHEN name = 'Consulting' THEN 'Adviesbureaus en consultancy'
        WHEN name = 'Education' THEN 'Onderwijsinstellingen'
        WHEN name = 'Retail' THEN 'Detailhandel'
        WHEN name = 'Manufacturing' THEN 'Productie en fabricage'
        ELSE 'Algemene bedrijfstakken'
    END,
    is_active = true
WHERE price_per_lead IS NULL OR price_per_lead = 10.00;
```

### 3. Test het systeem
Na het uitvoeren van de SQL:
- Ga naar **Admin > Settings > Billing tab**
- Je zou nu de "Branches Beheer" sectie moeten zien
- Probeer een nieuwe branche toe te voegen
- Test het billing overzicht per gebruiker

### 4. Troubleshooting
Als je nog steeds errors ziet:
- Controleer of alle kolommen zijn toegevoegd aan de `industries` tabel
- Controleer of de functie `get_industries_with_pricing` bestaat
- Herstart de server: `npm run dev` of `node server.js`

---

**Status:** Het systeem werkt nu met fallbacks, maar voor volledige functionaliteit zijn de database updates nodig.
