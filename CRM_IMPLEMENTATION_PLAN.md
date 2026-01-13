# CRM Implementatie Plan - Volledige Bedrijfsvoering

**Datum:** 2025-01-13  
**Doel:** Platform uitbreiden met volledige CRM-functionaliteit zodat het hele bedrijf in dit platform kan draaien

---

## 📊 Huidige Status

### ✅ Wat We Al Hebben

1. **Opportunities (Kansen)**
   - Basis opportunity tracking
   - AI sales rep suggesties
   - Status: open, won, lost
   - Conversie naar deals

2. **Deals**
   - Basis deal tracking
   - Status: open, won, lost
   - Stage: proposal, negotiation, etc.
   - Reminders functionaliteit

3. **Customers (Klanten)**
   - Customer detail pagina's
   - Customer responsible employees (many-to-many)
   - Customer invoices
   - Customer branches
   - Customer stats view

4. **Tickets**
   - Volledig tickets systeem
   - Ticket comments, attachments, audit log
   - SLA tracking
   - Status: new, open, waiting_on_customer, resolved, closed

5. **Time Tracking**
   - Time entries per customer
   - Time totals per employee
   - Employee contract tracking

6. **Email Integration**
   - Email inbox met AI labeling
   - Opportunity detectie vanuit emails
   - AI email antwoord generatie

7. **Services Module**
   - Services catalogus
   - Service sales tracking

---

## 🎯 Ontbrekende CRM Features (Prioriteit)

### 🔥 HOGE PRIORITEIT (Direct nodig voor bedrijfsvoering)

#### 1. **Sales Pipeline Management**
**Status:** ❌ Ontbreekt  
**Wat nodig:**
- Configureerbare sales stages (funnel)
- Pipeline view (kanban board)
- Stage progression tracking
- Win/loss ratio per stage
- Average time in stage

**Database:**
- `sales_pipelines` tabel (meerdere pipelines mogelijk)
- `sales_stages` tabel (stages per pipeline)
- `opportunities.stage_id` → link naar stage
- `deals.stage_id` → link naar stage

**UI:**
- `/admin/sales/pipeline` - Kanban board view
- Drag & drop opportunities/deals tussen stages
- Stage statistics per stage

---

#### 2. **Contact Management**
**Status:** ⚠️ Gedeeltelijk (alleen via opportunities)  
**Wat nodig:**
- Meerdere contacten per klant
- Contact rollen (decision maker, influencer, user, etc.)
- Contact voorkeuren (email, phone, whatsapp)
- Contact history (alle interacties)
- Contact tags/categories

**Database:**
- `contacts` tabel
  - `customer_id` (FK naar customers)
  - `first_name`, `last_name`, `email`, `phone`
  - `role` (decision_maker, influencer, user, etc.)
  - `preferred_contact_method`
  - `tags` (TEXT[])
  - `notes` (TEXT)
  - `is_primary` (BOOLEAN)

**UI:**
- `/admin/customers/:id/contacts` - Contact overzicht
- Contact detail pagina
- Quick add contact vanuit opportunity/deal

---

#### 3. **Activity Tracking (Uitgebreid)**
**Status:** ⚠️ Basis bestaat (lead_activities)  
**Wat nodig:**
- Activities voor opportunities, deals, customers
- Activity types: call, email, meeting, task, note
- Activity reminders/follow-ups
- Activity templates
- Activity outcomes (interested, not_interested, follow_up_needed)

**Database:**
- `activities` tabel (unified voor leads, opportunities, deals, customers)
  - `entity_type` (lead, opportunity, deal, customer)
  - `entity_id` (UUID)
  - `type` (call, email, meeting, task, note)
  - `subject`, `description`
  - `scheduled_at`, `completed_at`
  - `outcome` (interested, not_interested, follow_up_needed, etc.)
  - `reminder_at` (TIMESTAMPTZ)
  - `created_by` (FK naar profiles)

**UI:**
- Activity timeline op alle detail pagina's
- Activity calendar view
- Quick add activity modal
- Activity reminders dashboard

---

#### 4. **Document Management**
**Status:** ❌ Ontbreekt  
**Wat nodig:**
- Document upload per customer/opportunity/deal
- Document categories (contract, proposal, invoice, etc.)
- Document versioning
- Document sharing (intern)
- Document templates

**Database:**
- `documents` tabel
  - `entity_type` (customer, opportunity, deal, ticket)
  - `entity_id` (UUID)
  - `file_name`, `file_path`, `file_size`, `mime_type`
  - `category` (contract, proposal, invoice, other)
  - `version` (INTEGER)
  - `is_template` (BOOLEAN)
  - `uploaded_by` (FK naar profiles)

**UI:**
- Document library per customer/opportunity/deal
- Document upload modal
- Document preview
- Document download

---

#### 5. **Sales Forecasting**
**Status:** ❌ Ontbreekt  
**Wat nodig:**
- Revenue forecasting per periode (maand, kwartaal, jaar)
- Forecast per sales rep
- Forecast per stage
- Forecast accuracy tracking
- Weighted pipeline value

**Database:**
- `sales_forecasts` tabel
  - `period` (month, quarter, year)
  - `period_start` (DATE)
  - `sales_rep_id` (FK naar profiles, nullable voor company-wide)
  - `forecasted_revenue` (NUMERIC)
  - `weighted_pipeline_value` (NUMERIC)
  - `confidence` (INTEGER, 0-100)
  - `created_at`, `updated_at`

**UI:**
- `/admin/sales/forecast` - Forecast dashboard
- Forecast vs actual charts
- Forecast per rep
- Forecast accuracy metrics

---

### 🟡 MEDIUM PRIORITEIT (Belangrijk maar niet urgent)

#### 6. **Reporting & Analytics**
**Status:** ⚠️ Basis bestaat (dashboard KPIs)  
**Wat nodig:**
- Sales reports (per rep, per periode, per stage)
- Customer reports (lifetime value, churn, etc.)
- Activity reports (calls, emails, meetings)
- Custom report builder
- Export naar CSV/PDF

**UI:**
- `/admin/reports` - Report builder
- Pre-built reports (sales, customers, activities)
- Custom report wizard
- Scheduled reports (email)

---

#### 7. **Workflow Automation**
**Status:** ❌ Ontbreekt  
**Wat nodig:**
- Automatische acties bij status changes
- Email templates per stage
- Task creation bij events
- Notification rules
- SLA automation

**Database:**
- `workflow_rules` tabel
  - `name`, `description`
  - `trigger_entity` (opportunity, deal, customer, ticket)
  - `trigger_condition` (JSONB - status change, field change, etc.)
  - `actions` (JSONB - create task, send email, update field, etc.)
  - `is_active` (BOOLEAN)

**UI:**
- `/admin/automation/workflows` - Workflow builder
- Visual workflow editor
- Test workflow functionality

---

#### 8. **Email Templates**
**Status:** ⚠️ Basis (AI email generation)  
**Wat nodig:**
- Email template library
- Templates per stage/type
- Variable substitution ({{customer_name}}, {{deal_value}}, etc.)
- Template categories (proposal, follow-up, thank you, etc.)

**Database:**
- `email_templates` tabel
  - `name`, `subject`, `body`
  - `category` (proposal, follow_up, thank_you, etc.)
  - `entity_type` (opportunity, deal, customer)
  - `variables` (JSONB - lijst van beschikbare variabelen)
  - `is_active` (BOOLEAN)

**UI:**
- `/admin/email/templates` - Template library
- Template editor (rich text)
- Variable picker
- Preview functionality

---

### 🟢 LAGE PRIORITEIT (Nice to have)

#### 9. **Social Media Integration**
- LinkedIn integration voor contact enrichment
- Twitter/X monitoring
- Social media activity tracking

#### 10. **Advanced Search**
- Global search across all entities
- Saved searches
- Search filters

#### 11. **Mobile App**
- React Native app
- Offline support
- Push notifications

---

## 🚀 Implementatie Roadmap

### FASE 1: Core CRM (Week 1-2)
**Doel:** Basis CRM-functionaliteit operationeel

1. **Sales Pipeline** ✅
   - Database migrations
   - Pipeline configuratie UI
   - Kanban board view
   - Stage progression tracking

2. **Contact Management** ✅
   - Database migrations
   - Contact CRUD
   - Contact detail pagina
   - Link contacts naar opportunities/deals

3. **Activity Tracking (Uitgebreid)** ✅
   - Unified activities tabel
   - Activity types uitbreiden
   - Activity timeline component
   - Quick add activity

**Deliverables:**
- Sales pipeline volledig werkend
- Contacten kunnen worden beheerd
- Activities kunnen worden getracked

---

### FASE 2: Document & Forecasting (Week 3-4)
**Doel:** Document management en forecasting

4. **Document Management** ✅
   - Database migrations
   - File upload functionaliteit
   - Document library UI
   - Document preview

5. **Sales Forecasting** ✅
   - Database migrations
   - Forecast calculation logic
   - Forecast dashboard
   - Forecast vs actual charts

**Deliverables:**
- Documenten kunnen worden geüpload en beheerd
- Sales forecasting werkt

---

### FASE 3: Automation & Reporting (Week 5-6)
**Doel:** Workflow automation en reporting

6. **Reporting & Analytics** ✅
   - Report builder UI
   - Pre-built reports
   - Export functionaliteit
   - Scheduled reports

7. **Workflow Automation** ✅
   - Workflow rules engine
   - Workflow builder UI
   - Test functionality

8. **Email Templates** ✅
   - Template library
   - Template editor
   - Variable substitution

**Deliverables:**
- Reports kunnen worden gegenereerd
- Workflows kunnen worden geconfigureerd
- Email templates beschikbaar

---

## 📋 Database Schema Voorstellen

### 1. Sales Pipeline Schema

```sql
-- Sales Pipelines
CREATE TABLE sales_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Stages
CREATE TABLE sales_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES sales_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL, -- Order in pipeline
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100), -- Win probability %
  color TEXT DEFAULT '#6B7280', -- Hex color for UI
  is_closed BOOLEAN DEFAULT false, -- Won/lost stage
  is_won BOOLEAN DEFAULT false, -- Won stage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pipeline_id, position)
);

-- Link opportunities to stages
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES sales_stages(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES sales_stages(id);
```

### 2. Contacts Schema

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  job_title TEXT,
  role TEXT CHECK (role IN ('decision_maker', 'influencer', 'user', 'champion', 'blocker', 'other')),
  preferred_contact_method TEXT CHECK (preferred_contact_method IN ('email', 'phone', 'whatsapp', 'linkedin')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX idx_contacts_customer_id ON contacts(customer_id);
CREATE INDEX idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
```

### 3. Unified Activities Schema

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'opportunity', 'deal', 'customer', 'contact')),
  entity_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'task', 'note', 'whatsapp', 'linkedin')),
  subject TEXT,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER, -- For calls/meetings
  outcome TEXT CHECK (outcome IN ('interested', 'not_interested', 'follow_up_needed', 'no_answer', 'voicemail', 'other')),
  reminder_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb, -- For additional data (call recording URL, email thread ID, etc.)
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX idx_activities_scheduled ON activities(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_activities_reminder ON activities(reminder_at) WHERE reminder_at IS NOT NULL;
```

### 4. Documents Schema

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'opportunity', 'deal', 'ticket', 'contact')),
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path (S3, local, etc.)
  file_size INTEGER NOT NULL, -- Bytes
  mime_type TEXT NOT NULL,
  category TEXT CHECK (category IN ('contract', 'proposal', 'invoice', 'quote', 'other')),
  version INTEGER DEFAULT 1,
  is_template BOOLEAN DEFAULT false,
  description TEXT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_documents_category ON documents(category);
```

### 5. Sales Forecasts Schema

```sql
CREATE TABLE sales_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL CHECK (period IN ('month', 'quarter', 'year')),
  period_start DATE NOT NULL,
  sales_rep_id UUID REFERENCES profiles(id), -- NULL = company-wide forecast
  forecasted_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  weighted_pipeline_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period, period_start, sales_rep_id)
);

-- Indexes
CREATE INDEX idx_forecasts_period ON sales_forecasts(period, period_start);
CREATE INDEX idx_forecasts_rep ON sales_forecasts(sales_rep_id) WHERE sales_rep_id IS NOT NULL;
```

---

## 🎨 UI/UX Overwegingen

### Design Principes
- **Consistentie:** Gebruik bestaande admin layout en styling
- **Performance:** Lazy loading voor grote lijsten
- **Mobile-first:** Responsive design (hoewel primair desktop)
- **Accessibility:** WCAG 2.1 AA compliance

### Component Library
- Hergebruik bestaande components waar mogelijk
- Nieuwe components: KanbanBoard, ActivityTimeline, DocumentLibrary
- Consistent gebruik van CSS variables (zie `dashboard.css`)

---

## 🔗 Integraties

### Bestaande Integraties Uitbreiden
- **Email (Mailgun):** Uitbreiden voor activity tracking
- **Supabase Storage:** Voor document uploads
- **OpenAI:** Voor email template suggestions

### Nieuwe Integraties (Optioneel)
- **Calendly:** Meeting scheduling
- **Zoom/Teams:** Meeting links
- **LinkedIn:** Contact enrichment

---

## 📝 Next Steps

1. **Review dit plan** - Feedback verzamelen
2. **Prioriteiten bepalen** - Welke features zijn echt urgent?
3. **FASE 1 starten** - Sales Pipeline + Contacts + Activities
4. **Iteratief bouwen** - Per feature testen en deployen

---

## ❓ Vragen voor Besluitvorming

1. **Sales Pipeline:** Hoeveel pipelines hebben we nodig? (B2B vs B2C? Per service type?)
2. **Contacts:** Moeten contacts ook gekoppeld kunnen worden aan opportunities/deals (niet alleen customers)?
3. **Activities:** Moeten we lead_activities migreren naar unified activities tabel?
4. **Documents:** Waar slaan we bestanden op? (Supabase Storage, S3, lokaal?)
5. **Forecasting:** Hoe vaak wordt forecast bijgewerkt? (Dagelijks, wekelijks, handmatig?)

---

**Status:** 📋 Plan klaar voor review  
**Volgende stap:** Bespreken prioriteiten en starten met FASE 1

