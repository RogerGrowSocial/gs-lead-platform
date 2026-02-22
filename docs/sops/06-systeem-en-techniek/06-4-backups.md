# SOP 06.4 – Backups (Supabase en Vercel)

**Doel:** Database- en deployment-backups maken en bewaren.

**Doelgroep:** Developers / systeembeheer.

---

## Supabase (database)

### Automatisch

- Supabase maakt dagelijks automatische backups (Free: 7 dagen, Pro: 30 dagen).
- Locatie: Dashboard → Project Settings → Database → Backups.

### Handmatige backup

**Optie 1 – Dashboard**

- Project Settings → Database → Backups → Create backup (indien beschikbaar) of bestaande backup downloaden.

**Optie 2 – Supabase CLI**

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql
```

**Optie 3 – pg_dump**

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.[ref].supabase.co:5432/postgres" > backup-$(date +%Y%m%d).sql
gzip backup-$(date +%Y%m%d).sql
```

- Wachtwoord en URL uit Supabase Dashboard (Database connection string); nooit in repo plaatsen.

### Script (dagelijks)

- Zie `BACKUP_GUIDE.md` voor een voorbeeldscript met `SUPABASE_DB_PASSWORD` uit env; backup naar `./backups/supabase/` met datum in bestandsnaam.

---

## Vercel (code / deployments)

- **Code:** in Git; elke push is een vorm van backup; tags/releases voor belangrijke versies.
- **Deployments:** Vercel bewaart deployment-history; eerdere deployment kan worden hersteld via dashboard.
- **Environment variables:** elders (bijv. password manager of secure doc) documenteren; niet alleen in Vercel vertrouwen voor lange termijn.

---

## Retentie en veiligheid

- Backups buiten de productie-omgeving bewaren (andere bucket/disk).
- Toegang tot backup-bestanden beperken; DB-URL/wachtwoord nooit in repo.

---

**Gerelateerd:** `BACKUP_GUIDE.md`, [SOP 06.2 – Deploy](06-2-deploy-productie.md)
