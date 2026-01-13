const { supabaseAdmin } = require('../config/supabase');

/**
 * QuestionEngineService
 * Multi-channel question engine for website wizards, WhatsApp bots, and call center scripts
 * Uses the same form template structure across all channels
 */
class QuestionEngineService {
  /**
   * Get questions for a specific channel
   * @param {string} channel - 'website', 'whatsapp', 'phone'
   * @param {number} industryId - Industry ID
   * @param {string} formTemplateId - Form template ID (optional)
   * @param {Object} context - Additional context (keywords, landing page, etc.)
   * @returns {Promise<Object>} Formatted questions for the channel
   */
  async getQuestionsForChannel(channel, industryId, formTemplateId = null, context = {}) {
    try {
      // Get form template
      const template = await this.getFormTemplate(industryId, formTemplateId);
      
      if (!template) {
        throw new Error('No form template found for this industry');
      }

      // Adapt questions for channel
      const adaptedQuestions = this.adaptForChannel(template, channel, context);
      
      return adaptedQuestions;
    } catch (error) {
      console.error('Error getting questions for channel:', error);
      throw error;
    }
  }

  /**
   * Get form template
   */
  async getFormTemplate(industryId, formTemplateId = null) {
    let query = supabaseAdmin
      .from('lead_form_templates')
      .select('*')
      .eq('industry_id', industryId)
      .eq('is_active', true);

    if (formTemplateId) {
      query = query.eq('id', formTemplateId);
    }

    query = query.order('version', { ascending: false }).limit(1);

    const { data, error } = await query.single();

    if (error) {
      console.error('Error fetching form template:', error);
      throw error;
    }

    return data?.config_json || null;
  }

  /**
   * Adapt form template for specific channel
   */
  adaptForChannel(template, channel, context) {
    const steps = template.steps || [];
    
    switch (channel) {
      case 'website':
        return this.adaptForWebsite(steps, context);
      case 'whatsapp':
        return this.adaptForWhatsApp(steps, context);
      case 'phone':
        return this.adaptForPhone(steps, context);
      default:
        return this.adaptForWebsite(steps, context);
    }
  }

  /**
   * Adapt for website (full form)
   */
  adaptForWebsite(steps, context) {
    // Website uses full form structure
    return {
      channel: 'website',
      steps: steps.map(step => ({
        id: step.id,
        title: step.title,
        description: step.description,
        order: step.order,
        fields: step.fields.map(field => ({
          id: field.id,
          type: field.type,
          label: field.label,
          required: field.required,
          placeholder: field.placeholder,
          helpText: field.helpText,
          options: field.options,
          width: field.width
        }))
      })),
      settings: {
        showProgressBar: true,
        allowStepNavigation: true
      }
    };
  }

  /**
   * Adapt for WhatsApp (conversational, one question at a time)
   */
  adaptForWhatsApp(steps, context) {
    const questions = [];
    
    steps.forEach(step => {
      step.fields.forEach(field => {
        // Skip heading fields for WhatsApp
        if (field.type === 'heading') return;

        let questionText = field.label;
        if (field.helpText) {
          questionText += `\n${field.helpText}`;
        }

        const question = {
          id: field.id,
          step_id: step.id,
          step_title: step.title,
          question: questionText,
          type: field.type,
          required: field.required,
          options: field.options || null,
          validation: this.getValidationRules(field)
        };

        questions.push(question);
      });
    });

    return {
      channel: 'whatsapp',
      questions: questions,
      settings: {
        format: 'conversational',
        oneAtATime: true,
        allowBack: true
      }
    };
  }

  /**
   * Adapt for phone (call script format)
   */
  adaptForPhone(steps, context) {
    const script = {
      channel: 'phone',
      sections: []
    };

    steps.forEach(step => {
      const section = {
        step_id: step.id,
        title: step.title,
        introduction: step.description || `Laten we praten over ${step.title.toLowerCase()}`,
        questions: []
      };

      step.fields.forEach(field => {
        if (field.type === 'heading') return;

        const question = {
          id: field.id,
          question: this.formatPhoneQuestion(field),
          type: field.type,
          required: field.required,
          options: field.options || null,
          followUp: this.getFollowUpQuestions(field)
        };

        section.questions.push(question);
      });

      script.sections.push(section);
    });

    return script;
  }

  /**
   * Format question for phone conversation
   */
  formatPhoneQuestion(field) {
    let question = field.label;
    
    // Add natural language for phone
    if (field.type === 'select' || field.type === 'radio') {
      question += ' Wat zou je zeggen?';
    } else if (field.type === 'yesno') {
      question += ' Is dat zo?';
    } else {
      question += ' Kun je me daar meer over vertellen?';
    }

    return question;
  }

  /**
   * Get follow-up questions based on field type
   */
  getFollowUpQuestions(field) {
    const followUps = [];

    if (field.type === 'select' && field.options) {
      followUps.push('Kun je me vertellen waarom je voor deze optie kiest?');
    }

    if (field.type === 'budget') {
      followUps.push('Is dit budget flexibel of vast?');
    }

    if (field.type === 'urgency') {
      followUps.push('Wat maakt dit urgent voor je?');
    }

    return followUps;
  }

  /**
   * Get validation rules for a field
   */
  getValidationRules(field) {
    const rules = {};

    if (field.required) {
      rules.required = true;
    }

    switch (field.type) {
      case 'email':
        rules.pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        break;
      case 'tel':
        rules.pattern = /^[\d\s\+\-\(\)]+$/;
        break;
      case 'number':
        rules.type = 'number';
        break;
    }

    return rules;
  }

  /**
   * Process answer and get next question
   * @param {string} channel - Channel type
   * @param {string} questionId - Current question ID
   * @param {*} answer - User's answer
   * @param {Object} sessionData - Current session data
   * @returns {Promise<Object>} Next question or completion
   */
  async processAnswer(channel, questionId, answer, sessionData = {}) {
    try {
      // Get form template
      const template = await this.getFormTemplate(sessionData.industryId, sessionData.formTemplateId);
      const questions = this.adaptForChannel(template, channel, sessionData.context);

      // Find current question
      let currentIndex = -1;
      if (channel === 'whatsapp') {
        currentIndex = questions.questions.findIndex(q => q.id === questionId);
      } else if (channel === 'phone') {
        // For phone, find in sections
        for (let i = 0; i < questions.sections.length; i++) {
          const qIndex = questions.sections[i].questions.findIndex(q => q.id === questionId);
          if (qIndex !== -1) {
            currentIndex = i * 1000 + qIndex; // Simple indexing
            break;
          }
        }
      }

      // Store answer
      sessionData.answers = sessionData.answers || {};
      sessionData.answers[questionId] = answer;

      // Get next question
      if (channel === 'whatsapp') {
        const nextIndex = currentIndex + 1;
        if (nextIndex < questions.questions.length) {
          return {
            next: questions.questions[nextIndex],
            completed: false
          };
        } else {
          return {
            next: null,
            completed: true,
            answers: sessionData.answers
          };
        }
      }

      // For phone, return next section/question
      if (channel === 'phone') {
        // Similar logic for phone
        return {
          next: null,
          completed: true,
          answers: sessionData.answers
        };
      }

      return {
        next: null,
        completed: true,
        answers: sessionData.answers
      };
    } catch (error) {
      console.error('Error processing answer:', error);
      throw error;
    }
  }

  /**
   * Get dynamic form starter based on search intent/keywords
   * @param {number} industryId - Industry ID
   * @param {Object} context - Context (keywords, landing page, etc.)
   * @returns {Promise<Object>} Adapted form starter
   */
  async getDynamicStarter(industryId, context = {}) {
    try {
      const template = await this.getFormTemplate(industryId);
      
      if (!template) {
        throw new Error('No template found');
      }

      // Analyze context for micro-segmentation
      const adaptedSteps = this.adaptForContext(template.steps, context);

      return {
        steps: adaptedSteps,
        context: context
      };
    } catch (error) {
      console.error('Error getting dynamic starter:', error);
      throw error;
    }
  }

  /**
   * Adapt steps based on context (keywords, landing page)
   */
  adaptForContext(steps, context) {
    // If keywords suggest urgency, prioritize urgency step
    if (context.keywords?.some(k => ['spoed', 'urgent', 'snel', 'direct'].includes(k.toLowerCase()))) {
      // Reorder to show urgency earlier
      const urgencyStep = steps.find(s => s.id === 'step-urgency');
      if (urgencyStep) {
        const otherSteps = steps.filter(s => s.id !== 'step-urgency');
        return [urgencyStep, ...otherSteps];
      }
    }

    // If landing page suggests budget focus, prioritize budget step
    if (context.landingPage?.includes('budget') || context.landingPage?.includes('prijs')) {
      const budgetStep = steps.find(s => s.id === 'step-budget');
      if (budgetStep) {
        const otherSteps = steps.filter(s => s.id !== 'step-budget');
        return [...otherSteps.slice(0, 2), budgetStep, ...otherSteps.slice(2)];
      }
    }

    // Default: return as-is
    return steps;
  }
}

module.exports = new QuestionEngineService();

