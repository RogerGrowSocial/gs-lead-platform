# WhatsApp Setup - Huidige Status

## ✅ Voltooid:
- [x] Database kolom `whatsapp_notification_enabled` bestaat al
- [x] Code is geïmplementeerd
- [x] WhatsApp service is klaar

## 📋 Volgende Stappen:

### Nu direct te doen:

**Stap 1: Meta Business Account Setup**
1. Ga naar: https://business.facebook.com
2. Maak account aan of log in
3. Maak WhatsApp Business Account aan
4. Voeg telefoonnummer toe (verificatie nodig)

**Stap 2: Meta for Developers**
1. Ga naar: https://developers.facebook.com
2. Klik "My Apps" > "Create App"
3. Kies "Business" als type
4. Voeg "WhatsApp" product toe
5. Koppel je WhatsApp Business Account
6. Ga naar WhatsApp > API Setup
7. **BELANGRIJK:** Kopieer deze 2 dingen:
   - Access Token (begint met "EAA...")
   - Phone Number ID (lang nummer)

**Stap 3: Environment Variables**
Voeg toe aan `.env`:
```bash
WHATSAPP_ACCESS_TOKEN=je_token_hier
WHATSAPP_PHONE_NUMBER_ID=je_id_hier
WHATSAPP_API_VERSION=v21.0
WHATSAPP_TEMPLATE_ID=new_lead_notification
```

**Stap 4: Template Aanmaken**
1. Ga naar WhatsApp > Message Templates
2. Create Template:
   - Naam: `new_lead_notification`
   - Categorie: UTILITY
   - Taal: Nederlands
   - Tekst: Zie `WHATSAPP_STAP_VOOR_STAP.md`
3. Submit (wacht 1-2 dagen op goedkeuring)

---

**Tijd:** ~2 uur setup + 1-2 dagen wachten op template goedkeuring

Wil je hulp bij een specifieke stap?

