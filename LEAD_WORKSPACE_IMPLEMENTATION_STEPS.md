# Lead Workspace - Implementatie Stappenlijst

## 📊 Database Inspectie Resultaten

### ✅ Bevindingen:
1. **First Contact Trigger**: ✅ **BESTAAT AL** - wordt automatisch afgevuurd bij contact activities
2. **Type Constraint**: ❌ **BESTAAT NIET** - moet aangemaakt worden
3. **Huidige Activity Types**: `created` (144x), `status_changed` (18x)
4. **Tabel Structuur**: `id`, `lead_id`, `type`, `description`, `created_by`, `created_at`, `metadata`
5. **Geen `partner_id` kolom** - gebruiken we `created_by`

---

## 🚀 Implementatie Stappenlijst

### **STAP 1: Database Migratie**
**Bestand**: `supabase/migrations/[timestamp]_add_lead_workspace_constraints.sql`

**Acties:**
- [ ] CHECK constraint toevoegen op `lead_activities.type` met alle nieuwe types:
  - `phone_call`, `email_sent`, `whatsapp`, `meeting`, `status_change_contacted`, `note`, `created`, `message`, `status_changed`
- [ ] Migratie testen in Supabase SQL Editor
- [ ] Migratie uitvoeren

**SQL:**
```sql
-- Voeg CHECK constraint toe voor activity types
ALTER TABLE lead_activities 
ADD CONSTRAINT lead_activities_type_check 
CHECK (type IN (
  'phone_call',
  'email_sent',
  'whatsapp',
  'meeting',
  'status_change_contacted',
  'note',
  'created',
  'message',
  'status_changed'
));
```

---

### **STAP 2: Performance Triggers Helper**
**Bestand**: `lib/performanceTriggers.js` (NIEUW)

**Acties:**
- [ ] Functie `handleFirstContact(leadId, activityType)` - check of trigger al heeft gezet, anders handmatig
- [ ] Functie `handleWon(leadId, dealValue)` - update status + deal_value + log activity
- [ ] Functie `handleLost(leadId)` - update status + log activity
- [ ] Export alle functies

**Notitie**: `first_contact_at` trigger bestaat al, maar we checken voor zekerheid

---

### **STAP 3: Backend API Endpoints**
**Bestand**: `routes/dashboard.js`

#### **3.1 POST `/dashboard/api/leads/:id/message`** (NIEUW)
- [ ] Authenticatie check (`requireAuth`)
- [ ] Lead toegang check (user_id of assigned_to)
- [ ] Valideer: `message` (string, required), `channel` ('dashboard' | 'email' | 'whatsapp')
- [ ] Activity opslaan: `type = 'message'`, `description = message`, `metadata = { channel }`
- [ ] Als `channel = 'email'` → email template versturen
- [ ] Als `channel = 'whatsapp'` → WhatsApp template versturen
- [ ] Return success/error

#### **3.2 GET `/dashboard/api/leads/:id/activities`** (NIEUW)
- [ ] Authenticatie check
- [ ] Lead toegang check
- [ ] Haal alle activities op voor deze lead
- [ ] Join met `profiles` voor `created_by` user info (naam, email)
- [ ] Sorteer op `created_at DESC`
- [ ] Return JSON array

#### **3.3 POST `/dashboard/api/leads/:id/activity`** (UITBREIDEN)
- [ ] Bestaande endpoint behouden
- [ ] Nieuwe activity types ondersteunen
- [ ] Performance triggers aanroepen waar nodig

#### **3.4 PATCH `/dashboard/api/leads/:id/status`** (UITBREIDEN)
- [ ] Bestaande endpoint behouden
- [ ] `status = 'won'` → optioneel `deal_value` accepteren
- [ ] `status = 'lost'` → activity loggen
- [ ] Performance triggers aanroepen

---

### **STAP 4: Email & WhatsApp Templates**
**Bestanden**: 
- `templates/emails/lead_message.html` (NIEUW)
- WhatsApp template in `services/whatsappService.js` (UITBREIDEN)

**Acties:**
- [ ] Email template maken voor "Nieuw bericht van partner"
- [ ] Variabelen: `{{partner_name}}`, `{{message}}`, `{{lead_url}}`, `{{lead_name}}`
- [ ] WhatsApp template toevoegen (gebruik bestaande service)
- [ ] Integratie in message endpoint

---

### **STAP 5: Frontend - Lead Workspace Layout**
**Bestand**: `views/dashboard/lead-details.ejs` (VOLLEDIG OMBOUWEN)

#### **5.1 Lead Overview Card** (bovenaan)
- [ ] Naam, email, telefoon, WhatsApp link
- [ ] Status badge (new, accepted, in_progress, won, lost)
- [ ] Provincie, branche, lead prijs
- [ ] **Klant bericht** (message) - groot en duidelijk weergegeven
- [ ] Terug naar overzicht knop

#### **5.2 Chat Systeem** (links, 60% breedte)
- [ ] Chat container met scroll
- [ ] Message bubbles:
  - Partner berichten: rechts, blauw
  - Klant berichten: links, grijs (van lead.message)
  - Systeem berichten: gecentreerd, lichtgrijs
- [ ] Input veld onderaan:
  - Textarea voor bericht
  - Kanaal selector: "Dashboard", "E-mail", "WhatsApp"
  - Verzend knop
- [ ] Real-time updates (polling of event-based)

#### **5.3 Activity Timeline** (rechts, 40% breedte)
- [ ] Verticale tijdlijn
- [ ] Icons per activity type:
  - 📞 phone_call
  - 📧 email_sent
  - 💬 whatsapp
  - 📅 meeting
  - ✅ status_change_contacted
  - 📝 note
  - 💬 message
  - ➕ created
  - 🔄 status_changed
- [ ] Tijd + beschrijving
- [ ] Created_by naam (indien beschikbaar)
- [ ] Scroll container

#### **5.4 Actieknoppen** (onderaan, horizontaal)
- [ ] "Ik heb gebeld" → `phone_call`
- [ ] "WhatsApp gestuurd" → `whatsapp`
- [ ] "E-mail gestuurd" → `email_sent`
- [ ] "Afspraak ingepland" → `meeting` (met datum picker?)
- [ ] "Opdracht binnen" → `won` (met deal_value modal)
- [ ] "Geen opdracht" → `lost`
- [ ] Loading states
- [ ] Success/error feedback

#### **5.5 Styling**
- [ ] Gebruik bestaande dashboard CSS classes
- [ ] Consistent met huidige UI
- [ ] Responsive: op mobiel stacken
- [ ] Geen nieuwe styling library

---

### **STAP 6: Frontend JavaScript**
**Bestand**: `public/js/lead-details.js` (VOLLEDIG HERVORMEN)

**Acties:**
- [ ] Verwijder oude performance blok logica
- [ ] Chat functionaliteit:
  - [ ] Berichten ophalen via API
  - [ ] Bericht verzenden
  - [ ] Auto-refresh (polling elke 5 seconden)
  - [ ] Scroll naar beneden bij nieuwe berichten
- [ ] Timeline functionaliteit:
  - [ ] Activities ophalen via API
  - [ ] Renderen met icons
  - [ ] Auto-refresh
- [ ] Actieknoppen handlers:
  - [ ] API calls naar activity/status endpoints
  - [ ] Loading states
  - [ ] Success/error toasts
- [ ] Modal voor deal_value (bij "Opdracht binnen")

---

### **STAP 7: CSS Styling**
**Bestand**: `public/css/lead-workspace.css` (NIEUW) of inline in EJS

**Acties:**
- [ ] Chat bubble styling (partner rechts, klant links)
- [ ] Timeline styling (verticale lijst met icons)
- [ ] Actieknoppen styling
- [ ] Responsive breakpoints
- [ ] Consistent met dashboard styling

---

### **STAP 8: Oude Code Opruimen**
**Bestanden**: `views/dashboard/lead-details.ejs`, `public/js/lead-details.js`

**Acties:**
- [ ] Verwijder alle oude performance blokken (4 blokken)
- [ ] Verwijder oude styling voor performance blokken
- [ ] Verwijder oude JavaScript handlers
- [ ] Behoud alleen nieuwe workspace code

---

### **STAP 9: Testen**
**Acties:**
- [ ] Test alle activity types
- [ ] Test chat berichten (dashboard, email, WhatsApp)
- [ ] Test performance triggers (first_contact_at, won, lost)
- [ ] Test timeline rendering
- [ ] Test actieknoppen
- [ ] Test responsive layout
- [ ] Test error handling

---

### **STAP 10: Documentatie**
**Bestand**: Update `PARTNER_DASHBOARD_IMPLEMENTATION.md` of nieuwe doc

**Acties:**
- [ ] Documenteer nieuwe workspace layout
- [ ] Documenteer nieuwe API endpoints
- [ ] Documenteer activity types
- [ ] Documenteer performance triggers

---

## 📝 Bestanden Overzicht

### Nieuwe Bestanden:
1. `supabase/migrations/[timestamp]_add_lead_workspace_constraints.sql`
2. `lib/performanceTriggers.js`
3. `templates/emails/lead_message.html`
4. `public/css/lead-workspace.css` (optioneel, kan ook inline)

### Aangepaste Bestanden:
1. `routes/dashboard.js` - Nieuwe endpoints
2. `views/dashboard/lead-details.ejs` - Volledig ombouwen
3. `public/js/lead-details.js` - Volledig hervormen
4. `services/whatsappService.js` - Template toevoegen

---

## ⚠️ Belangrijke Notities

1. **First Contact Trigger**: Bestaat al, hoeven we niet aan te maken ✅
2. **Type Constraint**: Moet aangemaakt worden ❌
3. **Oude Performance Blokken**: Volledig verwijderen, geen fallback
4. **Styling**: Gebruik bestaande dashboard CSS, geen nieuwe library
5. **Activity Types**: Gebruik `created_by` (niet `partner_id`)
6. **Backward Compatibility**: Oude types (`created`, `status_changed`) blijven werken

---

## ✅ Klaar voor Implementatie

Wacht op "GO" van gebruiker voordat je begint met coderen.

