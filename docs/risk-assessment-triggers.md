# Risk Assessment Database Triggers

## Overzicht

Dit systeem gebruikt PostgreSQL triggers om automatisch AI risk assessments uit te voeren wanneer:
1. Een nieuw profiel wordt aangemaakt (na onboarding/signup)
2. Relevante profielvelden worden bijgewerkt (KVK, adres, company_name, etc.)

## Architectuur

### Database Triggers
- **Trigger functie**: `notify_risk_assessment_needed()`
- **Triggers**:
  - `trigger_risk_assessment_on_profile_insert` - op INSERT
  - `trigger_risk_assessment_on_profile_update` - op UPDATE

### Node.js Worker
- **Service**: `services/riskAssessmentWorker.js`
- **Functionaliteit**: Luistert naar PostgreSQL NOTIFY events en voert risk assessments uit
- **Start**: Automatisch bij server start (via `server.js`)

## Installatie

### 1. Database Migration Uitvoeren

```bash
# Via Supabase CLI
supabase db push

# Of handmatig in Supabase SQL Editor
# Kopieer en voer uit: supabase/migrations/20250113000002_add_risk_assessment_trigger.sql
```

### 2. Environment Variables

Voeg toe aan `.env`:

```env
# Direct database connection URL (voor LISTEN/NOTIFY)
# Format: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_DB_URL=postgresql://postgres:your-password@db.xxx.supabase.co:5432/postgres

# Of gebruik DATABASE_URL als die al bestaat
DATABASE_URL=postgresql://postgres:your-password@db.xxx.supabase.co:5432/postgres
```

**Hoe SUPABASE_DB_URL te vinden:**
1. Ga naar Supabase Dashboard → Project Settings → Database
2. Zoek "Connection string" → "URI"
3. Kopieer de connection string (vervang `[YOUR-PASSWORD]` met je database password)

### 3. Dependencies Installeren

```bash
npm install pg
```

## Hoe Het Werkt

### Flow

1. **Profile Creation/Update**
   - Gebruiker maakt profiel aan of update relevante velden
   - Database trigger detecteert wijziging
   - Trigger stuurt `pg_notify('risk_assessment_needed', payload)`

2. **Worker Processing**
   - Node.js worker luistert naar `risk_assessment_needed` channel
   - Ontvangt notification met `user_id`
   - Haalt profiel op uit database
   - Voert risk assessment uit via `UserRiskAssessmentService`
   - Slaat resultaat op in database

### Relevante Velden

De trigger detecteert wijzigingen in:
- `company_name`
- `coc_number` (KVK nummer)
- `vat_number` (BTW nummer)
- `email`
- `street` (adres)
- `postal_code` (postcode)
- `city` (plaats)
- `country` (land)
- `phone` (telefoon)

## Monitoring

### Logs

De worker logt alle activiteit:
- ✅ Succesvolle assessments
- ⚠️ Waarschuwingen (bijv. onvoldoende data)
- ❌ Fouten

### Status Check

```javascript
const { getWorker } = require('./services/riskAssessmentWorker')
const worker = getWorker()
console.log('Worker active:', worker.isActive())
```

## Troubleshooting

### Worker Start Niet

**Probleem**: Worker start niet, zie warning in logs

**Oplossing**:
1. Check of `SUPABASE_DB_URL` of `DATABASE_URL` is ingesteld
2. Check of connection string correct is
3. Check of database password correct is
4. Check of `pg` package is geïnstalleerd

### Triggers Werken Niet

**Probleem**: Assessments worden niet uitgevoerd na profile updates

**Oplossing**:
1. Check of triggers bestaan:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%risk_assessment%';
   ```
2. Check of trigger functie bestaat:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'notify_risk_assessment_needed';
   ```
3. Test trigger handmatig:
   ```sql
   -- Update een test profiel
   UPDATE profiles SET company_name = 'Test' WHERE id = 'your-user-id';
   -- Check logs voor notification
   ```

### Duplicate Processing

**Probleem**: Meerdere assessments voor dezelfde user

**Oplossing**:
- Worker heeft ingebouwde duplicate prevention
- Check of er meerdere worker instances draaien
- Check of er meerdere server instances zijn

## Fallback

Als de worker niet start of faalt:
- Risk assessments werken nog steeds via route handlers
- `routes/admin.js` - bij user creation
- `routes/dashboard.js` - bij profile update
- `routes/api.js` - bij profile update via API

## Performance

- **Asynchroon**: Assessments blokkeren niet de database operatie
- **Deduplicatie**: Worker voorkomt duplicate processing
- **Error Handling**: Fouten in assessments blokkeren niet de user flow

## Toekomstige Verbeteringen

- [ ] Queue systeem voor betere schaalbaarheid
- [ ] Retry mechanisme voor failed assessments
- [ ] Metrics en monitoring dashboard
- [ ] Rate limiting voor API calls

