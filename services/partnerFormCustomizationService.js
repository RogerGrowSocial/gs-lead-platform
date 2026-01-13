const { supabaseAdmin } = require('../config/supabase');
const formOptimizationService = require('./formOptimizationService');

class PartnerFormCustomizationService {
  /**
   * Generate partner-specific customization based on performance
   * @param {string} partnerId - Partner UUID
   * @param {number} industryId - Industry ID
   * @param {string} formTemplateId - Base form template ID
   * @returns {Promise<Object>} Customization object
   */
  async generateCustomization(partnerId, industryId, formTemplateId) {
    try {
      // Get partner performance data
      const performance = await this.getPartnerPerformance(partnerId, industryId);
      
      // Get loss reasons
      const lossReasons = await this.getLossReasons(partnerId, industryId);
      
      // Get base form template
      const baseTemplate = await this.getFormTemplate(formTemplateId);
      
      // Analyze what needs customization
      const customizationNeeds = this.analyzeCustomizationNeeds(performance, lossReasons);
      
      if (customizationNeeds.length === 0) {
        return null; // No customization needed
      }
      
      // Generate customized config
      const customConfig = await this.generateCustomConfig(
        baseTemplate,
        customizationNeeds,
        lossReasons
      );
      
      // Store customization
      const customization = await this.storeCustomization(
        partnerId,
        industryId,
        formTemplateId,
        customConfig,
        customizationNeeds,
        lossReasons
      );
      
      return customization;
    } catch (error) {
      console.error('Error generating partner customization:', error);
      throw error;
    }
  }

  /**
   * Get partner performance data
   */
  async getPartnerPerformance(partnerId, industryId) {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('status, deal_value, first_contact_at, created_at, rejected_at')
      .eq('user_id', partnerId)
      .eq('industry_id', industryId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('Error fetching partner performance:', error);
      throw error;
    }

    const stats = {
      total: data.length,
      won: data.filter(l => l.status === 'won').length,
      lost: data.filter(l => l.status === 'lost').length,
      rejected: data.filter(l => l.status === 'rejected').length,
      avg_deal_value: null,
      avg_response_time: null
    };

    const wonLeads = data.filter(l => l.status === 'won' && l.deal_value);
    if (wonLeads.length > 0) {
      stats.avg_deal_value = wonLeads.reduce((sum, l) => sum + parseFloat(l.deal_value || 0), 0) / wonLeads.length;
    }

    const contactedLeads = data.filter(l => l.first_contact_at && l.created_at);
    if (contactedLeads.length > 0) {
      const responseTimes = contactedLeads.map(l => {
        const created = new Date(l.created_at);
        const contacted = new Date(l.first_contact_at);
        return (contacted - created) / (1000 * 60 * 60); // hours
      });
      stats.avg_response_time = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    return stats;
  }

  /**
   * Get loss reasons from rejected/lost leads
   */
  async getLossReasons(partnerId, industryId) {
    // Get leads with feedback or rejection reasons
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('id, status, message, assignment_factors')
      .eq('user_id', partnerId)
      .eq('industry_id', industryId)
      .in('status', ['rejected', 'lost'])
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('Error fetching loss reasons:', error);
      throw error;
    }

    // Get feedback
    const leadIds = leads.map(l => l.id);
    let feedback = [];
    if (leadIds.length > 0) {
      const { data: feedbackData } = await supabaseAdmin
        .from('lead_feedback')
        .select('lead_id, comment, rating')
        .in('lead_id', leadIds);
      feedback = feedbackData || [];
    }

    // Analyze loss reasons
    const lossReasons = {
      budget_too_low: 0,
      wrong_job_type: 0,
      wrong_location: 0,
      not_urgent_enough: 0,
      too_small: 0,
      other: 0
    };

    const feedbackTexts = [];

    leads.forEach(lead => {
      const message = lead.message?.toLowerCase() || '';
      const factors = lead.assignment_factors || {};
      
      // Analyze message and factors for loss reasons
      if (message.includes('budget') || message.includes('te duur') || factors.budget_too_low) {
        lossReasons.budget_too_low++;
      }
      if (message.includes('type') || message.includes('soort') || factors.wrong_job_type) {
        lossReasons.wrong_job_type++;
      }
      if (message.includes('locatie') || message.includes('plaats') || factors.wrong_location) {
        lossReasons.wrong_location++;
      }
      if (message.includes('urgent') || message.includes('spoed')) {
        lossReasons.not_urgent_enough++;
      }
      if (message.includes('klein') || message.includes('te klein')) {
        lossReasons.too_small++;
      }
    });

    feedback?.forEach(fb => {
      if (fb.comment) {
        feedbackTexts.push(fb.comment);
      }
    });

    return {
      reasons: lossReasons,
      feedback: feedbackTexts,
      total_losses: leads.length
    };
  }

  /**
   * Analyze what customization is needed
   */
  analyzeCustomizationNeeds(performance, lossReasons) {
    const needs = [];

    // High budget rejection rate
    if (lossReasons.reasons.budget_too_low > 2 && 
        lossReasons.reasons.budget_too_low / lossReasons.total_losses > 0.3) {
      needs.push({
        type: 'add_budget_filter',
        priority: 'high',
        reason: 'Partner verliest vaak op budget - voeg budget filter toe'
      });
    }

    // Wrong job type
    if (lossReasons.reasons.wrong_job_type > 2 &&
        lossReasons.reasons.wrong_job_type / lossReasons.total_losses > 0.3) {
      needs.push({
        type: 'add_job_type_filter',
        priority: 'high',
        reason: 'Partner verliest vaak op verkeerde job type - voeg specifieke vraag toe'
      });
    }

    // Low win rate
    if (performance.won + performance.lost > 10) {
      const winRate = performance.won / (performance.won + performance.lost);
      if (winRate < 0.3) {
        needs.push({
          type: 'improve_qualification',
          priority: 'high',
          reason: 'Lage win rate - voeg kwalificatie vragen toe'
        });
      }
    }

    return needs;
  }

  /**
   * Generate custom config based on needs
   */
  async generateCustomConfig(baseTemplate, needs, lossReasons) {
    // Start with base template
    const customConfig = JSON.parse(JSON.stringify(baseTemplate)); // Deep copy

    // Apply customizations based on needs
    needs.forEach(need => {
      if (need.type === 'add_budget_filter') {
        // Find budget step and add minimum filter
        const budgetStep = customConfig.steps.find(s => s.id === 'step-budget');
        if (budgetStep) {
          // Add help text about minimum budget
          budgetStep.fields[0].helpText = 
            'Let op: Voor deze partner is een minimum budget van €1.500 aanbevolen.';
        }
      }

      if (need.type === 'add_job_type_filter') {
        // Find work type step and add specific options
        const workTypeStep = customConfig.steps.find(s => s.id === 'step-3');
        if (workTypeStep) {
          // Add help text
          const jobTypeField = workTypeStep.fields.find(f => f.id === 'job_type');
          if (jobTypeField) {
            jobTypeField.helpText =
              'Specificeer zo duidelijk mogelijk het type klus voor een betere match.';
          }
        }
      }

      if (need.type === 'improve_qualification') {
        // Add a qualification step before contact
        const contactStep = customConfig.steps.find(s => s.id === 'step-1');
        const contactStepIndex = customConfig.steps.indexOf(contactStep);
        
        if (contactStepIndex > 0) {
          const qualificationStep = {
            id: `qualification-${Date.now()}`,
            title: 'Extra informatie',
            description: 'Help ons om de beste match voor je te vinden',
            order: contactStep.order - 0.5,
            isFixed: false,
            fields: [
              {
                id: 'project_timeline',
                type: 'select',
                label: 'Wanneer wil je starten met dit project?',
                required: true,
                options: [
                  'Binnen 1 week',
                  'Binnen 1 maand',
                  'Binnen 3 maanden',
                  'Later dit jaar',
                  'Nog onbekend'
                ],
                width: 'full',
                helpText: ''
              }
            ]
          };
          
          customConfig.steps.splice(contactStepIndex, 0, qualificationStep);
        }
      }
    });

    return customConfig;
  }

  /**
   * Store customization in database
   */
  async storeCustomization(partnerId, industryId, formTemplateId, customConfig, needs, lossReasons) {
    const { data, error } = await supabaseAdmin
      .from('partner_form_customizations')
      .upsert({
        partner_id: partnerId,
        industry_id: industryId,
        form_template_id: formTemplateId,
        custom_config: customConfig,
        customization_reason: needs.map(n => n.reason).join('; '),
        common_loss_reasons: lossReasons.reasons,
        common_rejection_feedback: lossReasons.feedback.slice(0, 10), // Top 10
        auto_generated: true,
        is_active: true
      }, {
        onConflict: 'partner_id,industry_id,form_template_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing customization:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get customization for a partner
   */
  async getCustomization(partnerId, industryId, formTemplateId = null) {
    let query = supabaseAdmin
      .from('partner_form_customizations')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('industry_id', industryId)
      .eq('is_active', true);

    if (formTemplateId) {
      query = query.eq('form_template_id', formTemplateId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching customization:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update customization performance metrics
   */
  async updatePerformance(customizationId) {
    const { error } = await supabaseAdmin.rpc('update_partner_customization_performance', {
      p_customization_id: customizationId
    });

    if (error) {
      console.error('Error updating customization performance:', error);
      throw error;
    }
  }
}

module.exports = new PartnerFormCustomizationService();

