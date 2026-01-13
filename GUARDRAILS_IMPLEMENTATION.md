# Guardrails Implementation ✅

**Date:** January 2025  
**Status:** ✅ Complete

---

## 📋 Overview

Guardrails zijn geïmplementeerd om mass domain explosion en doorway pages te voorkomen, en om SEO-richtlijnen te handhaven. Alle guardrails zijn hard-coded constants die strikt worden gehandhaafd in de code.

---

## 🔒 Guardrails Constants

### 1. MAX_SITES = 10
**Locatie:** `services/partnerMarketingOrchestratorService.js`

**Implementatie:**
- Check in `generatePlatformMarketingActions()`: Limiteert actieve sites tot 10
- Als meer dan 10 sites gevonden worden, worden alleen de eerste 10 verwerkt
- Logging waarschuwing bij overschrijding

**Doel:** Voorkomt mass domain explosion en houdt het aantal sites beheersbaar voor SEO.

---

### 2. MAX_PAGES_PER_CLUSTER = 6
**Locatie:** 
- `services/partnerMarketingOrchestratorService.js` (orchestrator)
- `services/partnerLandingPageService.js` (createPlatformLandingPage)

**Implementatie:**

**In Orchestrator:**
- Check in `generatePlatformActionsForSegment()`: Telt bestaande pagina's in cluster
- Als cluster al 6 pagina's heeft, worden geen nieuwe recommendations gegenereerd
- Return early als guardrail wordt overschreden

**In Landing Page Service:**
- Check in `createPlatformLandingPage()`: Valideert cluster size voordat nieuwe pagina wordt aangemaakt
- Gooit error als MAX_PAGES_PER_CLUSTER wordt overschreden
- Voorkomt dat pagina's worden aangemaakt via directe API calls

**Doel:** Beperkt het aantal pagina's per (site, segment) cluster om doorway pages te voorkomen.

---

### 3. MIN_GAP_FOR_NEW_PAGE = 3
**Locatie:** `services/partnerMarketingOrchestratorService.js`

**Implementatie:**
- Gebruikt als basis threshold voor nieuwe pagina recommendations
- **Main page:** Geen threshold (altijd eerst gemaakt als ontbreekt)
- **Cost page:** `gap > MIN_GAP_FOR_NEW_PAGE` (3)
- **Quote page:** `gap > MIN_GAP_FOR_NEW_PAGE + 2` (5)
- **Spoed page:** `gap > MIN_GAP_FOR_NEW_PAGE + 4` (7) + segment check

**Doel:** Zorgt ervoor dat nieuwe pagina's alleen worden voorgesteld wanneer er voldoende lead gap is.

---

## 🔗 Internal Linking Improvements

**Locatie:** `views/public/landing-page.ejs`

### Implementatie:

**Main Page:**
- Toont links naar beschikbare satellite pages (cost, quote, spoed)
- Sectie titel: "Meer informatie"
- Links worden alleen getoond als satelliet pagina's bestaan

**Satellite Pages (cost, quote, spoed):**
- Toont link terug naar main page
- Sectie titel: "Terug naar overzicht"
- Link heeft terug-pijl icoon voor duidelijkheid
- Link wordt alleen getoond als main page bestaat

**Logica:**
```javascript
const isMainPage = landingPage.page_type === 'main';
const hasSatellites = cluster && (cluster.cost || cluster.quote || cluster.spoed);
const hasMainPage = cluster && cluster.main && !isMainPage;
```

**Doel:** Verbeterde navigatie tussen cluster pagina's voor betere UX en SEO internal linking.

---

## 📁 Files Modified

1. **`services/partnerMarketingOrchestratorService.js`**
   - Guardrail constants toegevoegd
   - MAX_SITES check in `generatePlatformMarketingActions()`
   - MAX_PAGES_PER_CLUSTER check in `generatePlatformActionsForSegment()`
   - MIN_GAP_FOR_NEW_PAGE gebruikt in plaats van hardcoded waarden

2. **`services/partnerLandingPageService.js`**
   - MAX_PAGES_PER_CLUSTER check in `createPlatformLandingPage()`
   - Voorkomt directe pagina creatie die guardrails overschrijdt

3. **`views/public/landing-page.ejs`**
   - Verbeterde internal linking logica
   - Conditionele rendering voor main vs satellite pages
   - Terug-link met icoon voor satellite pages

---

## ✅ Validation

### Guardrails worden gehandhaafd op:

1. **Recommendation Generation** (Orchestrator)
   - MAX_SITES: Limiteert aantal sites in verwerking
   - MAX_PAGES_PER_CLUSTER: Stopt recommendations als cluster vol is
   - MIN_GAP_FOR_NEW_PAGE: Drempel voor nieuwe pagina's

2. **Direct Page Creation** (Landing Page Service)
   - MAX_PAGES_PER_CLUSTER: Blokkeert creatie als cluster vol is
   - Error wordt gegooid met duidelijke boodschap

3. **Internal Linking** (Template)
   - Automatische links tussen cluster pagina's
   - Context-aware: main toont satellites, satellites tonen main

---

## 🎯 Next Steps (Optional)

1. **Shared Constants File:** Overweeg `constants/guardrails.js` voor gedeelde constants
2. **Admin UI Warnings:** Toon guardrail waarschuwingen in admin UI bij overschrijding
3. **Metrics Dashboard:** Track guardrail hits voor monitoring
4. **Configurable Thresholds:** Maak thresholds configureerbaar via env vars (optioneel)

---

## 📝 Notes

- Guardrails zijn **hard caps** - ze kunnen niet worden overschreden zonder code wijziging
- Alle guardrails zijn gedocumenteerd in code comments
- Error messages zijn gebruiksvriendelijk en duidelijk
- Internal linking is volledig automatisch - geen handmatige configuratie nodig

---

**Status:** ✅ Alle guardrails geïmplementeerd en getest

