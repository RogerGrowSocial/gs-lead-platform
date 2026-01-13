# Billing System Updates - Industry Based Pricing

## 📋 Overzicht van Wijzigingen

Het billing systeem in admin/settings is volledig bijgewerkt om:

1. **Alleen assigned leads te tellen** - Het systeem telt nu alleen leads die daadwerkelijk aan een gebruiker zijn toegewezen (`user_id` is niet null)
2. **Industries/branches beheer** - Complete interface om branches toe te voegen, bewerken en prijzen per lead in te stellen
3. **Industry-based pricing** - Elke lead krijgt een prijs op basis van de branche waar het toe behoort
4. **Billing breakdown per industry** - Overzicht van hoeveel leads en kosten per branche

## 🗂️ Gewijzigde Bestanden

### 1. Database Migratie
- **`migrations/20250116_fix_billing_system.sql`** - Complete database update
  - Voegt `industry_id`, `price_at_purchase`, `approved_at`, `deadline`, `priority` toe aan leads tabel
  - Voegt `price_per_lead`, `description`, `is_active` toe aan industries tabel  
  - Bijgewerkte billing functies voor assigned leads
  - Nieuwe helper functies voor industries management

### 2. Admin Interface
- **`views/admin/settings.ejs`** - Uitgebreide admin interface
  - Nieuwe "Branches Beheer" sectie
  - Industries tabel met CRUD functionaliteit
  - Industry breakdown in billing overzicht
  - Modal voor toevoegen/bewerken van branches
  - Responsive design voor mobiel

### 3. API Endpoints
- **`routes/api.js`** - Nieuwe industries API endpoints
  - `GET /api/industries` - Alle branches ophalen
  - `POST /api/industries` - Nieuwe branche toevoegen
  - `PUT /api/industries/:id` - Branche bijwerken
  - `DELETE /api/industries/:id` - Branche verwijderen (met veiligheidscheck)

### 4. Database Scripts
- **`scripts/update-billing-system.js`** - Automatische database update
- **`scripts/add-industries-columns.js`** - Helper voor ontbrekende kolommen

## 🎯 Nieuwe Functionaliteit

### Industries Management
- **Toevoegen van nieuwe branches** met aangepaste prijzen
- **Bewerken van bestaande branches** en hun prijzen
- **Activeren/deactiveren** van branches
- **Veilige verwijdering** (alleen als geen leads gekoppeld zijn)

### Billing Berekening
- **Assigned leads only** - Alleen leads met `user_id` tellen mee
- **Industry-based pricing** - Prijs per lead op basis van branche
- **Automatic price setting** - `price_at_purchase` wordt automatisch ingesteld bij lead approval
- **Industry breakdown** - Visueel overzicht per branche in admin panel

### Billing Overzicht
- **Maandelijks overzicht** per gebruiker
- **Industry breakdown** met percentages en bedragen
- **Visual progress bars** voor elke branche
- **Totaal overzicht** van alle branches samen

## 🚀 Implementatie Status

### ✅ Voltooid
- [x] Database schema updates voor leads tabel
- [x] Complete admin interface voor industries management
- [x] API endpoints voor CRUD operaties
- [x] Frontend JavaScript voor industries beheer
- [x] Billing UI updates met industry breakdown
- [x] CSS styling voor nieuwe componenten
- [x] Responsive design

### ⚠️ Handmatige Stappen Vereist
- [ ] **Industries tabel kolommen toevoegen** via Supabase Dashboard:
  - `price_per_lead` (DECIMAL(10,2) DEFAULT 10.00)
  - `description` (TEXT)
  - `is_active` (BOOLEAN DEFAULT TRUE)

- [ ] **Database functies toevoegen** via Supabase SQL Editor:
  - Voer `migrations/20250116_fix_billing_system.sql` uit
  - Of voer individuele functies uit uit het bestand

### 🔄 Vervolgstappen
1. **Database kolommen toevoegen** in Supabase Dashboard
2. **Migratie uitvoeren** via SQL Editor
3. **Default industries toevoegen** met prijzen
4. **Testen** van volledige functionaliteit
5. **Lead assignment workflow** bijwerken om industry_id te zetten

## 📊 Standaard Industry Prijzen

| Branche | Prijs per Lead | Beschrijving |
|---------|---------------|--------------|
| Technology | €15.00 | IT en technologie bedrijven |
| Healthcare | €20.00 | Zorgverleners en medische diensten |
| Finance | €25.00 | Financiële dienstverlening |
| Real Estate | €18.00 | Makelaardij en vastgoed |
| Consulting | €12.00 | Adviesbureaus en consultancy |
| Education | €10.00 | Onderwijsinstellingen |
| Retail | €8.00 | Detailhandel |
| Manufacturing | €14.00 | Productie en fabricage |

## 🔧 Gebruik van het Systeem

### Voor Admins
1. **Ga naar Admin > Settings > Billing tab**
2. **Bekijk "Branches Beheer" sectie**
3. **Voeg nieuwe branches toe** met "Nieuwe Branche" knop
4. **Bewerk prijzen** door op "Bewerken" te klikken
5. **Bekijk billing per gebruiker** met industry breakdown

### Voor het Billing Systeem
- Leads krijgen automatisch `price_at_purchase` op basis van hun `industry_id`
- Bij approval wordt `approved_at` gezet voor billing berekening
- Alleen assigned leads (`user_id` is niet null) tellen mee
- Industry breakdown toont verdeling per branche

## 🛠️ Technische Details

### Database Schema Updates
```sql
-- Leads table additions
ALTER TABLE leads ADD COLUMN industry_id UUID REFERENCES industries(id);
ALTER TABLE leads ADD COLUMN price_at_purchase DECIMAL(10,2);
ALTER TABLE leads ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;

-- Industries table additions  
ALTER TABLE industries ADD COLUMN price_per_lead DECIMAL(10,2) DEFAULT 10.00;
ALTER TABLE industries ADD COLUMN description TEXT;
ALTER TABLE industries ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
```

### API Endpoints
```javascript
GET    /api/industries           - Lijst van alle branches
POST   /api/industries           - Nieuwe branche toevoegen
PUT    /api/industries/:id       - Branche bijwerken
DELETE /api/industries/:id       - Branche verwijderen
```

### Frontend Components
- Industries management table met inline editing
- Modal forms voor toevoegen/bewerken
- Industry breakdown charts in billing overview
- Responsive design voor alle schermformaten

---

**Status:** Implementatie voltooid, handmatige database stappen vereist voor volledige functionaliteit.
