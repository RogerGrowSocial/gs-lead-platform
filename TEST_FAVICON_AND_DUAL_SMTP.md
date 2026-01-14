# Test Plan: Favicon en Dual SMTP Password Recovery

## 🎯 Wat Testen We?

1. **Favicon** - Verschijnt op alle pagina's
2. **Dual SMTP Password Recovery** - Interne emails via Mijndomein, externe via Mailgun

---

## ✅ Test 1: Favicon

### Stap 1: Check Favicon in Browser

1. **Open je platform** in browser: `https://app.growsocialmedia.nl`
2. **Check browser tab** - Zie je de favicon?
3. **Test verschillende pagina's:**
   - Login pagina (`/login`)
   - Dashboard (`/dashboard`)
   - Admin pagina (`/admin`)
   - Landing pages
   - Error pages (404, 500)

**Verwacht:**
- ✅ Favicon verschijnt in browser tab
- ✅ Favicon verschijnt op alle pagina's

---

### Stap 2: Check Favicon Route

1. **Ga direct naar favicon URL:**
   ```
   https://app.growsocialmedia.nl/favicon.ico
   ```
2. **Check of favicon wordt geladen**

**Verwacht:**
- ✅ Favicon wordt geladen (niet 404)
- ✅ Content-Type is `image/webp`

---

### Stap 3: Check Browser Console

1. **Open browser Developer Tools** (F12)
2. **Ga naar Network tab**
3. **Refresh pagina**
4. **Zoek naar `favicon.ico` request**

**Verwacht:**
- ✅ Request status: 200 (niet 404 of 204)
- ✅ Content-Type: `image/webp`
- ✅ File wordt geladen

---

## ✅ Test 2: Dual SMTP Password Recovery

### Belangrijk: Check Environment Variables Eerst

**Zorg dat deze variabelen in je `.env` staan (lokaal) of in Vercel Environment Variables (productie):**

```env
# Mijndomein SMTP (voor interne emails)
MIJNDOMEIN_SMTP_HOST=mail.mijndomein.nl
MIJNDOMEIN_SMTP_PORT=587
MIJNDOMEIN_SMTP_USER=noreply@growsocialmedia.nl
MIJNDOMEIN_SMTP_PASS=je_mijndomein_password
MIJNDOMEIN_EMAIL_FROM=noreply@growsocialmedia.nl

# Internal domain detection
INTERNAL_EMAIL_DOMAIN=growsocialmedia.nl
```

**⚠️ BELANGRIJK:**
- Als je lokaal test: Herstart je server na `.env` wijzigingen
- Als je op productie test: Check Vercel Environment Variables

---

### Test 2A: Interne Email (serve@growsocialmedia.nl)

**Doel:** Testen of interne emails via Mijndomein SMTP worden verstuurd

**Stappen:**

1. **Ga naar password recovery pagina:**
   ```
   https://app.growsocialmedia.nl/forgot-password
   ```

2. **Vul interne email in:**
   ```
   serve@growsocialmedia.nl
   ```

3. **Klik "Reset link versturen"**

4. **Check server logs** (lokaal of Vercel logs):

   **Verwacht in logs:**
   ```
   📧 Internal email detected (serve@growsocialmedia.nl), using dual SMTP...
   📧 Email Service Configuration (Mijndomein):
      Host: mail.mijndomein.nl
      Port: 587
      User: noreply@growsocialmedia.nl...
      Password: SET (X chars)
      From: noreply@growsocialmedia.nl
      To: serve@growsocialmedia.nl
      Internal: Yes
   🔍 Verifying SMTP connection...
   ✅ SMTP connection verified
   📤 Attempting to send email...
   ✅ Email sent successfully
   ✅ Email verzonden via Mijndomein SMTP (interne email)
   ```

5. **Check inbox:**
   - Open `serve@growsocialmedia.nl` inbox
   - Check of password reset email is ontvangen
   - Check spam folder indien nodig

**Verwacht Resultaat:**
- ✅ Server logs tonen "Mijndomein" als provider
- ✅ Server logs tonen "Internal: Yes"
- ✅ Email wordt ontvangen in inbox
- ✅ Email bevat werkende reset link

---

### Test 2B: Externe Email (bijv. Gmail)

**Doel:** Testen of externe emails via Mailgun SMTP worden verstuurd

**Stappen:**

1. **Ga naar password recovery pagina:**
   ```
   https://app.growsocialmedia.nl/forgot-password
   ```

2. **Vul extern email in** (bijv. Gmail):
   ```
   jouw.email@gmail.com
   ```

3. **Klik "Reset link versturen"**

4. **Check server logs:**

   **Verwacht in logs:**
   ```
   📧 External email detected (jouw.email@gmail.com), using Supabase SMTP...
   ```

5. **Check Supabase Logs:**
   - Ga naar Supabase Dashboard → Logs → Auth Logs
   - Zoek naar password recovery event
   - Check status: `200` (success)

6. **Check Mailgun Logs:**
   - Ga naar Mailgun Dashboard → Sending → Logs
   - Zoek naar email naar Gmail adres
   - Check event: `accepted` of `delivered`

7. **Check inbox:**
   - Open Gmail inbox
   - Check of password reset email is ontvangen
   - Check spam folder indien nodig

**Verwacht Resultaat:**
- ✅ Server logs tonen "External email detected"
- ✅ Supabase log toont `200` status
- ✅ Mailgun log toont `accepted` of `delivered`
- ✅ Email wordt ontvangen in inbox
- ✅ Email bevat werkende reset link

---

## 🔍 Troubleshooting

### Probleem: Favicon Verschijnt Niet

**Check:**
1. Bestand bestaat: `/public/img/favicon-growsocial.webp`
2. Browser cache: Hard refresh (Ctrl+Shift+R of Cmd+Shift+R)
3. Browser console: Check voor 404 errors
4. Network tab: Check favicon request status

**Fix:**
- Clear browser cache
- Check of bestand bestaat op server
- Check server logs voor favicon route

---

### Probleem: Interne Email Komt Niet Aan

**Check Server Logs:**
1. Zie je `"📧 Internal email detected"`?
2. Zie je `"Email Service Configuration (Mijndomein)"`?
3. Zie je SMTP connection errors?

**Check Environment Variables:**
1. Zijn `MIJNDOMEIN_SMTP_*` variabelen gezet?
2. Is `INTERNAL_EMAIL_DOMAIN` gezet?
3. Is server herstart na `.env` wijzigingen?

**Fix:**
- Check Mijndomein SMTP credentials
- Verifieer environment variables
- Herstart server
- Check Mijndomein SMTP server bereikbaarheid

---

### Probleem: Externe Email Komt Niet Aan

**Check:**
1. Server logs: Zie je `"📧 External email detected"`?
2. Supabase logs: Check Auth Logs voor errors
3. Mailgun logs: Check delivery status

**Fix:**
- Check Supabase SMTP configuratie
- Check Mailgun domain status
- Check Mailgun logs voor bounce/failure events

---

## 📋 Test Checklist

### Favicon
- [ ] Favicon verschijnt in browser tab
- [ ] Favicon verschijnt op login pagina
- [ ] Favicon verschijnt op dashboard
- [ ] Favicon verschijnt op admin pagina
- [ ] Favicon route werkt (`/favicon.ico`)
- [ ] Geen 404 errors in console

### Dual SMTP Password Recovery
- [ ] Environment variables zijn geconfigureerd
- [ ] Server is herstart (indien lokaal)
- [ ] Test interne email: `serve@growsocialmedia.nl`
- [ ] Server logs tonen "Mijndomein" voor interne email
- [ ] Interne email wordt ontvangen
- [ ] Test externe email: Gmail of ander extern adres
- [ ] Server logs tonen "External" voor externe email
- [ ] Externe email wordt ontvangen
- [ ] Reset links werken correct

---

## 🎯 Quick Test Commands

### Test Favicon Route (lokaal)
```bash
curl -I http://localhost:3000/favicon.ico
```

**Verwacht:**
```
HTTP/1.1 200 OK
Content-Type: image/webp
```

### Test Password Recovery (lokaal)
```bash
# Check server logs terwijl je password recovery test
# Je zou moeten zien:
# - "Internal email detected" voor @growsocialmedia.nl
# - "External email detected" voor andere domains
```

---

## ✅ Success Criteria

**Favicon:**
- ✅ Verschijnt op alle pagina's
- ✅ Geen 404 errors
- ✅ Correct content-type

**Dual SMTP:**
- ✅ Interne emails gebruiken Mijndomein SMTP
- ✅ Externe emails gebruiken Mailgun SMTP (via Supabase)
- ✅ Alle emails worden correct afgeleverd
- ✅ Reset links werken

---

**Laatste update**: January 2025
