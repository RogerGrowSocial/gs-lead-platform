# Form Analytics & Auto-Optimalisatie Roadmap

**Status:** 🎯 Planning & Design  
**Datum:** 2025-01-XX  
**Doel:** Feedback-loop + AI-gebaseerde auto-optimalisatie voor form builder

---

## 📊 OVERZICHT

Dit document beschrijft de implementatie van een uitgebreid analytics- en optimalisatiesysteem voor het form builder platform, inclusief:

1. **Form Analytics** - Uitval tracking per vraag/stap
2. **AI Lead Value Engine** - Voorspelling dealwaarde en pricing
3. **Partner-specifieke optimalisatie** - Micro-tweaks per partner
4. **AI Sales Assist** - Automatische samenvattingen en scripts
5. **Multi-channel vraaglogica** - Zelfde engine voor alle kanalen
6. **Micro-segmentatie** - Keyword/campagne-gebaseerde varianten
7. **Benchmark & Insights** - Dashboard en marketing data

---

## ✅ HUIDIGE BASIS (Wat we al hebben)

### Database
- ✅ `leads` tabel met `deal_value`, `first_contact_at`, `status` (won/lost)
- ✅ `lead_feedback` tabel (ratings, comments)
- ✅ `lead_activities` tabel (tracking van acties)
- ✅ `partner_performance_stats` view (conversion rates, response times)
- ✅ `lead_form_templates` tabel (config_json per industry)

### Services
- ✅ Lead assignment service
- ✅ Performance tracking triggers
- ✅ Form builder UI (admin)

---

## 🎯 FASE 1: Form Analytics & Drop-off Tracking

### 1.1 Database Schema Uitbreidingen

**Nieuwe tabel: `form_analytics`**
```sql
CREATE TABLE form_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referenties
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  industry_id INTEGER REFERENCES industries(id),
  form_template_id UUID REFERENCES lead_form_templates(id),
  
  -- Step tracking
  step_id TEXT NOT NULL, -- e.g. "step-2", "step-3", "step-urgency"
  step_order INTEGER NOT NULL,
  step_title TEXT,
  
  -- Field tracking
  field_id TEXT, -- e.g. "job_category", "budget"
  field_type TEXT, -- "select", "text", etc.
  
  -- Analytics data
  started_at TIMESTAMPTZ NOT NULL, -- Wanneer gebruiker deze stap startte
  completed_at TIMESTAMPTZ, -- Wanneer stap voltooid werd (NULL = drop-off)
  time_spent_seconds INTEGER, -- calculated: completed_at - started_at
  
  -- Drop-off tracking
  dropped_off BOOLEAN DEFAULT false, -- true als gebruiker niet verder ging
  drop_off_reason TEXT, -- "timeout", "back_button", "close_tab", etc.
  
  -- Field values (voor analyse)
  field_value TEXT, -- Wat gebruiker invulde (voor select: gekozen optie)
  field_value_metadata JSONB, -- Extra data (bijv. welke opties werden bekeken maar niet gekozen)
  
  -- Session tracking
  session_id TEXT NOT NULL, -- Unieke sessie ID (client-side generated)
  user_agent TEXT,
  referrer TEXT,
  source_keyword TEXT, -- Van landing page / campaign
  source_campaign_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_form_analytics_lead_id (lead_id),
  INDEX idx_form_analytics_industry_id (industry_id),
  INDEX idx_form_analytics_step_id (step_id),
  INDEX idx_form_analytics_dropped_off (dropped_off),
  INDEX idx_form_analytics_session_id (session_id),
  INDEX idx_form_analytics_created_at (created_at DESC)
);
```

**Nieuwe tabel: `form_step_performance` (Materialized View)**
```sql
CREATE MATERIALIZED VIEW form_step_performance AS
SELECT 
  industry_id,
  form_template_id,
  step_id,
  step_order,
  step_title,
  
  -- Volume metrics
  COUNT(*) as total_starts,
  COUNT(completed_at) as total_completions,
  COUNT(*) FILTER (WHERE dropped_off = true) as total_drop_offs,
  
  -- Conversion metrics
  ROUND(
    COUNT(completed_at)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 
    2
  ) as completion_rate_pct,
  
  ROUND(
    COUNT(*) FILTER (WHERE dropped_off = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    2
  ) as drop_off_rate_pct,
  
  -- Time metrics
  AVG(time_spent_seconds) as avg_time_spent_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_spent_seconds) as median_time_spent_seconds,
  
  -- Lead quality (correlatie met won/lost)
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') as leads_won,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'lost') as leads_lost,
  ROUND(
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won')::NUMERIC / 
    NULLIF(COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('won', 'lost')), 0) * 100,
    2
  ) as win_rate_pct,
  
  -- Date range
  MIN(created_at) as first_seen_at,
  MAX(created_at) as last_seen_at
  
FROM form_analytics fa
LEFT JOIN leads l ON fa.lead_id = l.id
GROUP BY industry_id, form_template_id, step_id, step_order, step_title;

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_form_step_performance()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY form_step_performance;
END;
$$ LANGUAGE plpgsql;
```

### 1.2 Frontend Tracking (JavaScript)

**Nieuwe file: `public/js/forms/analytics-tracker.js`**
```javascript
class FormAnalyticsTracker {
  constructor(sessionId, industryId, formTemplateId) {
    this.sessionId = sessionId;
    this.industryId = industryId;
    this.formTemplateId = formTemplateId;
    this.stepStartTimes = {};
    this.currentStep = null;
  }

  // Track step start
  trackStepStart(stepId, stepOrder, stepTitle) {
    this.currentStep = stepId;
    this.stepStartTimes[stepId] = Date.now();
    
    this.sendEvent({
      type: 'step_start',
      step_id: stepId,
      step_order: stepOrder,
      step_title: stepTitle,
      started_at: new Date().toISOString()
    });
  }

  // Track step completion
  trackStepComplete(stepId, fieldData = {}) {
    const startTime = this.stepStartTimes[stepId];
    const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : null;
    
    this.sendEvent({
      type: 'step_complete',
      step_id: stepId,
      completed_at: new Date().toISOString(),
      time_spent_seconds: timeSpent,
      field_values: fieldData
    });
  }

  // Track drop-off
  trackDropOff(stepId, reason = 'unknown') {
    this.sendEvent({
      type: 'drop_off',
      step_id: stepId,
      dropped_off: true,
      drop_off_reason: reason,
      completed_at: null
    });
  }

  // Track field interaction
  trackFieldInteraction(fieldId, fieldType, value, metadata = {}) {
    this.sendEvent({
      type: 'field_interaction',
      field_id: fieldId,
      field_type: fieldType,
      field_value: value,
      field_value_metadata: metadata
    });
  }

  // Send event to backend
  async sendEvent(eventData) {
    try {
      await fetch('/api/form-analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          industry_id: this.industryId,
          form_template_id: this.formTemplateId,
          ...eventData
        })
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
      // Fail silently - don't break form submission
    }
  }
}
```

### 1.3 Backend API Endpoint

**Nieuwe route: `routes/api.js`**
```javascript
// POST /api/form-analytics/track
router.post('/form-analytics/track', async (req, res) => {
  try {
    const {
      session_id,
      industry_id,
      form_template_id,
      type, // 'step_start', 'step_complete', 'drop_off', 'field_interaction'
      step_id,
      step_order,
      step_title,
      field_id,
      field_type,
      field_value,
      field_value_metadata,
      started_at,
      completed_at,
      time_spent_seconds,
      dropped_off,
      drop_off_reason
    } = req.body;

    // Insert analytics event
    const { error } = await supabaseAdmin
      .from('form_analytics')
      .insert([{
        session_id,
        industry_id,
        form_template_id,
        step_id,
        step_order,
        step_title,
        field_id,
        field_type,
        field_value,
        field_value_metadata,
        started_at: started_at || new Date().toISOString(),
        completed_at,
        time_spent_seconds,
        dropped_off: dropped_off || false,
        drop_off_reason,
        user_agent: req.headers['user-agent'],
        referrer: req.headers['referer']
      }]);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    res.status(500).json({ error: 'Tracking failed' });
  }
});
```

---

## 🎯 FASE 2: AI Lead Value Engine

### 2.1 Database Schema

**Nieuwe tabel: `lead_value_predictions`**
```sql
CREATE TABLE lead_value_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  industry_id INTEGER REFERENCES industries(id),
  
  -- Predictions
  predicted_deal_value NUMERIC(10,2), -- Voorspelde dealwaarde
  predicted_win_probability NUMERIC(5,2), -- 0-100%
  predicted_response_time_hours NUMERIC(5,2), -- Verwacht aantal uren tot eerste contact
  
  -- Model metadata
  model_version TEXT, -- e.g. "v1.0"
  prediction_confidence NUMERIC(5,2), -- 0-100%
  prediction_factors JSONB, -- Welke factoren droegen bij aan voorspelling
  
  -- Actual outcomes (voor model training)
  actual_deal_value NUMERIC(10,2),
  actual_win BOOLEAN,
  actual_response_time_hours NUMERIC(5,2),
  
  -- Timestamps
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualized_at TIMESTAMPTZ, -- Wanneer outcome bekend werd
  
  INDEX idx_lead_value_predictions_lead_id (lead_id),
  INDEX idx_lead_value_predictions_industry_id (industry_id),
  INDEX idx_lead_value_predictions_predicted_at (predicted_at DESC)
);
```

### 2.2 AI Service

**Nieuwe file: `services/leadValuePredictionService.js`**
```javascript
const OpenAI = require('openai');

class LeadValuePredictionService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.modelVersion = 'v1.0';
  }

  async predictLeadValue(leadData, formAnswers, industryData) {
    // Extract features from lead and form answers
    const features = this.extractFeatures(leadData, formAnswers, industryData);
    
    // Build prompt for OpenAI
    const prompt = this.buildPredictionPrompt(features, industryData);
    
    // Call OpenAI
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een expert in lead kwalificatie en deal value voorspelling voor B2B lead generatie platforms.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    });

    const prediction = JSON.parse(completion.choices[0].message.content);
    
    // Store prediction
    await this.storePrediction(leadData.id, industryData.id, prediction);
    
    return prediction;
  }

  extractFeatures(leadData, formAnswers, industryData) {
    return {
      // Lead basics
      industry: industryData.name,
      province: leadData.province,
      postcode: leadData.postcode,
      
      // Form answers
      urgency: formAnswers.urgency,
      budget: formAnswers.budget,
      job_type: formAnswers.job_type,
      job_category: formAnswers.job_category,
      description_length: formAnswers.description?.length || 0,
      
      // Calculated features
      has_budget: !!formAnswers.budget && formAnswers.budget !== 'Ik weet het nog niet precies',
      is_urgent: formAnswers.urgency?.includes('spoed') || formAnswers.urgency?.includes('zo snel mogelijk'),
      has_description: formAnswers.description && formAnswers.description.length > 50
    };
  }

  buildPredictionPrompt(features, industryData) {
    return `Voorspel de lead value voor deze lead:

Branche: ${features.industry}
Provincie: ${features.province}
Urgentie: ${features.urgency}
Budget: ${features.budget}
Type klus: ${features.job_type}
Categorie: ${features.job_category}
Beschrijving lengte: ${features.description_length} karakters

Geef terug als JSON:
{
  "predicted_deal_value": <nummer in euro's>,
  "predicted_win_probability": <percentage 0-100>,
  "predicted_response_time_hours": <verwacht aantal uren>,
  "prediction_confidence": <percentage 0-100>,
  "prediction_factors": {
    "budget_indicator": "<uitleg>",
    "urgency_factor": "<uitleg>",
    "job_type_factor": "<uitleg>",
    "location_factor": "<uitleg>"
  }
}`;
  }

  async storePrediction(leadId, industryId, prediction) {
    const { error } = await supabaseAdmin
      .from('lead_value_predictions')
      .insert([{
        lead_id: leadId,
        industry_id: industryId,
        predicted_deal_value: prediction.predicted_deal_value,
        predicted_win_probability: prediction.predicted_win_probability,
        predicted_response_time_hours: prediction.predicted_response_time_hours,
        model_version: this.modelVersion,
        prediction_confidence: prediction.prediction_confidence,
        prediction_factors: prediction.prediction_factors
      }]);

    if (error) throw error;
  }

  async updateActualOutcome(leadId, actualDealValue, actualWin, actualResponseTime) {
    const { error } = await supabaseAdmin
      .from('lead_value_predictions')
      .update({
        actual_deal_value: actualDealValue,
        actual_win: actualWin,
        actual_response_time_hours: actualResponseTime,
        actualized_at: new Date().toISOString()
      })
      .eq('lead_id', leadId);

    if (error) throw error;
  }
}

module.exports = LeadValuePredictionService;
```

---

## 🎯 FASE 3: AI Form Optimization Engine

### 3.1 Database Schema

**Nieuwe tabel: `form_optimization_suggestions`**
```sql
CREATE TABLE form_optimization_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id INTEGER REFERENCES industries(id),
  form_template_id UUID REFERENCES lead_form_templates(id),
  
  -- Suggestion type
  suggestion_type TEXT NOT NULL, -- 'remove_step', 'reorder_steps', 'modify_field', 'add_field', 'change_options'
  target_step_id TEXT, -- Welke stap wordt aangepast
  target_field_id TEXT, -- Welke veld wordt aangepast
  
  -- Current vs Suggested
  current_config JSONB, -- Huidige config
  suggested_config JSONB, -- Voorgestelde config
  suggested_changes JSONB, -- Specifieke wijzigingen
  
  -- Reasoning
  reasoning TEXT, -- Waarom deze suggestie
  expected_impact JSONB, -- Verwacht effect (bijv. {"completion_rate": "+5%", "drop_off_rate": "-3%"}
  
  -- Analytics basis
  analytics_period_days INTEGER DEFAULT 30, -- Op basis van hoeveel dagen data
  data_points_count INTEGER, -- Aantal data points gebruikt
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'implemented'
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  implemented_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_form_optimization_industry_id (industry_id),
  INDEX idx_form_optimization_status (status)
);
```

### 3.2 AI Optimization Service

**Nieuwe file: `services/formOptimizationService.js`**
```javascript
class FormOptimizationService {
  async generateOptimizationSuggestions(industryId, formTemplateId, analyticsData) {
    // Analyze form performance
    const performance = await this.analyzeFormPerformance(industryId, formTemplateId);
    
    // Identify issues
    const issues = this.identifyIssues(performance);
    
    // Generate suggestions
    const suggestions = [];
    
    for (const issue of issues) {
      const suggestion = await this.generateSuggestionForIssue(issue, performance);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
    
    // Store suggestions
    await this.storeSuggestions(industryId, formTemplateId, suggestions);
    
    return suggestions;
  }

  async analyzeFormPerformance(industryId, formTemplateId) {
    // Query form_step_performance view
    const { data, error } = await supabaseAdmin
      .from('form_step_performance')
      .select('*')
      .eq('industry_id', industryId)
      .eq('form_template_id', formTemplateId)
      .order('step_order');

    if (error) throw error;
    
    return data;
  }

  identifyIssues(performance) {
    const issues = [];
    
    performance.forEach(step => {
      // High drop-off rate
      if (step.drop_off_rate_pct > 20) {
        issues.push({
          type: 'high_drop_off',
          step_id: step.step_id,
          severity: step.drop_off_rate_pct > 40 ? 'high' : 'medium',
          metric: step.drop_off_rate_pct
        });
      }
      
      // Low completion rate
      if (step.completion_rate_pct < 70) {
        issues.push({
          type: 'low_completion',
          step_id: step.step_id,
          severity: step.completion_rate_pct < 50 ? 'high' : 'medium',
          metric: step.completion_rate_pct
        });
      }
      
      // Low win rate correlation
      if (step.win_rate_pct < 30 && step.total_completions > 50) {
        issues.push({
          type: 'low_win_rate',
          step_id: step.step_id,
          severity: 'medium',
          metric: step.win_rate_pct
        });
      }
    });
    
    return issues;
  }

  async generateSuggestionForIssue(issue, performance) {
    // Use AI to generate optimization suggestion
    const prompt = this.buildOptimizationPrompt(issue, performance);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een expert in formulier optimalisatie en conversie rate optimalisatie.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  buildOptimizationPrompt(issue, performance) {
    return `Analyseer dit formulier probleem en geef een optimalisatie suggestie:

Probleem: ${issue.type}
Stap: ${issue.step_id}
Severity: ${issue.severity}
Metric: ${issue.metric}

Formulier performance data:
${JSON.stringify(performance, null, 2)}

Geef terug als JSON:
{
  "suggestion_type": "<type>",
  "target_step_id": "<step_id>",
  "target_field_id": "<field_id>",
  "suggested_changes": {
    "action": "<remove|reorder|modify|add>",
    "details": "<specifieke wijzigingen>"
  },
  "reasoning": "<waarom deze suggestie>",
  "expected_impact": {
    "completion_rate": "<verwacht effect>",
    "drop_off_rate": "<verwacht effect>"
  }
}`;
  }
}
```

---

## 🎯 FASE 4: Partner-Specifieke Optimalisatie

### 4.1 Database Schema

**Nieuwe tabel: `partner_form_customizations`**
```sql
CREATE TABLE partner_form_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  industry_id INTEGER REFERENCES industries(id),
  form_template_id UUID REFERENCES lead_form_templates(id),
  
  -- Customization
  custom_config JSONB NOT NULL, -- Aangepaste form config voor deze partner
  customization_reason TEXT, -- Waarom aangepast (bijv. "verliest vaak op budget")
  
  -- Performance tracking
  leads_count INTEGER DEFAULT 0,
  win_rate_pct NUMERIC(5,2),
  avg_deal_value NUMERIC(10,2),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(partner_id, industry_id, form_template_id)
);
```

---

## 🎯 FASE 5: AI Sales Assist

### 5.1 Service Implementation

**Nieuwe file: `services/aiSalesAssistService.js`**
```javascript
class AISalesAssistService {
  async generateLeadSummary(leadId) {
    // Fetch lead data
    const lead = await this.fetchLead(leadId);
    const formAnswers = await this.fetchFormAnswers(leadId);
    const prediction = await this.fetchPrediction(leadId);
    
    // Generate summary with AI
    const prompt = this.buildSummaryPrompt(lead, formAnswers, prediction);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een sales assistent die partners helpt met lead kwalificatie.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  buildSummaryPrompt(lead, formAnswers, prediction) {
    return `Genereer een sales samenvatting voor deze lead:

Lead gegevens:
- Naam: ${lead.name}
- Email: ${lead.email}
- Telefoon: ${lead.phone}
- Provincie: ${lead.province}
- Postcode: ${lead.postcode}

Form antwoorden:
- Urgentie: ${formAnswers.urgency}
- Budget: ${formAnswers.budget}
- Type klus: ${formAnswers.job_type}
- Beschrijving: ${formAnswers.description}

Voorspelling:
- Deal waarde: €${prediction.predicted_deal_value}
- Win kans: ${prediction.predicted_win_probability}%

Geef terug als JSON:
{
  "summary": {
    "situatie": "<3 bullets over situatie>",
    "urgentie": "<urgentie indicator>",
    "verwachte_dealwaarde": "<dealwaarde>"
  },
  "call_script": {
    "opening": "<voorgestelde openingszin>",
    "vragen": ["<vraag 1>", "<vraag 2>", "<vraag 3>"]
  },
  "whatsapp_template": "<1-klik WhatsApp template>",
  "email_template": "<1-klik email template>"
}`;
  }
}
```

---

## 🎯 FASE 6: Multi-Channel Vraaglogica

### 6.1 Central Question Engine

**Nieuwe file: `services/questionEngineService.js`**
```javascript
class QuestionEngineService {
  async getQuestionsForChannel(channel, industryId, context = {}) {
    // Fetch base form template
    const template = await this.fetchFormTemplate(industryId);
    
    // Adapt for channel
    switch (channel) {
      case 'web':
        return this.adaptForWeb(template, context);
      case 'whatsapp':
        return this.adaptForWhatsApp(template, context);
      case 'phone':
        return this.adaptForPhone(template, context);
      default:
        return template;
    }
  }

  adaptForWhatsApp(template, context) {
    // Simplify for WhatsApp: fewer steps, shorter questions
    return {
      ...template,
      steps: template.steps.map(step => ({
        ...step,
        fields: step.fields.map(field => ({
          ...field,
          // Simplify options for WhatsApp
          options: field.options?.slice(0, 5) // Max 5 opties
        }))
      }))
    };
  }

  adaptForPhone(template, context) {
    // Convert to script format for phone calls
    return {
      ...template,
      format: 'script',
      steps: template.steps.map(step => ({
        ...step,
        script: this.generatePhoneScript(step)
      }))
    };
  }
}
```

---

## 🎯 FASE 7: Benchmark & Insights Dashboard

### 7.1 Database Views

**Nieuwe view: `form_benchmarks`**
```sql
CREATE MATERIALIZED VIEW form_benchmarks AS
SELECT 
  industry_id,
  
  -- Budget benchmarks
  AVG(CASE WHEN budget IS NOT NULL THEN budget::NUMERIC END) as avg_budget,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY budget::NUMERIC) as median_budget,
  
  -- Job type distribution
  jsonb_object_agg(job_type, job_type_count) as job_type_distribution,
  
  -- Urgency distribution
  jsonb_object_agg(urgency, urgency_count) as urgency_distribution,
  
  -- Seasonal patterns
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as leads_per_month
  
FROM leads
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY industry_id, DATE_TRUNC('month', created_at);
```

### 7.2 API Endpoints

**Nieuwe routes: `routes/api.js`**
```javascript
// GET /api/benchmarks/:industryId
router.get('/benchmarks/:industryId', async (req, res) => {
  // Return benchmark data for industry
});

// GET /api/insights/partner/:partnerId
router.get('/insights/partner/:partnerId', async (req, res) => {
  // Return partner-specific insights vs benchmarks
});
```

---

## 📅 IMPLEMENTATIE PRIORITEITEN

### Sprint 1 (Week 1-2)
1. ✅ FASE 1.1: Database schema voor form_analytics
2. ✅ FASE 1.2: Frontend tracking JavaScript
3. ✅ FASE 1.3: Backend API endpoint

### Sprint 2 (Week 3-4)
4. ✅ FASE 2.1: Lead value prediction database
5. ✅ FASE 2.2: AI prediction service
6. ✅ Integratie in form submission flow

### Sprint 3 (Week 5-6)
7. ✅ FASE 3: Form optimization engine
8. ✅ FASE 4: Partner-specific customization

### Sprint 4 (Week 7-8)
9. ✅ FASE 5: AI Sales Assist
10. ✅ FASE 6: Multi-channel engine

### Sprint 5 (Week 9-10)
11. ✅ FASE 7: Benchmark dashboard
12. ✅ Testing & refinement

---

## 🔧 TECHNISCHE OVERWEGINGEN

### Performance
- Materialized views voor snelle queries
- Background jobs voor AI processing
- Caching voor prediction results

### Privacy
- Anonymize session data na X dagen
- GDPR compliance voor analytics
- Opt-out mechanisme voor tracking

### Scalability
- Queue system voor AI requests (Bull/BullMQ)
- Rate limiting voor AI endpoints
- Database indexing strategy

---

## 📊 SUCCESS METRICS

- **Form Completion Rate**: +10% binnen 3 maanden
- **Drop-off Rate**: -15% binnen 3 maanden
- **Lead Quality**: +20% win rate binnen 6 maanden
- **Partner Satisfaction**: +25% binnen 6 maanden
- **Deal Value Accuracy**: AI predictions binnen 15% van actual

---

**Status:** 🎯 Ready for implementation  
**Next Steps:** Start met FASE 1 database migrations

