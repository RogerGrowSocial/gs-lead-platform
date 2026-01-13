# Onboarding System - Implementatie Gids

## Overzicht

Dit onboarding systeem bestaat uit:
1. **Intake Wizard** - Skipbare vragenlijst (3 stappen)
2. **Spotlight Tour** - Visuele tour door het dashboard
3. **Backend API** - Routes voor opslaan en ophalen van data
4. **Database Schema** - Supabase kolommen en functies

---

## Stap 1: Database Setup

### 1.1 Run SQL Script

Open Supabase SQL Editor en run het volgende bestand:
```
add_onboarding_columns.sql
```

Dit script:
- Voegt alle benodigde kolommen toe aan `profiles` tabel
- Maakt helper functies (`get_onboarding_status`, `complete_onboarding`, `update_onboarding_step`)
- Maakt een view voor onboarding progress (`v_onboarding_progress`)
- Zet RLS policies op

### 1.2 Verifieer Database

Run deze query om te controleren of alles correct is geïnstalleerd:
```sql
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN (
    'first_name', 'last_name', 'company_name', 'phone',
    'referral_source', 'referral_note',
    'lead_industries', 'lead_locations', 'lead_types',
    'lead_budget_min', 'lead_budget_max',
    'notify_channels',
    'onboarding_step', 'onboarding_completed_at'
  )
ORDER BY column_name;
```

---

## Stap 2: Backend Setup

### 2.1 API Routes

De API routes zijn al toegevoegd aan `routes/api.js`:
- `GET /api/onboarding/status` - Haal onboarding status op
- `POST /api/onboarding/step` - Update onboarding stap
- `POST /api/onboarding` - Sla onboarding data op
- `POST /api/onboarding/complete` - Voltooi onboarding

### 2.2 Test API Endpoints

Test de endpoints met Postman of curl:
```bash
# Get onboarding status
curl -X GET http://localhost:3000/api/onboarding/status \
  -H "Cookie: your-session-cookie"

# Update step
curl -X POST http://localhost:3000/api/onboarding/step \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"step": 1}'

# Save data
curl -X POST http://localhost:3000/api/onboarding \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "firstName": "Jan",
    "companyName": "Test BV",
    "industries": ["dakdekker", "schilder"]
  }'

# Complete onboarding
curl -X POST http://localhost:3000/api/onboarding/complete \
  -H "Cookie: your-session-cookie"
```

---

## Stap 3: Frontend Setup

### 3.1 HTML toevoegen

Voeg de HTML structuur toe aan `views/dashboard/index.ejs` (of je layout file):

```html
<!-- Intake Wizard -->
<div id="intakeWizard" class="intake-wizard hidden">
  <!-- Zie onboarding HTML voor volledige structuur -->
</div>

<!-- Spotlight Tour -->
<div id="spotlightTour" class="spotlight-tour hidden">
  <!-- Zie onboarding HTML voor volledige structuur -->
</div>
```

### 3.2 CSS toevoegen

Voeg de CSS toe aan je stylesheet of in een `<style>` tag in je layout:
- Kopieer alle CSS uit de onboarding CSS sectie
- Zorg dat de classes uniek zijn (gebruik prefix zoals `.onboarding-intake-wizard` als nodig)

### 3.3 JavaScript toevoegen

Voeg het script toe aan je layout:
```html
<script src="/js/onboarding.js"></script>
```

Of voeg de JavaScript inline toe aan je dashboard pagina.

### 3.4 Markeer elementen voor tour

Voeg `data-tour-id` attributen toe aan elementen die je wilt highlighten:

```html
<aside data-tour-id="sidebar" class="sidebar">
  <!-- Sidebar content -->
</aside>

<section data-tour-id="kpi" class="stats-section">
  <!-- KPI cards -->
</section>

<button data-tour-id="buy-lead" class="buy-lead-btn">
  Koop je eerste lead
</button>

<div data-tour-id="jobs" class="jobs-section">
  <!-- Jobs overview -->
</div>
```

---

## Stap 4: Test Flow

### 4.1 Test Intake Wizard

1. Log in als nieuwe gebruiker (of reset onboarding voor bestaande user)
2. Wizard zou automatisch moeten verschijnen
3. Test elke stap:
   - Stap 1: Basis info (skipbaar)
   - Stap 2: Hoe gevonden (skipbaar)
   - Stap 3: Lead voorkeuren (skipbaar)
4. Test "Sla over" knop op elke stap
5. Test "Volgende" knop en controleer of data wordt opgeslagen

### 4.2 Test Spotlight Tour

1. Na voltooien van wizard (of skip), zou tour moeten starten
2. Test navigatie:
   - "Volgende" knop
   - "Terug" knop
   - "Overslaan" knop
3. Controleer of spotlight correct positioneert rond elementen
4. Test "Klaar" knop op laatste stap

### 4.3 Verifieer Database

Controleer of data correct wordt opgeslagen:
```sql
SELECT 
  id,
  email,
  first_name,
  company_name,
  onboarding_step,
  onboarding_completed_at,
  lead_industries,
  lead_locations,
  notify_channels
FROM profiles
WHERE id = 'your-user-id';
```

---

## Stap 5: Aanpassingen (Optioneel)

### 5.1 Tour Steps Aanpassen

Pas de `TOUR_STEPS` array aan in `onboarding.js`:
```javascript
const TOUR_STEPS = [
  {
    id: 'sidebar',
    title: 'Navigatie',
    text: 'Je aangepaste tekst hier.'
  },
  // Voeg meer stappen toe of verwijder stappen
];
```

### 5.2 Intake Stappen Aanpassen

Pas de HTML structuur aan in je EJS template:
- Voeg nieuwe stappen toe door nieuwe `data-step` divs toe te voegen
- Update de `nextStep()` functie om naar nieuwe stappen te gaan
- Update de `saveCurrentStepData()` functie om nieuwe data op te slaan

### 5.3 Custom Styling

Pas de CSS aan naar je huisstijl:
- Kleuren (momenteel: `#ea5d0d` voor primary, `#111827` voor dark)
- Font sizes
- Spacing
- Animations

---

## Stap 6: Productie Checklist

- [ ] Database schema is geïnstalleerd
- [ ] API endpoints werken correct
- [ ] Frontend HTML is toegevoegd
- [ ] CSS is toegevoegd en werkt
- [ ] JavaScript is toegevoegd en werkt
- [ ] Tour elementen zijn gemarkeerd met `data-tour-id`
- [ ] Test flow werkt end-to-end
- [ ] Data wordt correct opgeslagen in database
- [ ] Onboarding wordt niet opnieuw getoond voor voltooide users
- [ ] Mobile responsive werkt
- [ ] Error handling werkt (netwerk errors, etc.)
- [ ] Loading states zijn geïmplementeerd

---

## Troubleshooting

### Problem: Wizard verschijnt niet
**Oplossing:**
- Check of `onboarding_completed_at` NULL is in database
- Check browser console voor JavaScript errors
- Verifieer dat `checkOnboardingStatus()` wordt aangeroepen

### Problem: Data wordt niet opgeslagen
**Oplossing:**
- Check browser console voor API errors
- Verifieer dat user is ingelogd (session cookie)
- Check Supabase RLS policies
- Check database kolommen bestaan

### Problem: Spotlight tour werkt niet
**Oplossing:**
- Verifieer dat elementen `data-tour-id` attributen hebben
- Check of `clip-path` CSS wordt ondersteund door browser
- Check browser console voor JavaScript errors
- Verifieer dat `TOUR_STEPS` array correct is

### Problem: Tour elementen niet gevonden
**Oplossing:**
- Check of `data-tour-id` exact overeenkomt met `TOUR_STEPS` array
- Verifieer dat elementen bestaan in DOM wanneer tour start
- Check of er geen typos zijn in IDs

---

## API Documentation

### GET /api/onboarding/status
Haalt onboarding status op voor huidige gebruiker.

**Response:**
```json
{
  "success": true,
  "data": {
    "onboarding_completed": false,
    "onboarding_step": 1,
    "onboarding_completed_at": null,
    "has_basic_info": true,
    "has_referral_info": false,
    "has_lead_preferences": false
  }
}
```

### POST /api/onboarding/step
Update onboarding stap.

**Request:**
```json
{
  "step": 2,
  "data": {
    "firstName": "Jan",
    "lastName": "Jansen"
  }
}
```

### POST /api/onboarding
Sla onboarding data op.

**Request:**
```json
{
  "firstName": "Jan",
  "lastName": "Jansen",
  "companyName": "Test BV",
  "phone": "0612345678",
  "referralSource": "google",
  "referralNote": "Via zoekmachine",
  "industries": ["dakdekker", "schilder"],
  "locations": ["Rotterdam", "Den Haag"],
  "leadTypes": ["b2b", "spoed"],
  "budgetMin": 10,
  "budgetMax": 50,
  "notifications": ["email", "inapp"]
}
```

### POST /api/onboarding/complete
Voltooi onboarding proces.

**Response:**
```json
{
  "success": true,
  "message": "Onboarding voltooid",
  "data": {
    "completed": true
  }
}
```

---

## Best Practices

1. **Skipbaar maken**: Alle stappen moeten skipbaar zijn om frictie te verminderen
2. **Auto-save**: Data wordt automatisch opgeslagen bij elke stap
3. **Progress indicator**: Overweeg een progress bar toe te voegen
4. **Mobile first**: Zorg dat alles werkt op mobile devices
5. **Error handling**: Toon vriendelijke error messages
6. **Loading states**: Toon loading indicators tijdens API calls
7. **Accessibility**: Zorg voor goede keyboard navigation en screen reader support

---

## Volgende Stappen

- [ ] Voeg confetti toe bij voltooien van onboarding
- [ ] Voeg progress indicator toe aan dashboard
- [ ] Implementeer beloning systeem (bijv. +10 lead credits)
- [ ] A/B test verschillende onboarding flows
- [ ] Voeg analytics toe om te meten welke stappen worden overgeslagen
- [ ] Voeg admin dashboard toe om onboarding data te bekijken

---

## Support

Voor vragen of problemen, check:
1. Browser console voor JavaScript errors
2. Server logs voor backend errors
3. Supabase logs voor database errors
4. Network tab voor API request/response details

