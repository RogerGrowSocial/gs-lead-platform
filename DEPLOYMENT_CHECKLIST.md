# Deployment Checklist

Gebruik deze checklist voor elke deployment naar productie.

---

## 📋 Pre-Deployment

### Code
- [ ] Alle wijzigingen zijn getest lokaal
- [ ] Geen `console.log()` statements in productie code
- [ ] Geen debug code of test endpoints
- [ ] Code is gecommit en gepusht naar GitHub
- [ ] `.env` staat in `.gitignore` (niet gecommit!)

### Database
- [ ] Alle migrations zijn getest lokaal
- [ ] Migrations zijn uitgevoerd in productie Supabase
- [ ] Database backup is gemaakt (indien nodig)
- [ ] RLS policies zijn gecontroleerd

### Environment Variables
- [ ] Alle vereiste environment variables zijn ingesteld in Vercel
- [ ] `SUPABASE_URL` wijst naar productie project
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is productie key
- [ ] `APP_URL` en `BASE_URL` zijn correct (https://)
- [ ] `SESSION_SECRET` is sterk random string
- [ ] Optionele API keys zijn ingesteld (indien gebruikt)

---

## 🚀 Deployment

### Vercel
- [ ] Project is gekoppeld aan GitHub repository
- [ ] Automatische deployments zijn actief
- [ ] Laatste deployment is succesvol
- [ ] Geen errors in Vercel logs

### Supabase
- [ ] Productie project is actief (niet paused)
- [ ] Database migrations zijn uitgevoerd
- [ ] RLS policies zijn actief
- [ ] Database backups zijn geconfigureerd

### Domein
- [ ] DNS records zijn correct geconfigureerd
- [ ] SSL certificaat is actief (automatisch via Vercel)
- [ ] Domein wijst naar juiste Vercel deployment
- [ ] `APP_URL` en `BASE_URL` zijn bijgewerkt naar eigen domein

---

## ✅ Post-Deployment Verification

### Basis Functionaliteit
- [ ] Homepage laadt zonder errors
- [ ] Geen console errors in browser
- [ ] Static files (CSS, JS, images) laden correct
- [ ] API endpoints reageren correct

### Authentication
- [ ] Signup flow werkt
- [ ] Login flow werkt
- [ ] Logout werkt
- [ ] Session blijft behouden na page refresh
- [ ] Nieuwe users worden aangemaakt in Supabase

### Database
- [ ] Database connectie werkt
- [ ] Queries werken zonder errors
- [ ] RLS policies werken correct
- [ ] Admin routes zijn beschermd

### Integrations (indien gebruikt)
- [ ] Mollie payments werken (test eerst in test mode!)
- [ ] OpenAI API werkt (indien gebruikt)
- [ ] Google Ads API werkt (indien gebruikt)
- [ ] Email sending werkt (indien gebruikt)
- [ ] WhatsApp messaging werkt (indien gebruikt)

### Performance
- [ ] Pagina's laden snel (< 3 seconden)
- [ ] Geen memory leaks
- [ ] Database queries zijn geoptimaliseerd

---

## 🔐 Security Check

- [ ] HTTPS is actief (check browser padlock)
- [ ] `SESSION_SECRET` is sterk en uniek
- [ ] Service role key is alleen in environment variables
- [ ] Geen API keys in code of logs
- [ ] Admin routes vereisen authenticatie
- [ ] CORS is correct geconfigureerd
- [ ] Rate limiting is actief (indien nodig)

---

## 📊 Monitoring Setup

- [ ] Vercel Analytics is geactiveerd (optioneel)
- [ ] Error tracking is geconfigureerd
- [ ] Logs worden gemonitord
- [ ] Database usage wordt gemonitord
- [ ] Alerts zijn ingesteld (indien mogelijk)

---

## 📝 Documentation

- [ ] Deployment guide is bijgewerkt
- [ ] Environment variables zijn gedocumenteerd
- [ ] API endpoints zijn gedocumenteerd
- [ ] Troubleshooting guide is beschikbaar

---

## 🆘 Rollback Plan

- [ ] Vorige deployment is bekend
- [ ] Rollback procedure is gedocumenteerd
- [ ] Database rollback SQL is voorbereid (indien nodig)
- [ ] Team weet hoe te rollbacken

---

## ✅ Final Check

- [ ] Alle bovenstaande items zijn gecontroleerd
- [ ] Team is geïnformeerd over deployment
- [ ] Monitoring is actief voor eerste 24 uur
- [ ] Support contact is beschikbaar

---

**Datum:** _______________
**Deployed door:** _______________
**Versie:** _______________
**Notes:** _______________
