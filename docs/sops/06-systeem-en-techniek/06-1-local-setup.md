# SOP 06.1 – Local development setup

**Doel:** De codebase lokaal draaien: repository, dependencies, environment, database en dev-server.

**Doelgroep:** Developers.

---

## Vereisten

- **Node.js** v18+
- **npm** v9+
- **Git**
- **Supabase-account** (cloud of lokaal)

---

## Stap 1: Repository

```bash
git clone [repository-url]
cd gs-lead-platform
```

---

## Stap 2: Dependencies

```bash
npm install
```

---

## Stap 3: Environment variables

1. Kopieer `.env.example` naar `.env` (of maak `.env` aan).
2. Vul in:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
   - `APP_URL`, `BASE_URL` (bijv. `http://localhost:3000`)
   - `NODE_ENV=development`
   - `SESSION_SECRET` (bijv. `openssl rand -hex 32`)
   - Optioneel: `OPENAI_API_KEY`, `MOLLIE_*`, `KVK_*`, `GOOGLE_ADS_*`, enz.

Supabase-waarden: Dashboard → Project Settings → API.

---

## Stap 4: Database

- **Supabase Cloud:** maak een project aan; run migraties in volgorde via SQL Editor of `supabase db push`.
- **Lokaal Supabase (optioneel):** `supabase start` → `supabase link` → `supabase db push`.

Migraties staan in `supabase/migrations/` (chronologisch uitvoeren).

---

## Stap 5: Server starten

```bash
npm run dev
```

- Server draait op http://localhost:3000 (of ingestelde PORT).
- Bij “Port already in use”: andere poort gebruiken (bijv. `PORT=3001 npm run dev`) of proces op 3000 stoppen.

---

## Controleren

- **Auth:** registreer een testgebruiker; controleer in Supabase Auth → Users.
- **Database:** in SQL Editor `SELECT COUNT(*) FROM profiles;`
- **API:** `curl http://localhost:3000/api/...` (met sessie indien nodig)

---

## Veelvoorkomende problemen

- **Module not found:** `rm -rf node_modules package-lock.json && npm install`
- **Supabase-fout:** controleer URL en keys; controleer of project niet gepauzeerd is.
- Zie [SOP 06.3 – Troubleshooting](06-3-troubleshooting.md).

---

**Gerelateerd:** `docs/05-runbooks/local_setup.md`, [SOP 06.2 – Deploy](06-2-deploy-productie.md), [SOP 06.3 – Troubleshooting](06-3-troubleshooting.md)
