# GS Lead Platform

Lead generation platform voor GrowSocial.

## AI Functionaliteiten

Dit platform gebruikt AI op verschillende manieren om workflows te optimaliseren:

### 1. AI E-mail Labeling & Opportunity Suggesties
Het systeem analyseert inkomende e-mails automatisch en:
- Labelt e-mails intelligent (lead, newsletter, customer_request, etc.)
- Detecteert sales leads via keyword matching of OpenAI
- Suggereert automatisch om een opportunity te maken voor relevante e-mails

**Locatie:** `/admin/mail` - E-mail inbox met auto-labeling en opportunity suggesties

### 2. AI Sales Rep Suggesties
Voor elke ontoegewezen opportunity berekent het systeem:
- Welke sales rep de beste match is op basis van historische prestaties
- Success rate, ervaring en value matching worden geanalyseerd
- Top 3 matches worden getoond met confidence scores

**Locatie:** 
- `/admin/opportunities` - Listing pagina met AI suggesties per opportunity
- `/admin/opportunities/:id` - Detail pagina met primaire + alternatieve suggesties

### 3. AI E-mail Antwoord Generatie
Genereert automatisch professionele e-mail antwoorden:
- Analyseert originele e-mail volledig
- Past stijl aan (professioneel, vriendelijk, casual)
- Ondersteunt Nederlands en Engels
- Respecteert formaliteit niveau (je/jouw vs u/uw)

**Locatie:** `/admin/mail` - "AI Antwoord" button in mail drawer

Voor uitgebreide documentatie over alle AI functionaliteiten, zie [AI_FUNCTIONALITY_DOCUMENTATION.md](./AI_FUNCTIONALITY_DOCUMENTATION.md).

## Authentication Setup

### Recent Changes (v1.5.27)

The authentication flow has been updated to eliminate the 500 "Hook requires authorization token" error by replacing Auth Hooks with database triggers.

**Important**: The Auth Hook has been disabled in the Supabase Dashboard (Auth → Hooks).

### Migration Required

To apply the new authentication flow, run the following migration:

#### Option 1: Supabase CLI (Recommended)
```bash
cd gs-lead-platform
supabase db push
```

#### Option 2: Supabase SQL Editor (Quick Fix)
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/20250909215240_profiles_trigger.sql`
3. Execute the SQL

### Testing

After applying the migration, test the signup flow:

```bash
npm install  # Install tsx if not already installed
npm run test:signup
```

### Documentation

For detailed information about the authentication flow, see [docs/auth.md](docs/auth.md).

## Development

```bash
npm install
npm run dev
```

## Environment Variables

Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`
- `BASE_URL`

See `.env.example` for complete list.
