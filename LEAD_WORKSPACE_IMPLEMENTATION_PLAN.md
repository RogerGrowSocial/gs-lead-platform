# Lead Workspace Implementation Plan

## 📊 Database Inspectie Resultaten

### ✅ Beschikbare Tabellen & Kolommen

**LEADS tabel:**
- ✅ `id`, `name`, `email`, `phone`, `message`
- ✅ `status` (new, accepted, in_progress, won, lost)
- ✅ `assigned_to` (partner ID)
- ✅ `first_contact_at` (TIMESTAMPTZ, kan NULL zijn)
- ✅ `deal_value` (NUMERIC, kan NULL zijn)
- ✅ `price_at_purchase` (lead prijs)
- ✅ `province`, `industry_id`
- ✅ `created_at`

**LEAD_ACTIVITIES tabel:**
- ✅ `id`, `lead_id`, `type`, `description`, `created_by`, `created_at`, `metadata`
- ❌ **GEEN `partner_id` kolom** (gebruiken we `created_by` in plaats daarvan)
- Huidige types in DB: `created`, `status_changed`
- Moet uitbreiden naar: `phone_call`, `email_sent`, `whatsapp`, `meeting`, `status_change_contacted`, `note`, `message`

**LEAD_FEEDBACK tabel:**
- ✅ Tabel bestaat maar is leeg

**SUPPORT_TICKETS tabel:**
- ✅ Tabel bestaat maar is leeg

### ⚠️ Database Aanpassingen Nodig

1. **Activity Types Constraint:**
   - Huidige constraint moet uitgebreid worden met nieuwe types
   - Of: constraint verwijderen en in backend valideren

2. **First Contact Trigger:**
   - Check of er al een database trigger bestaat voor `first_contact_at`
   - Zo niet: trigger aanmaken of backend logica implementeren

---

## 🎯 Implementatie Plan

### FASE 1: Database Migratie (indien nodig)

**1.1 Activity Types Uitbreiden**
```sql
-- Check huidige constraint
-- Als constraint bestaat, verwijderen en opnieuw aanmaken met nieuwe types
ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_type_check;
ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_type_check 
  CHECK (type IN (
    'phone_call',
    'email_sent', 
    'whatsapp',
    'meeting',
    'status_change_contacted',
    'note',
    'created',
    'message',
    'status_changed' -- behouden voor backward compatibility
  ));
```

**1.2 First Contact Trigger (indien nog niet bestaat)**
```sql
-- Check of trigger al bestaat, zo niet:
CREATE OR REPLACE FUNCTION set_first_contact_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IN ('phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted')
     AND NOT EXISTS (
       SELECT 1 FROM leads 
       WHERE id = NEW.lead_id 
       AND first_contact_at IS NOT NULL
     ) THEN
    UPDATE leads 
    SET first_contact_at = NOW() 
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_first_contact_at
AFTER INSERT ON lead_activities
FOR EACH ROW
EXECUTE FUNCTION set_first_contact_at();
```

---

### FASE 2: Backend API Endpoints

**2.1 POST `/dashboard/api/leads/:id/message`**
- Nieuwe endpoint voor chat berichten
- Accepteert: `{ message: string, channel: 'dashboard' | 'email' | 'whatsapp' }`
- Opslaan in `lead_activities` met `type = 'message'`
- Als channel = 'email' of 'whatsapp' → template versturen
- Performance trigger: check `first_contact_at`

**2.2 GET `/dashboard/api/leads/:id/activities`**
- Haal alle activities op voor deze lead
- Sorteer op `created_at DESC`
- Include `created_by` user info (naam, email)

**2.3 POST `/dashboard/api/leads/:id/activity` (uitbreiden)**
- Bestaande endpoint uitbreiden
- Ondersteunen nieuwe activity types
- Performance triggers aanroepen

**2.4 PATCH `/dashboard/api/leads/:id/status` (uitbreiden)**
- Bestaande endpoint uitbreiden
- Ondersteunen `in_progress`, `won`, `lost`
- Bij `won`: optioneel `deal_value` accepteren
- Activity loggen: `status_change_won` / `status_change_lost`

---

### FASE 3: Frontend - Lead Workspace Layout

**3.1 Nieuwe Layout Structuur**
```
┌─────────────────────────────────────────────────────────┐
│  Lead Overview Card (bovenaan)                           │
│  - Naam, Contact, Status, Provincie, Branche, Prijs     │
│  - Klant bericht (groot en duidelijk)                    │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────┐
│  Chat Systeem (links)    │  Activity Timeline (rechts)  │
│  - Berichten bubbles     │  - Chronologische lijst     │
│  - Input veld            │  - Icons per type            │
│  - Kanaal selector       │  - Tijd + beschrijving      │
└──────────────────────────┴──────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Actieknoppen (onderaan)                                │
│  - Ik heb gebeld                                         │
│  - WhatsApp gestuurd                                    │
│  - E-mail gestuurd                                       │
│  - Afspraak ingepland                                    │
│  - Opdracht binnen                                       │
│  - Geen opdracht                                         │
└─────────────────────────────────────────────────────────┘
```

**3.2 Componenten**
- `LeadOverview.js` - Lead info card
- `LeadChat.js` - Chat interface met bubbles
- `LeadTimeline.js` - Activity timeline component
- `LeadActions.js` - Actieknoppen component

**3.3 Styling**
- Chat bubbles: partner rechts (blauw), klant links (grijs), systeem (lichtgrijs)
- Timeline: verticale lijst met icons
- Responsive: op mobiel stacken

---

### FASE 4: Performance Triggers

**4.1 Helper Functions (`lib/performanceTriggers.js`)**
```javascript
async function handleFirstContact(leadId, activityType) {
  // Check of first_contact_at al gezet is
  // Zo niet: set via UPDATE query
}

async function handleWon(leadId, dealValue = null) {
  // Update lead status naar 'won'
  // Set deal_value indien opgegeven
  // Log activity: status_change_won
}

async function handleLost(leadId) {
  // Update lead status naar 'lost'
  // Log activity: status_change_lost
}
```

---

### FASE 5: Messaging Templates

**5.1 Email Template: `templates/emails/lead_message.html`**
- Nieuw template voor "Nieuw bericht van partner"
- Variabelen: `{{partner_name}}`, `{{message}}`, `{{lead_url}}`

**5.2 WhatsApp Template**
- Gebruik bestaande WhatsApp service
- Template voor "Nieuw bericht van partner"

**5.3 Integratie**
- Bij `POST /message` met channel = 'email' → email template versturen
- Bij `POST /message` met channel = 'whatsapp' → WhatsApp template versturen

---

## 📝 Bestanden die Aangepast Worden

### Nieuwe Bestanden:
1. `lib/performanceTriggers.js` - Performance trigger helpers
2. `templates/emails/lead_message.html` - Email template voor berichten
3. `public/js/lead-workspace.js` - Frontend JavaScript voor workspace
4. `public/css/lead-workspace.css` - Styling voor workspace

### Aangepaste Bestanden:
1. `views/dashboard/lead-details.ejs` - Volledig ombouwen naar workspace layout
2. `routes/dashboard.js` - Nieuwe API endpoints toevoegen
3. `public/js/lead-details.js` - Hervormen naar workspace logica

---

## ⚠️ Belangrijke Aandachtspunten

1. **Backward Compatibility:**
   - Bestaande activity types (`created`, `status_changed`) blijven werken
   - Oude performance blokken verwijderen maar data behouden

2. **Database Triggers:**
   - Check eerst of `first_contact_at` trigger al bestaat
   - Zo niet: aanmaken of backend logica gebruiken

3. **RLS (Row Level Security):**
   - Gebruik `supabaseAdmin` waar nodig voor lead fetching
   - Check toegang expliciet in backend

4. **Activity Types:**
   - `lead_activities` heeft GEEN `partner_id` kolom
   - Gebruik `created_by` in plaats daarvan
   - Fallback logica al geïmplementeerd in huidige code

5. **Messaging:**
   - Email templates bestaan al (`services/emailService.js`)
   - WhatsApp service bestaat al (`services/whatsappService.js`)
   - Nieuwe template toevoegen voor "nieuw bericht"

---

## ✅ Volgende Stappen

1. **Goedkeuring vragen** voor dit plan
2. **Database migratie** uitvoeren (indien nodig)
3. **Backend endpoints** implementeren
4. **Frontend workspace** bouwen
5. **Performance triggers** implementeren
6. **Messaging templates** toevoegen
7. **Testen** en debuggen

---

## ❓ Vragen voor Goedkeuring

1. Moet de database constraint voor activity types aangepast worden, of valideren we alleen in backend?
2. Bestaat er al een database trigger voor `first_contact_at`, of moeten we die aanmaken?
3. Moeten we de oude performance blokken volledig verwijderen of behouden als fallback?
4. Welke styling library gebruiken we? (Bootstrap, custom CSS, etc.)

