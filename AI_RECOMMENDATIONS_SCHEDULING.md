# AI Recommendations Scheduling - Belasting Analyse

## Huidige Configuratie

**Frequentie:** Elke 3 uur (8x per dag)
**Schema:** `0 */3 * * *` → 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00

## Belasting Analyse

### Database Queries per Run

1. **Sites ophalen:** 1 query (max 10 sites door guardrail)
2. **Segments ophalen:** 1 query (typisch 20-50 actieve segments)
3. **Per (site, segment) combinatie:**
   - Gap berekening: 2 queries (plan + stats)
   - Cluster ophalen: 1 query
   - **Totaal: 3 queries per combinatie**

4. **Duplicate check:** 1 query per actie (kan geoptimaliseerd worden)
5. **Insert recommendations:** 1 bulk insert

### Totale Belasting

**Scenario: 10 sites × 50 segments = 500 combinaties**
- Gap/Cluster queries: 500 × 3 = **1,500 queries**
- Duplicate checks: ~50 acties × 1 = **50 queries**
- Insert: **1 query**
- **Totaal: ~1,550 queries per run**

**Geschatte tijd:** 5-15 seconden (afhankelijk van database performance)

### Server Impact

✅ **Licht tot matig:**
- Alle queries zijn SELECT queries met indexes
- Geen zware aggregaties of joins
- Duplicate checks kunnen geoptimaliseerd worden (batch check)
- Queries zijn relatief snel (< 50ms per query)

⚠️ **Overwegingen:**
- Bij veel segments (100+) kan het langer duren
- Duplicate checks kunnen geoptimaliseerd worden met batch queries
- Database connection pool moet groot genoeg zijn

## Aanbevolen Frequenties

### Optie 1: Elke 3 uur (HUIDIG) ✅ AANBEVOLEN
- **Schema:** `0 */3 * * *`
- **Runs per dag:** 8x
- **Voordeel:** Goede balans tussen real-time updates en server belasting
- **Geschikt voor:** Productie omgeving met normale belasting

### Optie 2: Elke 6 uur (CONSERVATIEF)
- **Schema:** `0 */6 * * *`
- **Runs per dag:** 4x (00:00, 06:00, 12:00, 18:00)
- **Voordeel:** Minder belasting, nog steeds redelijk up-to-date
- **Geschikt voor:** Als je server resources beperkt zijn

### Optie 3: Elk uur (AGGRESSIEF)
- **Schema:** `0 * * * *`
- **Runs per dag:** 24x
- **Voordeel:** Zeer real-time updates
- **Nadeel:** 4x meer belasting, mogelijk overkill
- **Geschikt voor:** Alleen als je echt real-time nodig hebt

### Optie 4: 2x per dag (MINIMAAL)
- **Schema:** `0 6,18 * * *`
- **Runs per dag:** 2x (06:00, 18:00)
- **Voordeel:** Minimale belasting
- **Nadeel:** Minder real-time, recommendations kunnen ouder zijn
- **Geschikt voor:** Test omgeving of zeer conservatieve setup

## Optimalisatie Opties

### 1. Batch Duplicate Checks
In plaats van per actie een query, check alle duplicates in één keer:
```javascript
// Haal alle bestaande recommendations op
const { data: existing } = await supabaseAdmin
  .from('ai_marketing_recommendations')
  .select('site_id, segment_id, action_type')
  .is('partner_id', null)
  .in('status', ['pending', 'approved']);

// Filter in-memory
const uniqueActions = actions.filter(action => {
  return !existing.some(e => 
    e.site_id === action.site_id &&
    e.segment_id === action.segment_id &&
    e.action_type === action.action_type
  );
});
```

**Besparing:** Van ~50 queries naar 1 query voor duplicate checks

### 2. Parallel Processing
Process sites parallel in plaats van sequentieel:
```javascript
const sitePromises = sites.map(site => 
  Promise.all(segments.map(segment => 
    processSiteSegment(site, segment)
  ))
);
const results = await Promise.all(sitePromises);
```

**Besparing:** Kan tijd reduceren met 50-70% op multi-core servers

### 3. Incremental Updates
Alleen segments checken waar iets is veranderd (gaps, nieuwe landing pages):
- Check alleen segments met recente lead activity
- Skip segments zonder changes sinds laatste run

**Besparing:** Kan 80-90% van queries besparen

## Monitoring

Monitor de volgende metrics:
- **Execution time:** Moet < 30 seconden zijn
- **Database load:** Check connection pool usage
- **Memory usage:** Moet stabiel blijven
- **Error rate:** Moet < 1% zijn

## Conclusie

**Aanbeveling: Elke 3 uur (8x per dag)**
- Goede balans tussen real-time en belasting
- Recommendations blijven up-to-date
- Server belasting is acceptabel
- Kan altijd aangepast worden naar 6 uur als nodig

**Als je meer real-time wilt:** Elke 2 uur (`0 */2 * * *`) is ook acceptabel
**Als je minder belasting wilt:** Elke 6 uur is conservatief maar veilig

