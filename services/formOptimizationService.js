const OpenAI = require('openai');
const { supabaseAdmin } = require('../config/supabase');

class FormOptimizationService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Generate optimization suggestions for a form template
   * @param {number} industryId - Industry ID
   * @param {string} formTemplateId - Form template ID
   * @param {number} days - Number of days of analytics data to analyze
   * @returns {Promise<Array>} Array of optimization suggestions
   */
  async generateOptimizationSuggestions(industryId, formTemplateId, days = 30) {
    try {
      // Analyze form performance
      const performance = await this.analyzeFormPerformance(industryId, formTemplateId, days);
      
      // Get current form template
      const template = await this.getFormTemplate(formTemplateId);
      
      // Identify issues
      const issues = this.identifyIssues(performance, template);
      
      if (issues.length === 0) {
        return []; // No issues found
      }
      
      // Generate suggestions for each issue
      const suggestions = [];
      
      for (const issue of issues) {
        try {
          const suggestion = await this.generateSuggestionForIssue(issue, performance, template);
          if (suggestion) {
            suggestions.push(suggestion);
          }
        } catch (error) {
          console.error(`Error generating suggestion for issue ${issue.type}:`, error);
          // Continue with other issues
        }
      }
      
      // Store suggestions in database
      if (suggestions.length > 0) {
        await this.storeSuggestions(industryId, formTemplateId, suggestions, performance, days);
      }
      
      return suggestions;
    } catch (error) {
      console.error('Error generating optimization suggestions:', error);
      throw error;
    }
  }

  /**
   * Analyze form performance from materialized view
   */
  async analyzeFormPerformance(industryId, formTemplateId, days) {
    const { data, error } = await supabaseAdmin
      .from('form_step_performance')
      .select('*')
      .eq('industry_id', industryId)
      .eq('form_template_id', formTemplateId)
      .gte('last_seen_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('step_order');

    if (error) {
      console.error('Error fetching form performance:', error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Get form template
   */
  async getFormTemplate(formTemplateId) {
    const { data, error } = await supabaseAdmin
      .from('lead_form_templates')
      .select('config_json')
      .eq('id', formTemplateId)
      .single();

    if (error) {
      console.error('Error fetching form template:', error);
      throw error;
    }

    return data.config_json;
  }

  /**
   * Identify issues in form performance
   */
  identifyIssues(performance, template) {
    const issues = [];
    
    if (!performance || performance.length === 0) {
      return issues; // No data to analyze
    }
    
    performance.forEach(step => {
      // High drop-off rate (> 20%)
      if (step.drop_off_rate_pct > 20) {
        issues.push({
          type: 'high_drop_off',
          step_id: step.step_id,
          step_order: step.step_order,
          severity: step.drop_off_rate_pct > 40 ? 'high' : 'medium',
          metric: step.drop_off_rate_pct,
          priority: step.drop_off_rate_pct > 40 ? 'critical' : 'high',
          data: step
        });
      }
      
      // Low completion rate (< 70%)
      if (step.completion_rate_pct < 70) {
        issues.push({
          type: 'low_completion',
          step_id: step.step_id,
          step_order: step.step_order,
          severity: step.completion_rate_pct < 50 ? 'high' : 'medium',
          metric: step.completion_rate_pct,
          priority: step.completion_rate_pct < 50 ? 'critical' : 'high',
          data: step
        });
      }
      
      // Low win rate correlation (< 30% and enough data)
      if (step.win_rate_pct < 30 && step.total_completions > 50) {
        issues.push({
          type: 'low_win_rate',
          step_id: step.step_id,
          step_order: step.step_order,
          severity: 'medium',
          metric: step.win_rate_pct,
          priority: 'medium',
          data: step
        });
      }
      
      // Very long time spent (> 5 minutes average)
      if (step.avg_time_spent_seconds > 300) {
        issues.push({
          type: 'long_time_spent',
          step_id: step.step_id,
          step_order: step.step_order,
          severity: 'medium',
          metric: step.avg_time_spent_seconds,
          priority: 'medium',
          data: step
        });
      }
    });
    
    // Check for step ordering issues (later steps with better metrics should be earlier)
    for (let i = 0; i < performance.length - 1; i++) {
      const currentStep = performance[i];
      const nextStep = performance[i + 1];
      
      // If next step has much better completion rate, suggest reordering
      if (nextStep.completion_rate_pct > currentStep.completion_rate_pct + 15) {
        issues.push({
          type: 'reorder_suggestion',
          step_id: nextStep.step_id,
          step_order: nextStep.step_order,
          severity: 'low',
          metric: nextStep.completion_rate_pct - currentStep.completion_rate_pct,
          priority: 'low',
          data: { current: currentStep, next: nextStep }
        });
      }
    }
    
    return issues;
  }

  /**
   * Generate AI suggestion for a specific issue
   */
  async generateSuggestionForIssue(issue, performance, template) {
    const prompt = this.buildOptimizationPrompt(issue, performance, template);
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een expert in formulier optimalisatie en conversie rate optimalisatie. Geef altijd een geldig JSON object terug zonder extra tekst.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5
    });

    const suggestion = JSON.parse(completion.choices[0].message.content);
    
    // Validate and enrich suggestion
    suggestion.issue_type = issue.type;
    suggestion.target_step_id = issue.step_id;
    suggestion.priority = issue.priority;
    suggestion.severity = issue.severity;
    
    return suggestion;
  }

  /**
   * Build optimization prompt for AI
   */
  buildOptimizationPrompt(issue, performance, template) {
    const stepData = issue.data;
    const stepConfig = template.steps?.find(s => s.id === issue.step_id);
    
    return `Analyseer dit formulier probleem en geef een optimalisatie suggestie:

PROBLEEM:
Type: ${issue.type}
Stap ID: ${issue.step_id}
Stap Order: ${issue.step_order}
Severity: ${issue.severity}
Metric: ${issue.metric}

STAP PERFORMANCE DATA:
${JSON.stringify(stepData, null, 2)}

HUIDIGE STAP CONFIG:
${JSON.stringify(stepConfig, null, 2)}

VOLLEDIGE FORMULIER CONFIG:
${JSON.stringify(template, null, 2)}

Geef terug als JSON object:
{
  "suggestion_type": "<remove_step|reorder_steps|modify_field|add_field|change_options|simplify_step|split_step|merge_steps>",
  "target_step_id": "${issue.step_id}",
  "target_field_id": "<field_id als van toepassing, anders null>",
  "suggested_changes": {
    "action": "<specifieke actie>",
    "details": "<gedetailleerde beschrijving van wijzigingen>",
    "before": "<huidige staat>",
    "after": "<voorgestelde staat>"
  },
  "reasoning": "<waarom deze suggestie, max 200 woorden>",
  "expected_impact": {
    "completion_rate": "<verwacht effect, bijv. +5% of -3%>",
    "drop_off_rate": "<verwacht effect, bijv. -5% of +2%>",
    "time_spent": "<verwacht effect op tijd, bijv. -30 seconden>",
    "win_rate": "<verwacht effect op win rate, indien relevant>"
  },
  "estimated_effort": "<low|medium|high>",
  "priority": "${issue.priority}"
}

Richtlijnen:
- Focus op conversie optimalisatie (maximale completion rate, minimale drop-off)
- Houd rekening met de vaste stappen (step-1, step-2, step-3, step-urgency, step-budget) - deze kunnen niet verwijderd worden
- Voor high drop-off: overweeg stap vereenvoudigen, velden verwijderen, of opties reduceren
- Voor low completion: overweeg stap splitsen, velden toevoegen, of duidelijker maken
- Voor low win rate: overweeg betere kwalificatie vragen toe te voegen
- Wees specifiek en actiegericht`;
  }

  /**
   * Store suggestions in database
   */
  async storeSuggestions(industryId, formTemplateId, suggestions, performance, days) {
    const records = suggestions.map(suggestion => {
      // Find the step config for current_config
      const stepConfig = performance.find(p => p.step_id === suggestion.target_step_id);
      
      return {
        industry_id: industryId,
        form_template_id: formTemplateId,
        suggestion_type: suggestion.suggestion_type,
        target_step_id: suggestion.target_step_id,
        target_field_id: suggestion.target_field_id || null,
        current_config: stepConfig ? { step: stepConfig } : null,
        suggested_config: suggestion.suggested_changes?.after || null,
        suggested_changes: suggestion.suggested_changes || {},
        reasoning: suggestion.reasoning,
        expected_impact: suggestion.expected_impact || {},
        analytics_period_days: days,
        data_points_count: stepConfig?.total_starts || 0,
        baseline_metrics: stepConfig ? {
          completion_rate: stepConfig.completion_rate_pct,
          drop_off_rate: stepConfig.drop_off_rate_pct,
          avg_time_spent: stepConfig.avg_time_spent_seconds
        } : null,
        priority: suggestion.priority || 'medium',
        estimated_effort: suggestion.estimated_effort || 'medium',
        status: 'pending'
      };
    });

    const { data, error } = await supabaseAdmin
      .from('form_optimization_suggestions')
      .insert(records)
      .select();

    if (error) {
      console.error('Error storing optimization suggestions:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get suggestions for an industry/template
   */
  async getSuggestions(industryId, formTemplateId = null, status = 'pending') {
    let query = supabaseAdmin
      .from('form_optimization_suggestions')
      .select('*')
      .eq('industry_id', industryId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (formTemplateId) {
      query = query.eq('form_template_id', formTemplateId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching suggestions:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Update suggestion status
   */
  async updateSuggestionStatus(suggestionId, status, userId, rejectionReason = null) {
    const { error } = await supabaseAdmin.rpc('update_optimization_suggestion_status', {
      p_suggestion_id: suggestionId,
      p_status: status,
      p_user_id: userId,
      p_rejection_reason: rejectionReason
    });

    if (error) {
      console.error('Error updating suggestion status:', error);
      throw error;
    }
  }
}

module.exports = new FormOptimizationService();
