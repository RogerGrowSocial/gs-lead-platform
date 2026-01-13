# 🔒 Veilige SEPA Mandate Implementatie

## 🚨 Probleem Opgelost

Het oude systeem was **zeer onveilig** omdat gebruikers zomaar een IBAN konden invullen en het mandaat konden accepteren zonder bankverificatie. Dit betekende dat iedereen incasso's kon laten uitvoeren op willekeurige rekeningen.

## ✅ Nieuwe Veilige Oplossing

### **SEPA Mandate via iDEAL Verificatie**

De nieuwe implementatie gebruikt **iDEAL betalingen** voor mandate verificatie:

1. **Gebruiker vult IBAN in** → Frontend valideert format
2. **Gebruiker klikt "incasso accepteren"** → Wordt doorgestuurd naar iDEAL
3. **Bankverificatie** → Gebruiker moet betaling bevestigen via zijn bankapp
4. **Mandate aanmaak** → Pas na succesvolle betaling wordt het mandaat aangemaakt
5. **Webhook verwerking** → Systeem verwerkt de verificatie automatisch

## 🔧 Technische Implementatie

### **Nieuwe API Endpoints:**

- `POST /api/payments/methods/sepa-mandate-ideal` - Creëert iDEAL betaling voor verificatie
- `POST /api/webhooks/mollie/mandate` - Verwerkt mandate verificatie webhook

### **Database Wijzigingen:**

- `pending_mandates` tabel voor tijdelijke opslag tijdens verificatie
- RLS policies voor beveiliging

### **Frontend Wijzigingen:**

- Button toont loading state tijdens verificatie
- Redirect naar iDEAL betalingspagina
- Betere error handling

## 🛡️ Beveiligingsvoordelen

1. **Bankverificatie vereist** - Alleen echte rekeninghouder kan mandaat afgeven
2. **Minimale betaling** - €0.01 voor verificatie (geen echte kosten)
3. **Webhook verificatie** - Mollie bevestigt succesvolle betaling
4. **Tijdelijke opslag** - Pending mandates worden automatisch opgeruimd

## 📋 Implementatie Checklist

- [x] Nieuwe API endpoint voor iDEAL verificatie
- [x] Webhook handler voor mandate verwerking  
- [x] Database migratie voor pending_mandates
- [x] Frontend updates voor nieuwe flow
- [x] Error handling en loading states
- [ ] Testen van de nieuwe flow
- [ ] Oude onveilige endpoint deprecaten

## 🧪 Testing

### **Test Flow:**

1. Ga naar `/dashboard/payments`
2. Vul IBAN en rekeninghouder in
3. Klik "incasso accepteren"
4. Wordt doorgestuurd naar iDEAL
5. Bevestig betaling in bankapp
6. Wordt teruggeleid naar dashboard
7. Mandate is automatisch aangemaakt

### **Verwachte Resultaten:**

- ✅ Gebruiker wordt naar bank gestuurd
- ✅ Betaling van €0.01 wordt verwerkt
- ✅ Mandate wordt aangemaakt na verificatie
- ✅ Gebruiker ziet successmelding
- ✅ Payment method wordt getoond in dashboard

## 🚀 Deployment

1. **Database migratie uitvoeren:**
   ```sql
   -- Run create_pending_mandates_table.sql
   ```

2. **Mollie webhook configureren:**
   - URL: `https://yourdomain.com/api/webhooks/mollie/mandate`
   - Events: `payment.status.changed`

3. **Environment variabelen:**
   - `BASE_URL` moet correct zijn ingesteld voor redirects

## 📝 Notities

- Oude endpoint `/api/payments/methods/sepa-mandate` is gemarkeerd als DEPRECATED
- Nieuwe endpoint gebruikt `sepa-mandate-ideal` voor duidelijkheid
- Alle logs hebben 🔒 prefix voor veiligheidsgerelateerde acties
- Pending mandates worden automatisch opgeruimd na 24 uur
