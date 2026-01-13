const OpenAI = require('openai');
const { supabaseAdmin } = require('../config/supabase');

class LeadValuePredictionService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.modelVersion = 'v1.0';
  }

  /**
   * Predict lead value based on form answers and lead data
   * @param {Object} leadData - Lead data from database
   * @param {Object} formAnswers - Form submission answers
   * @param {Object} industryData - Industry information
   * @returns {Promise<Object>} Prediction object
   */
  async predictLeadValue(leadData, formAnswers, industryData) {
    try {
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
            content: 'Je bent een expert in lead kwalificatie en deal value voorspelling voor B2B lead generatie platforms. Geef altijd een geldig JSON object terug zonder extra tekst.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3 // Lower temperature for more consistent predictions
      });

      const prediction = JSON.parse(completion.choices[0].message.content);
      
      // Validate prediction structure
      this.validatePrediction(prediction);
      
      // Store prediction in database
      await this.storePrediction(leadData.id, industryData.id, prediction);
      
      return prediction;
    } catch (error) {
      console.error('Error predicting lead value:', error);
      throw error;
    }
  }

  /**
   * Extract features from lead data and form answers
   */
  extractFeatures(leadData, formAnswers, industryData) {
    // Parse budget string to numeric range
    const budgetRange = this.parseBudgetRange(formAnswers.budget);
    
    // Determine urgency level
    const urgencyLevel = this.parseUrgency(formAnswers.urgency);
    
    // Check if description is detailed
    const hasDetailedDescription = formAnswers.description && 
                                   formAnswers.description.length > 100;
    
    return {
      // Lead basics
      industry: industryData.name,
      province: leadData.province || null,
      postcode: leadData.postcode || null,
      
      // Form answers
      urgency: formAnswers.urgency || null,
      urgency_level: urgencyLevel,
      budget: formAnswers.budget || null,
      budget_min: budgetRange.min,
      budget_max: budgetRange.max,
      job_type: formAnswers.job_type || null,
      job_category: formAnswers.job_category || null,
      description_length: formAnswers.description?.length || 0,
      
      // Calculated features
      has_budget: !!formAnswers.budget && 
                  formAnswers.budget !== 'Ik weet het nog niet precies' &&
                  formAnswers.budget !== 'Ik weet het nog niet precies',
      is_urgent: urgencyLevel >= 3, // High urgency
      has_description: hasDetailedDescription,
      has_contact_preference: !!formAnswers.contact_preference,
      
      // Additional form fields (variable steps)
      additional_fields: this.extractAdditionalFields(formAnswers)
    };
  }

  /**
   * Parse budget string to numeric range
   */
  parseBudgetRange(budgetString) {
    if (!budgetString) return { min: null, max: null };
    
    // Remove euro signs and spaces
    const clean = budgetString.replace(/€|\s/g, '');
    
    // Patterns: "Tot €500", "€500 – €1.500", "€1.500 – €3.000", "Meer dan €7.500"
    if (clean.includes('Tot')) {
      const max = parseInt(clean.replace('Tot', '').replace(/\./g, ''));
      return { min: 0, max: max || null };
    }
    
    if (clean.includes('Meerdan')) {
      const min = parseInt(clean.replace('Meerdan', '').replace(/\./g, ''));
      return { min: min || null, max: null };
    }
    
    if (clean.includes('–') || clean.includes('-')) {
      const parts = clean.split(/[–-]/);
      const min = parseInt(parts[0].replace(/\./g, ''));
      const max = parseInt(parts[1]?.replace(/\./g, ''));
      return { min: min || null, max: max || null };
    }
    
    return { min: null, max: null };
  }

  /**
   * Parse urgency to numeric level (1-5)
   */
  parseUrgency(urgencyString) {
    if (!urgencyString) return 2; // Default: medium
    
    const lower = urgencyString.toLowerCase();
    
    if (lower.includes('spoed') || lower.includes('zo snel mogelijk')) return 5;
    if (lower.includes('binnen enkele dagen') || lower.includes('weken')) return 4;
    if (lower.includes('3 maanden')) return 3;
    if (lower.includes('6 maanden')) return 2;
    if (lower.includes('overleg') || lower.includes('nader')) return 1;
    
    return 2; // Default
  }

  /**
   * Extract additional fields from form answers (variable steps)
   */
  extractAdditionalFields(formAnswers) {
    const additional = {};
    const reservedFields = [
      'urgency', 'budget', 'job_type', 'job_category', 'description',
      'first_name', 'last_name', 'email', 'phone', 'contact_preference',
      'postcode', 'city', 'province'
    ];
    
    Object.keys(formAnswers).forEach(key => {
      if (!reservedFields.includes(key)) {
        additional[key] = formAnswers[key];
      }
    });
    
    return additional;
  }

  /**
   * Build prediction prompt for OpenAI
   */
  buildPredictionPrompt(features, industryData) {
    return `Voorspel de lead value voor deze lead:

Branche: ${features.industry}
Provincie: ${features.province || 'Onbekend'}
Postcode: ${features.postcode || 'Onbekend'}

Urgentie: ${features.urgency || 'Onbekend'} (niveau: ${features.urgency_level}/5)
Budget: ${features.budget || 'Onbekend'} (range: €${features.budget_min || '?'} - €${features.budget_max || '?'})
Type klus: ${features.job_type || 'Onbekend'}
Categorie: ${features.job_category || 'Onbekend'}
Beschrijving lengte: ${features.description_length} karakters

Extra indicatoren:
- Heeft budget opgegeven: ${features.has_budget ? 'Ja' : 'Nee'}
- Is urgent: ${features.is_urgent ? 'Ja' : 'Nee'}
- Heeft gedetailleerde beschrijving: ${features.has_description ? 'Ja' : 'Nee'}
- Heeft contact voorkeur: ${features.has_contact_preference ? 'Ja' : 'Nee'}

Geef terug als JSON object:
{
  "predicted_deal_value": <nummer in euro's, bijv. 2500>,
  "predicted_win_probability": <percentage 0-100, bijv. 75>,
  "predicted_response_time_hours": <verwacht aantal uren tot eerste contact, bijv. 2.5>,
  "prediction_confidence": <percentage 0-100, hoe zeker ben je van deze voorspelling>,
  "prediction_factors": {
    "budget_indicator": "<uitleg waarom budget belangrijk is>",
    "urgency_factor": "<uitleg urgentie impact>",
    "job_type_factor": "<uitleg job type impact>",
    "location_factor": "<uitleg locatie impact>",
    "description_factor": "<uitleg beschrijving impact>"
  }
}

Richtlijnen:
- Deal value: Baseer op budget range, job type, en branche gemiddelden
- Win probability: Hoger bij urgentie, duidelijk budget, gedetailleerde beschrijving
- Response time: Lager bij urgentie, hoger bij lage urgentie
- Confidence: Hoger bij meer beschikbare informatie`;
  }

  /**
   * Validate prediction structure
   */
  validatePrediction(prediction) {
    if (!prediction.predicted_deal_value || prediction.predicted_deal_value < 0) {
      throw new Error('Invalid predicted_deal_value');
    }
    
    if (prediction.predicted_win_probability === undefined || 
        prediction.predicted_win_probability < 0 || 
        prediction.predicted_win_probability > 100) {
      throw new Error('Invalid predicted_win_probability');
    }
    
    if (!prediction.prediction_factors) {
      prediction.prediction_factors = {};
    }
  }

  /**
   * Store prediction in database
   */
  async storePrediction(leadId, industryId, prediction) {
    const { data, error } = await supabaseAdmin
      .from('lead_value_predictions')
      .insert([{
        lead_id: leadId,
        industry_id: industryId,
        predicted_deal_value: parseFloat(prediction.predicted_deal_value),
        predicted_win_probability: parseFloat(prediction.predicted_win_probability),
        predicted_response_time_hours: prediction.predicted_response_time_hours ? 
                                       parseFloat(prediction.predicted_response_time_hours) : null,
        model_version: this.modelVersion,
        prediction_confidence: prediction.prediction_confidence ? 
                              parseFloat(prediction.prediction_confidence) : null,
        prediction_factors: prediction.prediction_factors || {}
      }])
      .select()
      .single();

    if (error) {
      console.error('Error storing prediction:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update prediction with actual outcome
   */
  async updateActualOutcome(leadId, actualDealValue, actualWin, actualResponseTime) {
    try {
      const { error } = await supabaseAdmin.rpc('update_lead_prediction_outcome', {
        p_lead_id: leadId,
        p_actual_deal_value: actualDealValue,
        p_actual_win: actualWin,
        p_actual_response_time_hours: actualResponseTime
      });

      if (error) {
        console.error('Error updating prediction outcome:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in updateActualOutcome:', error);
      throw error;
    }
  }

  /**
   * Get prediction for a lead
   */
  async getPrediction(leadId) {
    const { data, error } = await supabaseAdmin
      .from('lead_value_predictions')
      .select('*')
      .eq('lead_id', leadId)
      .order('predicted_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching prediction:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get prediction statistics for an industry
   */
  async getIndustryStats(industryId, days = 30) {
    const { data, error } = await supabaseAdmin
      .from('lead_value_predictions')
      .select('*')
      .eq('industry_id', industryId)
      .gte('predicted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .not('actualized_at', 'is', null); // Only predictions with outcomes

    if (error) {
      console.error('Error fetching industry stats:', error);
      throw error;
    }

    // Calculate statistics
    const stats = {
      total_predictions: data.length,
      avg_deal_value_error: null,
      avg_win_prob_error: null,
      predictions_within_20pct: 0,
      predictions_within_50pct: 0
    };

    if (data.length > 0) {
      const errors = data
        .filter(p => p.deal_value_error_pct !== null)
        .map(p => p.deal_value_error_pct);
      
      if (errors.length > 0) {
        stats.avg_deal_value_error = errors.reduce((a, b) => a + b, 0) / errors.length;
        stats.predictions_within_20pct = errors.filter(e => e <= 20).length;
        stats.predictions_within_50pct = errors.filter(e => e <= 50).length;
      }

      const winErrors = data
        .filter(p => p.win_probability_error_pct !== null)
        .map(p => p.win_probability_error_pct);
      
      if (winErrors.length > 0) {
        stats.avg_win_prob_error = winErrors.reduce((a, b) => a + b, 0) / winErrors.length;
      }
    }

    return stats;
  }
}

module.exports = new LeadValuePredictionService();

