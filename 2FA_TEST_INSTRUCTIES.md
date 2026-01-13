# 2FA Test Instructies

## ✅ Setup Voltooid

De 2FA implementatie is nu compleet! Hieronder staat hoe je het kunt testen.

## 🧪 Test Stappen

### 1. Start de Applicatie
Zorg dat je server draait:
```bash
npm run dev
```

### 2. Ga naar Security Settings
- Log in met een gebruiker account
- Navigeer naar: `/dashboard/settings/security`

### 3. Activeer 2FA
1. Klik op **"Bewerken"** bij "Twee-stapsverificatie"
2. Er wordt automatisch een QR-code geladen
3. Open een authenticator app op je telefoon (bijv. Google Authenticator, Authy, Microsoft Authenticator)
4. Scan de QR-code met de app
5. Voer de 6-cijferige code in die de app toont
6. Klik op **"Verifiëren en activeren"**
7. Na succesvolle verificatie wordt 2FA ingeschakeld

### 4. Test Uitschakelen
1. Als 2FA actief is, klik op **"Bewerken"** bij 2FA
2. Voer je wachtwoord in
3. Klik op **"2FA uitschakelen"**
4. 2FA wordt uitgeschakeld

## 🔍 Wat er gebeurt:

### Backend Routes:
- `GET /dashboard/settings/two-factor/secret` - Genereert TOTP secret en QR-code
- `POST /dashboard/settings/two-factor/verify` - Verifieert code en activeert 2FA
- `POST /dashboard/settings/two-factor/disable` - Deactiveert 2FA (met wachtwoord)

### Database:
- De `two_factor_secret` wordt opgeslagen in de `settings` tabel
- De secret wordt alleen opgeslagen na succesvolle verificatie

### Frontend:
- QR-code wordt automatisch geladen bij "Bewerken"
- Verificatie gebeurt via AJAX
- Success/error meldingen worden getoond

## 📱 Authenticator Apps:

Je kunt een van deze apps gebruiken:
- **Google Authenticator** (iOS/Android)
- **Authy** (iOS/Android/Desktop)
- **Microsoft Authenticator** (iOS/Android)
- **1Password** (met TOTP support)

## ⚠️ Troubleshooting

### QR-code wordt niet geladen?
- Check browser console voor errors
- Check of `/dashboard/settings/two-factor/secret` route werkt
- Check of `speakeasy` en `qrcode` packages zijn geïnstalleerd

### Verificatie faalt?
- Zorg dat je systeemklok gesynchroniseerd is (TOTP is tijd-afhankelijk)
- Probeer een nieuwe code (codes verversen elke 30 seconden)
- Check server logs voor errors

### Database errors?
- Zorg dat de `settings` tabel bestaat en de `two_factor_secret` kolom heeft
- Check of `supabaseAdmin` correct is geconfigureerd

## 🎉 Klaar!

Als alles werkt, kun je nu 2FA gebruiken om je account extra te beveiligen!

