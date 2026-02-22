# SOP 06.3 – Troubleshooting

**Doel:** Veelvoorkomende fouten en oplossingen: server, database, auth, leads, betalingen.

**Doelgroep:** Developers en support.

---

## Server start niet

- **Cannot find module:** `rm -rf node_modules package-lock.json && npm install`
- **Port in use:** `lsof -ti:3000 | xargs kill -9` of `PORT=3001 npm run dev`
- **ECANCELED (Node 22/macOS):** retry in code; anders terminal/IDE herstarten; schijfruimte controleren (`df -h`)

---

## Database

- **Invalid API key:** controleer `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` in `.env`; controleer in Dashboard of project niet gepauzeerd is.
- **RLS policy violation:** controleren of gebruiker is ingelogd; voor admin-operaties service role gebruiken.
- **Relation does not exist:** controleren of migraties zijn uitgevoerd; tabelnamen in code controleren.

---

## Authenticatie

- **Hook requires authorization token (signup/login):** Auth Hooks in Supabase uitzetten of token correct instellen; controleren of trigger `on_auth_user_created` bestaat (zie migraties).
- **Session not found:** `SESSION_SECRET` controleren; cookies wissen; sessie-config in server controleren.

---

## Lead-toewijzing

- **No candidates found:** geen partners met capaciteit, actieve betaalmethode of passend segment. Controleren: `get_branch_region_capacity_combos()`, `payment_methods` status, `lead_segments` is_active.
- **Quota reached:** partner heeft maandquota bereikt; quota of subscription controleren; volgende periode of verhoging.

---

## Betalingen

- **Insufficient funds:** saldo controleren (`profiles.balance`); gebruiker laat opladen.
- **Mollie payment failed:** API-key (test vs live), webhook-URL en Mollie-dashboard controleren.

---

## Performance

- **Trage queries:** indexen controleren; `EXPLAIN ANALYZE` op zware queries; materialized views verversen (bijv. `partner_performance_stats`).
- **Hoog geheugengebruik:** processen/herstarts; monitoring (bijv. pm2).

---

## Debugging

- **Logs:** serverlogs (pm2/docker/terminal); Supabase → Logs → Postgres; eventueel `system_logs` in DB.
- **Handige queries:** zie `docs/05-runbooks/troubleshooting.md` (user status, lead status, capacity, billing snapshot).

---

**Gerelateerd:** `docs/05-runbooks/troubleshooting.md`, [SOP 06.1 – Local setup](06-1-local-setup.md), [SOP 06.2 – Deploy](06-2-deploy-productie.md)
