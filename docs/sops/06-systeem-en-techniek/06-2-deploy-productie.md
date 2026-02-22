# SOP 06.2 – Deploy naar productie

**Doel:** Checklist en stappen om de applicatie naar productie te deployen (code, database, env, verificatie).

**Doelgroep:** Developers / DevOps.

---

## Pre-deploy checklist

### Code

- [ ] Migraties lokaal getest
- [ ] Environment variables gedocumenteerd
- [ ] Geen debugcode of console.logs in productiepaden
- [ ] Foutafhandeling getest

### Database

- [ ] Alle migraties toegepast op productiedatabase
- [ ] RLS-policies gecontroleerd
- [ ] Indexen aanwezig
- [ ] Backup gemaakt (bij update van bestaande DB)

### Omgeving

- [ ] Productie-env-variabelen gezet (Supabase, Mollie, OpenAI, enz.)
- [ ] HTTPS en domein geconfigureerd

### Testen

- [ ] Lokaal getest
- [ ] Auth-flow getest
- [ ] Betalingsflow getest (testmodus)
- [ ] Kritieke user flows getest

---

## Stappen

### 1. Code voorbereiden

```bash
git checkout main
git pull origin main
git status   # geen uncommitted changes
```

### 2. Database-migraties

- **Supabase CLI:** `supabase link --project-ref <prod-ref>` → `supabase db push`
- **Of:** SQL Editor in Supabase Dashboard; migraties chronologisch uitvoeren

### 3. Environment variables

- **Vercel:** Project Settings → Environment Variables
- **Andere hosting:** volgens platform (Heroku config, .env op server, enz.)
- Zie [SOP 06.1 – Local setup](06-1-local-setup.md) voor de lijst; productie-URL’s en -keys gebruiken.

### 4. Applicatie deployen

- **Vercel:** `git push` naar gekoppelde branch (zie `VERCEL_DEPLOYMENT_CHECKLIST.md`)
- **Server:** `git pull`, `npm install --production`, restart (pm2/systemd/docker)

### 5. Verifiëren

- Health/API: `curl https://your-domain.com/api/health` (of vergelijkbaar)
- Login/signup testen
- Kritieke flows (lead, betaling) spotchecken
- Logs controleren (eerste uren)

---

## Rollback

- **Code:** revert commit, push, herdeploy.
- **Database:** alleen rollback als er rollback-SQL is; anders handmatig terugdraaien met voorzichtigheid.
- **App:** vorige versie opnieuw deployen of container/image terugzetten.

---

## Security

- [ ] `SESSION_SECRET` sterk en uniek
- [ ] Service role key nooit in frontend
- [ ] HTTPS aan
- [ ] .env niet in repo

---

**Gerelateerd:** `docs/05-runbooks/deploy.md`, `VERCEL_DEPLOYMENT_CHECKLIST.md`, [SOP 06.1 – Local setup](06-1-local-setup.md), [SOP 06.4 – Backups](06-4-backups.md)
