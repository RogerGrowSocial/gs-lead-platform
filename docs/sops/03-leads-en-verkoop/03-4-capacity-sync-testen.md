# SOP 03.4 – Capacity-based segment sync testen

**Doel:** Handmatig testen of de capacity-based segment sync correct werkt wanneer nieuwe branch+regio-combinaties worden toegevoegd.

**Doelgroep:** Admins / developers.

---

## Wat doet de sync?

1. **Nieuwe combinatie:** partner met branch (bijv. loodgieter) + regio (bijv. zuid-holland) en capaciteit > 0.
2. **Sync triggeren:** capacity-based sync uitvoeren.
3. **Segment:** als er capaciteit is, wordt een segment aangemaakt of geactiveerd.
4. **Target:** bij volgende orchestrator-run wordt een target berekend (bijv. 80% van capaciteit).

---

## Stap 1: Testscript draaien

```bash
node scripts/test-capacity-sync-manual.js
```

Het script toont o.a.:
- Huidige capacity-combinaties
- Huidige segmenten
- Instructies voor het toevoegen van nieuwe combinaties
- Resultaat na sync

---

## Stap 2: Nieuwe combinatie toevoegen (Supabase SQL)

1. Partner bepalen en industry/location preferences toevoegen (of bestaande partner gebruiken).
2. Zorgen dat de partner **capaciteit** heeft (`max_open_leads` of `subscriptions.leads_per_month`) en `is_active_for_routing = true`.
3. Voorbeeld-SQL staat in `docs/MANUAL_TEST_CAPACITY_SYNC.md` (user_industry_preferences, user_location_preferences, profiles, subscriptions).

---

## Stap 3: Sync triggeren

- **Via script:** `node scripts/test-capacity-sync-manual.js`
- **Via admin endpoint:** `POST /admin/leadstroom/sync-segments` met body `{ "method": "capacity" }` (admin auth vereist)

---

## Stap 4: Verifiëren

- **Segmenten:** `SELECT code, branch, region, is_active FROM lead_segments WHERE is_active = true;`
- **Capacity-combinaties:** `SELECT * FROM get_branch_region_capacity_combos();`
- **Targets (na orchestrator):** plans in `lead_segment_plans` voor de betreffende datum.

---

## Automatische sync

- Sync draait automatisch via cron (bijv. dagelijks 03:00); zie `cron/partnerMarketingJobs.js`.
- Handmatig testen is mogelijk zoals hierboven.

---

**Gerelateerd:** [SOP 03.3 – Lead Flow Intelligence](03-3-lead-flow-intelligence-segmenten.md), `docs/MANUAL_TEST_CAPACITY_SYNC.md`
