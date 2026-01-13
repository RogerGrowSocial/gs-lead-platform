/**
 * Form Analytics Tracker
 * Tracks user interactions with form steps and fields for analytics
 */
class FormAnalyticsTracker {
  constructor(options = {}) {
    this.sessionId = options.sessionId || this.generateSessionId();
    this.industryId = options.industryId || null;
    this.formTemplateId = options.formTemplateId || null;
    this.stepStartTimes = {};
    this.currentStep = null;
    this.trackingEnabled = true;
    this.pendingEvents = [];
    this.flushInterval = null;
    
    // Initialize
    this.init();
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize tracker
   */
  init() {
    // Track page visibility changes (for drop-off detection)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.currentStep) {
        this.trackDropOff(this.currentStep, 'tab_switch');
      }
    });

    // Track beforeunload (user leaving page)
    window.addEventListener('beforeunload', () => {
      if (this.currentStep) {
        // Send synchronous request if possible
        this.trackDropOff(this.currentStep, 'page_close', true);
      }
    });

    // Flush pending events every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushPendingEvents();
    }, 5000);

    // Track referrer and source
    this.trackPageLoad();
  }

  /**
   * Track page load
   */
  trackPageLoad() {
    const urlParams = new URLSearchParams(window.location.search);
    const sourceKeyword = urlParams.get('keyword') || urlParams.get('utm_term');
    const sourceCampaign = urlParams.get('utm_campaign') || urlParams.get('campaign_id');
    
    this.sourceKeyword = sourceKeyword;
    this.sourceCampaign = sourceCampaign;
    this.referrer = document.referrer;
  }

  /**
   * Track step start
   */
  trackStepStart(stepId, stepOrder, stepTitle) {
    if (!this.trackingEnabled) return;

    this.currentStep = stepId;
    this.stepStartTimes[stepId] = Date.now();
    
    const event = {
      type: 'step_start',
      step_id: stepId,
      step_order: stepOrder,
      step_title: stepTitle,
      started_at: new Date().toISOString()
    };

    this.sendEvent(event);
  }

  /**
   * Track step completion
   */
  trackStepComplete(stepId, fieldData = {}) {
    if (!this.trackingEnabled) return;

    const startTime = this.stepStartTimes[stepId];
    const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : null;
    
    const event = {
      type: 'step_complete',
      step_id: stepId,
      completed_at: new Date().toISOString(),
      time_spent_seconds: timeSpent,
      field_values: fieldData
    };

    this.sendEvent(event);
    
    // Clear step start time
    delete this.stepStartTimes[stepId];
    this.currentStep = null;
  }

  /**
   * Track drop-off
   */
  trackDropOff(stepId, reason = 'unknown', sync = false) {
    if (!this.trackingEnabled) return;

    const startTime = this.stepStartTimes[stepId];
    const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : null;
    
    const event = {
      type: 'drop_off',
      step_id: stepId,
      dropped_off: true,
      drop_off_reason: reason,
      completed_at: null,
      time_spent_seconds: timeSpent
    };

    if (sync) {
      // Try to send synchronously (may not work in all browsers)
      this.sendEventSync(event);
    } else {
      this.sendEvent(event);
    }
  }

  /**
   * Track field interaction
   */
  trackFieldInteraction(fieldId, fieldType, value, metadata = {}) {
    if (!this.trackingEnabled) return;

    const event = {
      type: 'field_interaction',
      field_id: fieldId,
      field_type: fieldType,
      field_value: value,
      field_value_metadata: metadata
    };

    this.sendEvent(event);
  }

  /**
   * Track field value change (for select/radio/checkbox)
   */
  trackFieldChange(fieldId, fieldType, oldValue, newValue, optionsViewed = []) {
    if (!this.trackingEnabled) return;

    const metadata = {
      old_value: oldValue,
      options_viewed: optionsViewed,
      changed_at: new Date().toISOString()
    };

    this.trackFieldInteraction(fieldId, fieldType, newValue, metadata);
  }

  /**
   * Send event to backend (async)
   */
  async sendEvent(eventData) {
    const event = {
      session_id: this.sessionId,
      industry_id: this.industryId,
      form_template_id: this.formTemplateId,
      referrer: this.referrer,
      source_keyword: this.sourceKeyword,
      source_campaign_id: this.sourceCampaign,
      user_agent: navigator.userAgent,
      ...eventData
    };

    // Add to pending events queue
    this.pendingEvents.push(event);

    // Try to send immediately
    try {
      const response = await fetch('/api/form-analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true // Keep request alive even if page unloads
      });

      if (response.ok) {
        // Remove from pending queue
        const index = this.pendingEvents.indexOf(event);
        if (index > -1) {
          this.pendingEvents.splice(index, 1);
        }
      }
    } catch (error) {
      console.error('Analytics tracking error:', error);
      // Event stays in pending queue for retry
    }
  }

  /**
   * Send event synchronously (for page unload)
   */
  sendEventSync(eventData) {
    const event = {
      session_id: this.sessionId,
      industry_id: this.industryId,
      form_template_id: this.formTemplateId,
      referrer: this.referrer,
      source_keyword: this.sourceKeyword,
      source_campaign_id: this.sourceCampaign,
      user_agent: navigator.userAgent,
      ...eventData
    };

    try {
      // Use sendBeacon for reliable delivery on page unload
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
        navigator.sendBeacon('/api/form-analytics/track', blob);
      } else {
        // Fallback to sync XMLHttpRequest (may block)
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/form-analytics/track', false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(event));
      }
    } catch (error) {
      console.error('Sync analytics tracking error:', error);
    }
  }

  /**
   * Flush pending events
   */
  async flushPendingEvents() {
    if (this.pendingEvents.length === 0) return;

    const eventsToFlush = [...this.pendingEvents];
    
    for (const event of eventsToFlush) {
      try {
        const response = await fetch('/api/form-analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
          keepalive: true
        });

        if (response.ok) {
          const index = this.pendingEvents.indexOf(event);
          if (index > -1) {
            this.pendingEvents.splice(index, 1);
          }
        }
      } catch (error) {
        console.error('Failed to flush analytics event:', error);
      }
    }
  }

  /**
   * Link analytics to lead (after form submission)
   */
  linkToLead(leadId) {
    if (!leadId) return;

    // Update all pending events with lead_id
    this.pendingEvents.forEach(event => {
      event.lead_id = leadId;
    });

    // Send update request
    fetch('/api/form-analytics/link-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: this.sessionId,
        lead_id: leadId
      })
    }).catch(error => {
      console.error('Failed to link analytics to lead:', error);
    });
  }

  /**
   * Disable tracking
   */
  disable() {
    this.trackingEnabled = false;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }

  /**
   * Enable tracking
   */
  enable() {
    this.trackingEnabled = true;
  }
}

// Export for use in forms
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormAnalyticsTracker;
}

