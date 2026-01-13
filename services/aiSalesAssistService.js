const OpenAI = require('openai');
const { supabaseAdmin } = require('../config/supabase');
const leadValuePredictionService = require('./leadValuePredictionService');

class AISalesAssistService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Generate lead summary and sales script
   * @param {string} leadId - Lead UUID
   * @returns {Promise<Object>} Sales assist object with summary, call script, templates
   */
  async generateLeadSummary(leadId) {
    try {
      // Fetch lead data
      const lead = await this.fetchLead(leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Fetch form answers (from form submission or lead metadata)
      const formAnswers = await this.fetchFormAnswers(leadId, lead);
      
      // Fetch prediction if available
      const prediction = await leadValuePredictionService.getPrediction(leadId);
      
      // Fetch industry data
      const industry = await this.fetchIndustry(lead.industry_id);
      
      // Generate summary with AI
      const summary = await this.generateSummary(lead, formAnswers, prediction, industry);
      
      return summary;
    } catch (error) {
      console.error('Error generating lead summary:', error);
      throw error;
    }
  }

  /**
   * Fetch lead from database
   */
  async fetchLead(leadId) {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error) {
      console.error('Error fetching lead:', error);
      throw error;
    }

    return data;
  }

  /**
   * Fetch form answers (from form submission or lead metadata)
   */
  async fetchFormAnswers(leadId, lead) {
    // Try to get from form_analytics (if form was tracked)
    const { data: analytics } = await supabaseAdmin
      .from('form_analytics')
      .select('field_value, field_id')
      .eq('lead_id', leadId)
      .not('field_value', 'is', null);

    const formAnswers = {};
    
    if (analytics && analytics.length > 0) {
      analytics.forEach(a => {
        if (a.field_id && a.field_value) {
          formAnswers[a.field_id] = a.field_value;
        }
      });
    }

    // Fallback: extract from lead message/fields
    if (lead.message) {
      formAnswers.description = lead.message;
    }
    
    // Extract name parts
    if (lead.name) {
      const nameParts = lead.name.split(' ');
      formAnswers.first_name = nameParts[0] || '';
      formAnswers.last_name = nameParts.slice(1).join(' ') || '';
    }

    formAnswers.email = lead.email;
    formAnswers.phone = lead.phone;
    formAnswers.postcode = lead.postcode;
    formAnswers.province = lead.province;

    return formAnswers;
  }

  /**
   * Fetch industry data
   */
  async fetchIndustry(industryId) {
    const { data, error } = await supabaseAdmin
      .from('industries')
      .select('*')
      .eq('id', industryId)
      .single();

    if (error) {
      console.error('Error fetching industry:', error);
      return { name: 'Onbekend', id: industryId };
    }

    return data;
  }

  /**
   * Generate summary with AI
   */
  async generateSummary(lead, formAnswers, prediction, industry) {
    const prompt = this.buildSummaryPrompt(lead, formAnswers, prediction, industry);
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een sales assistent die partners helpt met lead kwalificatie en eerste contact. Geef altijd een geldig JSON object terug zonder extra tekst.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const summary = JSON.parse(completion.choices[0].message.content);
    
    // Enrich with prediction data if available
    if (prediction) {
      summary.prediction = {
        deal_value: prediction.predicted_deal_value,
        win_probability: prediction.predicted_win_probability,
        response_time_hours: prediction.predicted_response_time_hours
      };
    }

    return summary;
  }

  /**
   * Build summary prompt for AI
   */
  buildSummaryPrompt(lead, formAnswers, prediction, industry) {
    return `Genereer een sales samenvatting en call script voor deze lead:

LEAD GEGEVENS:
- Naam: ${formAnswers.first_name || ''} ${formAnswers.last_name || ''}
- Email: ${lead.email}
- Telefoon: ${lead.phone}
- Provincie: ${lead.province || 'Onbekend'}
- Postcode: ${lead.postcode || 'Onbekend'}
- Branche: ${industry.name}

FORMULIER ANTWOORDEN:
- Urgentie: ${formAnswers.urgency || 'Onbekend'}
- Budget: ${formAnswers.budget || 'Onbekend'}
- Type klus: ${formAnswers.job_type || 'Onbekend'}
- Categorie: ${formAnswers.job_category || 'Onbekend'}
- Beschrijving: ${formAnswers.description || lead.message || 'Geen beschrijving'}

${prediction ? `VOORSPELLING:
- Deal waarde: €${prediction.predicted_deal_value}
- Win kans: ${prediction.predicted_win_probability}%
- Verwacht response tijd: ${prediction.predicted_response_time_hours} uur` : ''}

Geef terug als JSON object:
{
  "summary": {
    "situatie": [
      "<bullet 1: korte samenvatting van de situatie>",
      "<bullet 2: belangrijkste details>",
      "<bullet 3: urgentie of timing>"
    ],
    "urgentie": "<urgentie indicator: hoog/medium/laag>",
    "verwachte_dealwaarde": "<dealwaarde in euro's of range>",
    "key_qualifiers": [
      "<kwalificatie punt 1>",
      "<kwalificatie punt 2>",
      "<kwalificatie punt 3>"
    ]
  },
  "call_script": {
    "opening": "<voorgestelde openingszin, persoonlijk en relevant>",
    "vragen": [
      "<vraag 1: om de situatie beter te begrijpen>",
      "<vraag 2: om urgentie te verifiëren>",
      "<vraag 3: om budget te bevestigen>",
      "<vraag 4: om volgende stappen te bespreken>"
    ],
    "objections": [
      "<mogelijke bezwaar 1 met weerlegging>",
      "<mogelijke bezwaar 2 met weerlegging>"
    ],
    "closing": "<voorgestelde afsluiting/next steps>"
  },
  "whatsapp_template": "<1-klik WhatsApp template, max 160 karakters, persoonlijk en actiegericht>",
  "email_template": {
    "subject": "<email onderwerp, max 50 karakters>",
    "body": "<email body, kort en actiegericht, max 200 woorden>"
  },
  "next_steps": [
    "<actie 1>",
    "<actie 2>",
    "<actie 3>"
  ]
}

Richtlijnen:
- Wees persoonlijk en relevant
- Focus op value proposition
- Maak het makkelijk voor de partner om te reageren
- Gebruik Nederlandse taal
- Wees concreet en actiegericht`;
  }

  /**
   * Generate quick summary (lighter version, faster)
   */
  async generateQuickSummary(leadId) {
    try {
      const lead = await this.fetchLead(leadId);
      const formAnswers = await this.fetchFormAnswers(leadId, lead);
      const prediction = await leadValuePredictionService.getPrediction(leadId);
      
      // Quick summary without full AI call
      const summary = {
        lead_name: lead.name,
        lead_phone: lead.phone,
        lead_email: lead.email,
        urgency: formAnswers.urgency || 'Onbekend',
        budget: formAnswers.budget || 'Onbekend',
        job_type: formAnswers.job_type || 'Onbekend',
        predicted_deal_value: prediction?.predicted_deal_value || null,
        predicted_win_probability: prediction?.predicted_win_probability || null
      };

      return summary;
    } catch (error) {
      console.error('Error generating quick summary:', error);
      throw error;
    }
  }
}

module.exports = new AISalesAssistService();

