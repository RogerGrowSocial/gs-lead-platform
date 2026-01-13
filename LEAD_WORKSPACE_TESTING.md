# Lead Workspace - Testinstructie

## 📋 Voorbereiding

### 1. Database Migratie Uitvoeren
Voer eerst de migratie uit in Supabase SQL Editor:

```sql
-- Kopieer en plak de volledige inhoud van:
-- supabase/migrations/20251118205427_add_lead_workspace_constraints.sql
```

**Verwachte resultaat:**
- Test activiteiten met ongeldige types worden verwijderd
- CHECK constraint wordt toegevoegd met alle 13 geldige activity types

---

## 🧪 Test Stappen

### **TEST 1: Lead Workspace Layout**

1. **Navigeer naar een lead:**
   - Ga naar `/dashboard/leads`
   - Klik op een lead om naar `/dashboard/leads/:id` te gaan

2. **Verifieer Lead Overview Card:**
   - ✅ Naam van lead wordt getoond
   - ✅ Email, telefoon, WhatsApp link aanwezig
   - ✅ Status badge correct weergegeven
   - ✅ Provincie, branche, lead prijs zichtbaar
   - ✅ **Klant bericht** wordt groot en duidelijk getoond (in grijze box met oranje border)

3. **Verifieer Chat Systeem (links):**
   - ✅ Chat container zichtbaar (60% breedte)
   - ✅ Klant bericht staat links (grijs)
   - ✅ Input veld onderaan aanwezig
   - ✅ Geen kanaal selector meer (verwijderd)
   - ✅ Placeholder tekst: "Typ je bericht... (klant ontvangt automatisch e-mail en WhatsApp notificatie)"

4. **Verifieer Activity Timeline (rechts):**
   - ✅ Timeline container zichtbaar (40% breedte)
   - ✅ "Activiteiten" header aanwezig
   - ✅ Activities worden geladen met icons

5. **Verifieer Actieknoppen (onderaan):**
   - ✅ 6 actieknoppen horizontaal:
     - "Ik heb gebeld"
     - "WhatsApp gestuurd"
     - "E-mail gestuurd"
     - "Afspraak ingepland"
     - "Opdracht binnen"
     - "Geen opdracht"

---

### **TEST 2: Chat Bericht Verzenden**

1. **Stuur een test bericht:**
   - Typ een bericht in het chat input veld
   - Klik op verzend knop (of druk Enter)

2. **Verifieer in Chat:**
   - ✅ Bericht verschijnt rechts (partner bericht, oranje)
   - ✅ Tijd wordt getoond
   - ✅ Chat scrollt automatisch naar beneden

3. **Verifieer in Timeline:**
   - ✅ Nieuwe activity verschijnt met type "message"
   - ✅ Icon wordt getoond
   - ✅ Beschrijving = bericht tekst
   - ✅ Tijd + sender naam zichtbaar

4. **Verifieer Email Notificatie:**
   - Check email inbox van de lead (lead.email)
   - ✅ Email ontvangen met subject: "Nieuw bericht van [Partner Naam]"
   - ✅ Email template correct gerenderd
   - ✅ Link naar dashboard werkt

5. **Verifieer WhatsApp Notificatie:**
   - Check WhatsApp van de lead (lead.phone)
   - ✅ WhatsApp bericht ontvangen
   - ✅ Bericht bevat: partner naam, message tekst, dashboard link

6. **Check Server Logs:**
   - ✅ Console log: "📧 Email notification sent to customer: [email]"
   - ✅ Console log: "💬 WhatsApp notification sent to customer: [phone]"

---

### **TEST 3: Activity Types**

Test alle actieknoppen:

1. **"Ik heb gebeld":**
   - ✅ Klik knop
   - ✅ Externe link opent (tel: link)
   - ✅ Activity wordt opgeslagen met type `phone_call`
   - ✅ Timeline update
   - ✅ `first_contact_at` wordt gezet (als eerste contact)

2. **"WhatsApp gestuurd":**
   - ✅ Klik knop
   - ✅ Externe link opent (wa.me link)
   - ✅ Activity wordt opgeslagen met type `whatsapp`
   - ✅ Timeline update
   - ✅ `first_contact_at` wordt gezet (als eerste contact)

3. **"E-mail gestuurd":**
   - ✅ Klik knop
   - ✅ Externe link opent (mailto: link)
   - ✅ Activity wordt opgeslagen met type `email_sent`
   - ✅ Timeline update
   - ✅ `first_contact_at` wordt gezet (als eerste contact)

4. **"Afspraak ingepland":**
   - ✅ Klik knop
   - ✅ Activity wordt opgeslagen met type `meeting`
   - ✅ Timeline update

5. **"Opdracht binnen":**
   - ✅ Klik knop
   - ✅ Modal opent voor deal_value
   - ✅ Voer bedrag in (bijv. 1500.00)
   - ✅ Klik "Opslaan"
   - ✅ Lead status wordt `won`
   - ✅ `deal_value` wordt opgeslagen
   - ✅ Activity wordt gelogd
   - ✅ Page reload toont nieuwe status

6. **"Geen opdracht":**
   - ✅ Klik knop
   - ✅ Confirm dialog verschijnt
   - ✅ Bevestig
   - ✅ Lead status wordt `lost`
   - ✅ Activity wordt gelogd
   - ✅ Page reload toont nieuwe status

---

### **TEST 4: Auto-Refresh (Polling)**

1. **Open twee browser tabs:**
   - Tab 1: Lead detail pagina
   - Tab 2: Lead detail pagina (zelfde lead)

2. **Stuur bericht in Tab 1:**
   - ✅ Tab 2 update automatisch binnen 5 seconden
   - ✅ Chat messages verschijnen
   - ✅ Timeline update

3. **Test Activity in Tab 1:**
   - ✅ Klik "Ik heb gebeld"
   - ✅ Tab 2 update automatisch binnen 5 seconden

---

### **TEST 5: Notification Badge**

1. **Check User Dropdown:**
   - ✅ Klik op user avatar rechtsboven
   - ✅ Dropdown menu opent
   - ✅ "Aanvragen" menu item staat bovenaan
   - ✅ Badge is zichtbaar (als er unread messages zijn)

2. **Test Badge Count:**
   - ✅ Als er geen unread messages zijn: badge is hidden
   - ✅ Als er unread messages zijn: badge toont aantal
   - ✅ Badge is rond met oranje achtergrond

3. **Test Badge Auto-Refresh:**
   - ✅ Badge wordt elke 30 seconden ververst
   - ✅ Check browser console voor API calls

4. **Test Badge API:**
   - Open browser console
   - Ga naar: `/dashboard/api/leads/unread-messages-count`
   - ✅ Response: `{ success: true, count: X }`

---

### **TEST 6: Performance Triggers**

1. **Test First Contact:**
   - Maak een nieuwe lead aan (of gebruik bestaande zonder `first_contact_at`)
   - ✅ Klik "Ik heb gebeld" (of andere contact knop)
   - ✅ Check database: `leads.first_contact_at` is gezet
   - ✅ Lead overview card toont "Eerste contact" datum

2. **Test Won Status:**
   - ✅ Klik "Opdracht binnen"
   - ✅ Voer deal_value in (bijv. 2000)
   - ✅ Check database:
     - `leads.status = 'won'`
     - `leads.deal_value = 2000`
     - Activity gelogd met type `status_changed`

3. **Test Lost Status:**
   - ✅ Klik "Geen opdracht"
   - ✅ Check database:
     - `leads.status = 'lost'`
     - Activity gelogd met type `status_changed`

---

### **TEST 7: Error Handling**

1. **Test zonder email:**
   - Gebruik lead zonder email
   - ✅ Stuur chat bericht
   - ✅ Email wordt overgeslagen (geen error)
   - ✅ WhatsApp wordt wel verstuurd (als phone bestaat)

2. **Test zonder telefoon:**
   - Gebruik lead zonder telefoon
   - ✅ Stuur chat bericht
   - ✅ WhatsApp wordt overgeslagen (geen error)
   - ✅ Email wordt wel verstuurd (als email bestaat)

3. **Test invalid lead ID:**
   - Navigeer naar `/dashboard/leads/invalid-id`
   - ✅ 404 error page wordt getoond

4. **Test unauthorized access:**
   - Probeer lead te bekijken die niet aan jou is toegewezen
   - ✅ 403 error page wordt getoond

---

### **TEST 8: Responsive Layout**

1. **Test op mobiel (< 1024px):**
   - ✅ Chat en Timeline stacken verticaal
   - ✅ Actieknoppen blijven horizontaal (wrap indien nodig)

2. **Test op desktop (> 1024px):**
   - ✅ Chat (60%) en Timeline (40%) naast elkaar
   - ✅ Layout blijft stabiel

---

## 🔍 Debugging Tips

### Check Server Logs:
```bash
# In terminal waar server draait, zie je:
📧 Email notification sent to customer: [email]
💬 WhatsApp notification sent to customer: [phone]
✅ [LEAD DETAILS] Lead found: { leadId, leadName }
```

### Check Browser Console:
- Open DevTools (F12)
- Check Console tab voor errors
- Check Network tab voor API calls:
  - `POST /dashboard/api/leads/:id/message`
  - `GET /dashboard/api/leads/:id/activities`
  - `GET /dashboard/api/leads/unread-messages-count`

### Check Database:
```sql
-- Check activities
SELECT * FROM lead_activities 
WHERE lead_id = '[LEAD_ID]' 
ORDER BY created_at DESC;

-- Check lead status
SELECT id, name, status, first_contact_at, deal_value 
FROM leads 
WHERE id = '[LEAD_ID]';
```

---

## ✅ Checklist

- [ ] Database migratie uitgevoerd
- [ ] Lead workspace layout zichtbaar
- [ ] Chat bericht verzenden werkt
- [ ] Email notificatie ontvangen
- [ ] WhatsApp notificatie ontvangen
- [ ] Activity timeline update
- [ ] Alle actieknoppen werken
- [ ] Performance triggers werken (first_contact_at, won, lost)
- [ ] Auto-refresh werkt (polling)
- [ ] Notification badge werkt
- [ ] Responsive layout werkt
- [ ] Error handling werkt

---

## 🐛 Bekende Issues / TODO's

1. **Twilio Templates:** Nog niet geïmplementeerd (wachten op verificatie)
   - Template IDs klaar: `new_message_notification_customer` (HX33255914ca1fae10058eb2cffd333e77)
   - Template IDs klaar: `new_message_notification_partner` (HXd4f0c105acb0860602541ab886eb8caf)

2. **Unread Messages Tracking:** Gebruikt nu laatste 7 dagen, kan later uitgebreid worden met `last_checked_at` per lead per user

3. **Customer -> Partner Messages:** Nog niet geïmplementeerd (alleen partner->customer werkt nu)

---

## 📞 Hulp Nodig?

Als iets niet werkt:
1. Check server logs voor errors
2. Check browser console voor JavaScript errors
3. Check database voor data
4. Check Supabase logs voor RLS issues

