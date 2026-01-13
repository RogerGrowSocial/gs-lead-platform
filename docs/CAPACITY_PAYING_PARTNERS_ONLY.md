# Capacity & Segment Sync: Alleen Betalende Partners

## Overzicht

De segment-sync en capacity-berekening zijn aangepast zodat:
1. **Alleen betalende partners** meetellen voor capacity en segment-aanmaak
2. **Segmenten worden nooit verwijderd**, alleen gedeactiveerd (`is_active = false`)

## Belangrijke Wijzigingen

### 1. Database Functies

#### `get_segment_capacity(segment_id)`
- **Filter toegevoegd**: Alleen partners met `payment_methods.status = 'active'` tellen mee
- **Capacity check**: Partners moeten `leads_per_month > 0` of `max_open_leads > 0` hebben
- **Migratie**: `supabase/migrations/20250117000001_update_capacity_for_paying_partners_only.sql`

#### `get_branch_region_capacity_combos()`
- **Filter toegevoegd**: Alleen combinaties met betalende partners
- **Gebruikt in**: Capacity-based segment sync (`SegmentSyncService.syncSegmentsFromCapacity()`)

### 2. Segment Management

#### Segmenten worden nooit verwijderd
- **Soft delete**: Segmenten krijgen `is_active = false` in plaats van DELETE
- **Reactivatie**: `findOrCreateSegment()` zoekt eerst inactieve segmenten en reactiveert ze
- **Historie behouden**: Bestaande leads kunnen inactieve segmenten hebben (voor tracking)

#### Segment Sync Logic
- **Aanmaken**: Alleen als `capacity_total > 0` EN er zijn betalende partners
- **Activeren**: Inactieve segmenten worden geactiveerd als er weer capacity is
- **Deactiveren**: Segmenten zonder capacity krijgen `is_active = false` (niet DELETE)

### 3. Service Updates

#### `LeadSegmentService.findOrCreateSegment()`
- Zoekt eerst actieve segmenten
- Als geen actief segment: zoekt inactieve segmenten en reactiveert ze
- Maakt alleen nieuw segment als er helemaal geen bestaat

#### `SegmentSyncService.syncSegmentsFromCapacity()`
- Gebruikt `get_branch_region_capacity_combos()` (alleen betalende partners)
- Activeert inactieve segmenten in plaats van nieuwe aan te maken
- Deactiveert segmenten zonder capacity (geen DELETE)

### 4. Query Filters

Alle queries die segmenten ophalen gebruiken nu `is_active = true`:
- ✅ `getAllActiveSegments()` - filtert op `is_active = true`
- ✅ `aggregateLeadStatsDaily()` - filtert op `is_active = true`
- ✅ `partnerMarketingOrchestratorService` - filtert op `is_active = true`
- ✅ `channelOrchestratorService` - filtert op `is_active = true`
- ✅ API endpoints - filteren op `is_active = true`

**Uitzondering**: `assignSegmentToLead()` kan inactieve segmenten retourneren voor bestaande leads (historische tracking).

### 5. Performance Indexes

Nieuwe indexes toegevoegd:
- `idx_payment_methods_user_status` - Voor snelle payment method lookups
- `idx_lead_segments_active_branch_region` - Voor snelle segment queries

## Criteria voor Betalende Partners

Een partner telt mee als:
1. ✅ `profiles.is_active_for_routing = true`
2. ✅ `profiles.is_admin = false`
3. ✅ Heeft branche + locatie ingesteld
4. ✅ `subscriptions.leads_per_month > 0` OF `profiles.max_open_leads > 0`
5. ✅ **NIEUW**: `EXISTS (SELECT 1 FROM payment_methods WHERE user_id = partner.id AND status = 'active')`

## Segment Lifecycle

```
1. Partner heeft betaalmethode + capacity > 0
   → Segment wordt aangemaakt (is_active = true)
   → OF bestaand inactief segment wordt geactiveerd

2. Partner verliest betaalmethode OF capacity = 0
   → Segment krijgt is_active = false
   → Segment blijft in database (geen DELETE)

3. Partner krijgt weer betaalmethode + capacity > 0
   → Segment krijgt is_active = true (reactivatie)
```

## Migratie Uitvoeren

1. Run de migratie in Supabase SQL Editor:
   ```sql
   -- Bestand: supabase/migrations/20250117000001_update_capacity_for_paying_partners_only.sql
   ```

2. Verifieer dat functies zijn bijgewerkt:
   ```sql
   -- Haal eerst een segment ID op
   SELECT id, code FROM lead_segments WHERE is_active = true LIMIT 1;
   
   -- Gebruik dat ID om capacity te checken (vervang 'YOUR_SEGMENT_ID' met het echte ID)
   SELECT * FROM get_segment_capacity('YOUR_SEGMENT_ID'::UUID);
   
   -- Of gebruik een subquery:
   SELECT * FROM get_segment_capacity(
     (SELECT id FROM lead_segments WHERE is_active = true LIMIT 1)
   );
   
   -- Check alle capacity combinaties
   SELECT * FROM get_branch_region_capacity_combos();
   ```

3. Test de segment sync:
   ```bash
   node scripts/test-capacity-sync-manual.js
   ```

4. Test capacity voor betalende partners:
   ```sql
   -- Run het test script: scripts/test-capacity-paying-partners.sql
   -- Dit script test of alleen betalende partners meetellen
   ```

## Test Scripts

### `scripts/test-capacity-paying-partners.sql`
Compleet test script om te verifiëren dat:
- Alleen partners met betaalmethode meetellen
- Partners zonder betaalmethode worden genegeerd
- Capacity functies correct werken

### Gebruik:
```sql
-- Kopieer en run het hele script in Supabase SQL Editor
-- Of run individuele queries om specifieke checks te doen
```

## Breaking Changes

⚠️ **Geen breaking changes** - bestaande functionaliteit blijft werken:
- Bestaande leads met inactieve segmenten blijven werken
- API endpoints blijven functioneren
- Orchestrator blijft werken (filtert op `is_active = true`)

## Toekomstige Verbeteringen

- [ ] Lazy fallback voor segment-aanmaak (als segment nodig is maar niet bestaat)
- [ ] Automatische reactivatie van segmenten bij nieuwe betalende partners
- [ ] Dashboard metrics voor inactieve segmenten

