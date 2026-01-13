# Handmatig Testen: Capacity-Based Segment Sync

## Overzicht

Dit document legt uit hoe je handmatig kunt testen of de capacity-based segment sync werkt door nieuwe branch + locatie combinaties toe te voegen.

## Wat gebeurt er?

1. **Nieuwe combinatie toevoegen**: Partner met branch (bijv. "loodgieter") + locatie (bijv. "zuid-holland")
2. **Sync triggeren**: Run de capacity-based sync
3. **Segment wordt aangemaakt**: Als er capacity > 0 is, wordt automatisch een segment aangemaakt
4. **Target wordt berekend**: Bij de volgende orchestrator run wordt een target berekend (80% van capacity)

## Stappen

### Stap 1: Test Script Run

```bash
node scripts/test-capacity-sync-manual.js
```

Dit script toont:
- Huidige capacity combinaties
- Huidige segmenten
- Instructies voor het toevoegen van nieuwe combinaties
- Resultaten na sync

### Stap 2: Nieuwe Combinatie Toevoegen

#### Optie A: Via Supabase Dashboard (SQL Editor)

```sql
-- 1. Vind een bestaande partner
SELECT id, email, company_name, is_active_for_routing 
FROM profiles 
WHERE is_admin = false 
LIMIT 5;

-- 2. Vind industry ID (bijv. "loodgieter")
SELECT id, name FROM industries WHERE name ILIKE '%loodgieter%';

-- 3. Voeg industry preference toe
INSERT INTO user_industry_preferences (user_id, industry_id, is_enabled)
VALUES (
  'PARTNER_USER_ID_HIER',  -- Vervang met echte user_id
  (SELECT id FROM industries WHERE name ILIKE '%loodgieter%' LIMIT 1),
  true
)
ON CONFLICT (user_id, industry_id) DO UPDATE SET is_enabled = true;

-- 4. Voeg location preference toe (bijv. "zuid-holland")
INSERT INTO user_location_preferences (user_id, location_code, location_name, is_enabled)
VALUES (
  'PARTNER_USER_ID_HIER',  -- Vervang met echte user_id
  'zuid-holland',
  'Zuid-Holland',
  true
)
ON CONFLICT (user_id, location_code) DO UPDATE SET is_enabled = true;

-- 5. Zorg dat partner capacity heeft
-- Optie 1: Via max_open_leads
UPDATE profiles 
SET max_open_leads = 50  -- Bijv. 50 leads per maand
WHERE id = 'PARTNER_USER_ID_HIER';

-- Optie 2: Via subscription (heeft voorrang)
INSERT INTO subscriptions (user_id, status, leads_per_month, is_paused)
VALUES (
  'PARTNER_USER_ID_HIER',
  'active',
  50,
  false
)
ON CONFLICT DO NOTHING;

-- 6. Zorg dat partner actief is voor routing
UPDATE profiles 
SET is_active_for_routing = true
WHERE id = 'PARTNER_USER_ID_HIER';
```

#### Optie B: Via API (als je een test partner hebt)

```bash
# 1. Voeg industry preference toe
curl -X POST http://localhost:3000/users/current/industry-preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": [
      { "industry_id": INDUSTRY_ID, "is_enabled": true }
    ]
  }'

# 2. Voeg location preference toe
curl -X POST http://localhost:3000/users/current/location-preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": [
      { "location_code": "zuid-holland", "location_name": "Zuid-Holland", "is_enabled": true }
    ]
  }'
```

### Stap 3: Sync Triggeren

#### Optie A: Via Test Script

```bash
node scripts/test-capacity-sync-manual.js
```

#### Optie B: Via Admin Endpoint

```bash
curl -X POST http://localhost:3000/admin/leadstroom/sync-segments \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "capacity"
  }'
```

#### Optie C: Via Node.js Direct

```javascript
const SegmentSyncService = require('./services/segmentSyncService');

SegmentSyncService.syncSegmentsFromCapacity()
  .then(result => {
    console.log('Sync completed:', result);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### Stap 4: Verifieer Resultaten

#### Check Segmenten in Database

```sql
-- Check alle actieve segmenten
SELECT code, branch, region, is_active 
FROM lead_segments 
WHERE is_active = true
ORDER BY branch, region;
```

#### Check Capacity Combinaties

```sql
-- Check welke combinaties capacity hebben
SELECT * FROM get_branch_region_capacity_combos()
ORDER BY branch, region;
```

#### Check Targets (na orchestrator run)

```sql
-- Check targets voor segmenten
SELECT 
  ls.code,
  ls.branch,
  ls.region,
  lsp.target_leads_per_day,
  lsp.lead_gap,
  lsp.date
FROM lead_segments ls
JOIN lead_segment_plans lsp ON lsp.segment_id = ls.id
WHERE ls.is_active = true
  AND lsp.date = CURRENT_DATE
ORDER BY ls.branch, ls.region;
```

## Wat te Verifiëren?

### ✅ Succesvolle Test

1. **Nieuwe combinatie wordt gevonden**
   - `get_branch_region_capacity_combos()` retourneert de nieuwe combinatie
   - Capacity > 0 (partners en leads/maand)

2. **Segment wordt aangemaakt**
   - Nieuw segment in `lead_segments` tabel
   - `is_active = true`
   - Code = `{branch}_{region}` (bijv. `loodgieter_zuid_holland`)

3. **Target wordt berekend** (na orchestrator run)
   - Plan in `lead_segment_plans` tabel
   - `target_leads_per_day` = 80% van capacity / 30 dagen
   - Bijv. 50 leads/maand → 40 leads/maand → ~1.3 leads/dag

### ❌ Mogelijke Problemen

1. **Segment wordt niet aangemaakt**
   - Check: Heeft partner `is_active_for_routing = true`?
   - Check: Heeft partner capacity > 0 (max_open_leads of subscription)?
   - Check: Zijn preferences enabled (`is_enabled = true`)?

2. **Target wordt niet berekend**
   - Targets worden alleen berekend wanneer orchestrator draait
   - Run orchestrator handmatig of wacht op cron job
   - Check: Bestaat er een plan voor vandaag?

3. **Segment wordt gedeactiveerd**
   - Dit gebeurt wanneer er geen capacity meer is
   - Check: Is partner nog actief? Heeft partner nog capacity?

## Voorbeeld Test Scenario

### Scenario: Nieuwe Combinatie "Loodgieter + Zuid-Holland"

1. **Voeg partner toe** met:
   - Industry: "Loodgieter" (via `user_industry_preferences`)
   - Location: "zuid-holland" (via `user_location_preferences`)
   - Capacity: 50 leads/maand (via `max_open_leads` of `subscriptions.leads_per_month`)
   - `is_active_for_routing = true`

2. **Run sync**:
   ```bash
   node scripts/test-capacity-sync-manual.js
   ```

3. **Verwacht resultaat**:
   - Nieuwe combinatie: `loodgieter + zuid-holland` (1 partner, 50 leads/maand)
   - Nieuw segment: `loodgieter_zuid_holland` (actief)
   - Target: ~1.3 leads/dag (50 * 0.8 / 30)

4. **Verifieer**:
   ```sql
   SELECT * FROM lead_segments WHERE code = 'loodgieter_zuid_holland';
   SELECT * FROM get_branch_region_capacity_combos() WHERE branch = 'loodgieter' AND region = 'zuid-holland';
   ```

## Automatische Sync

De sync draait automatisch via cron job:
- **Frequentie**: Dagelijks om 03:00
- **Functie**: `syncSegmentsFromCapacity()`
- **Cron file**: `cron/partnerMarketingJobs.js`

Je hoeft dus niet handmatig te syncen, maar je kunt het wel doen voor testing.

## Tips

1. **Gebruik test script**: Het test script geeft duidelijke feedback over wat er gebeurt
2. **Check logs**: Kijk naar de logs voor gedetailleerde informatie
3. **Test incrementally**: Voeg één combinatie toe per keer om te zien wat er gebeurt
4. **Verifieer capacity**: Zorg dat partner daadwerkelijk capacity heeft (> 0)
5. **Check active status**: Partner moet `is_active_for_routing = true` hebben

## Troubleshooting

### Segment wordt niet aangemaakt

```sql
-- Check of combinatie capacity heeft
SELECT * FROM get_branch_region_capacity_combos() 
WHERE branch = 'YOUR_BRANCH' AND region = 'YOUR_REGION';

-- Check partner status
SELECT id, email, is_active_for_routing, max_open_leads 
FROM profiles 
WHERE id = 'PARTNER_ID';

-- Check preferences
SELECT * FROM user_industry_preferences WHERE user_id = 'PARTNER_ID' AND is_enabled = true;
SELECT * FROM user_location_preferences WHERE user_id = 'PARTNER_ID' AND is_enabled = true;

-- Check subscription
SELECT * FROM subscriptions WHERE user_id = 'PARTNER_ID' AND status = 'active' AND is_paused = false;
```

### Segment wordt gedeactiveerd

Dit is normaal als er geen capacity meer is. Check:
- Is partner nog actief?
- Heeft partner nog capacity?
- Zijn preferences nog enabled?

