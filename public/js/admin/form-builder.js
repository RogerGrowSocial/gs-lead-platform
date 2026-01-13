/**
 * Form Builder - Visual Form Builder for Lead Forms
 * Handles form configuration, preview rendering, and saving
 */

(function() {
  'use strict';

  // Get bootstrap data
  const DATA = window.FORM_BUILDER_DATA;
  if (!DATA) {
    console.error('FORM_BUILDER_DATA not found');
    return;
  }

  // Form Builder State
  const FormBuilder = {
    config: null,
    selectedStepId: null,
    selectedFieldId: null,
    currentPreviewStep: 0,

    // Field type definitions
    fieldTypes: {
      text: { label: 'Tekstveld', icon: 'fa-font' },
      email: { label: 'E-mailadres', icon: 'fa-envelope' },
      tel: { label: 'Telefoonnummer', icon: 'fa-phone' },
      textarea: { label: 'Tekstvak', icon: 'fa-align-left' },
      number: { label: 'Getal', icon: 'fa-hashtag' },
      select: { label: 'Selectie', icon: 'fa-list' },
      radio: { label: 'Meerkeuze', icon: 'fa-dot-circle' },
      checkbox: { label: 'Checkbox', icon: 'fa-check-square' },
      yesno: { label: 'Ja/Nee', icon: 'fa-toggle-on' },
      heading: { label: 'Koptekst', icon: 'fa-heading' }
    },

    // Initialize
    init() {
      // Load or create default config
      if (DATA.formConfig) {
        this.config = this.normalizeConfig(DATA.formConfig);
      } else {
        this.config = this.createDefaultConfig();
      }

      // Ensure steps have order and isFixed flag
      this.config.steps.forEach((step) => {
        if (!step.order) {
          // Determine order based on isFixed
          if (step.isFixed) {
            const fixedOrderMap = { 'step-job-type': 1, 'step-subcategory': 2, 'step-scope': 3 };
            step.order = fixedOrderMap[step.id] || step.order || 999;
          } else {
            // Variable steps start at 4
            const variableSteps = this.config.steps.filter(s => !s.isFixed);
            step.order = 4 + variableSteps.indexOf(step);
          }
        }
          if (step.isFixed === undefined) {
          // Auto-detect fixed steps by ID
          step.isFixed = ['step-job-type', 'step-subcategory', 'step-scope', 'step-urgency', 'step-description', 'step-budget', 'step-location', 'step-contact-name', 'step-contact-email', 'step-contact-phone'].includes(step.id);
        }
      });

      // Ensure correct step order (contact last, budget second-to-last)
      this.ensureStepOrder();

      // Select first step by default
      if (this.config.steps.length > 0) {
        this.selectedStepId = this.config.steps[0].id;
      }

      // Render everything
      this.renderStepsList();
      this.renderPreview();
      this.attachEventListeners();

      // Auto-hide alerts after 5 seconds
      setTimeout(() => {
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => {
          alert.style.transition = 'opacity 0.3s';
          alert.style.opacity = '0';
          setTimeout(() => alert.remove(), 300);
        });
      }, 5000);
    },

    // Normalize config (backwards compatibility)
    normalizeConfig(config) {
      // Ensure all required fields exist
      if (!config.steps) config.steps = [];
      if (!config.settings) config.settings = {};
      if (!config.version) config.version = 1;
      if (!config.industryId) config.industryId = DATA.industryId;
      if (!config.title) config.title = `Aanvraagformulier ${DATA.industryName}`;
      if (!config.slug) config.slug = DATA.slug || null;

      // Normalize steps
      // First, ensure isFixed flag is set
      config.steps = config.steps.map((step) => {
        if (step.isFixed === undefined) {
          step.isFixed = ['step-job-type', 'step-subcategory', 'step-scope', 'step-urgency', 'step-description', 'step-budget', 'step-location', 'step-contact-name', 'step-contact-email', 'step-contact-phone'].includes(step.id);
        }
        return step;
      });

      // Ensure urgency step exists
      const hasUrgencyStep = config.steps.some(s => s.id === 'step-urgency');
      if (!hasUrgencyStep) {
        config.steps.push({
          id: 'step-urgency',
          title: 'Wanneer wil je starten?',
          description: 'Dit helpt ons om beschikbare vakmensen voor je te vinden.',
          order: 998,
          isFixed: true,
          fields: [
            { id: 'urgency', type: 'select', label: 'Wanneer wil je starten?', required: true, placeholder: '', width: 'full', helpText: 'Dit helpt ons om beschikbare vakmensen voor je te vinden.', options: ['Met spoed / zo snel mogelijk', 'Binnen enkele dagen / weken', 'Binnen 3 maanden', 'Binnen 6 maanden', 'In overleg / nader te bepalen'] }
          ]
        });
      }

      // Ensure budget step exists
      const hasBudgetStep = config.steps.some(s => s.id === 'step-budget');
      if (!hasBudgetStep) {
        config.steps.push({
          id: 'step-budget',
          title: 'Budget',
          description: 'Een indicatie is voldoende. Dit helpt om passende offertes te krijgen.',
          order: 999,
          isFixed: true,
          fields: [
            { id: 'budget', type: 'select', label: 'Wat is je budget voor deze klus?', required: true, placeholder: '', width: 'full', helpText: 'Een indicatie is voldoende. Dit helpt om passende offertes te krijgen.', options: ['Tot €500', '€500 – €1.500', '€1.500 – €3.000', '€3.000 – €7.500', 'Meer dan €7.500', 'Ik weet het nog niet precies'] }
          ]
        });
      }

      // Ensure contact name step exists
      const hasContactNameStep = config.steps.some(s => s.id === 'step-contact-name');
      if (!hasContactNameStep) {
        config.steps.push({
          id: 'step-contact-name',
          title: 'Wat is je naam?',
          description: 'Vertel ons je naam zodat we je persoonlijk kunnen helpen.',
          order: 8,
          isFixed: true,
          fields: [
            { id: 'first_name', type: 'text', label: 'Voornaam', required: true, placeholder: 'Vul uw voornaam in', width: 'full', helpText: '' },
            { id: 'last_name', type: 'text', label: 'Achternaam', required: true, placeholder: 'Vul uw achternaam in', width: 'full', helpText: '' }
          ]
        });
      }

      // Ensure contact email step exists
      const hasContactEmailStep = config.steps.some(s => s.id === 'step-contact-email');
      if (!hasContactEmailStep) {
        config.steps.push({
          id: 'step-contact-email',
          title: 'Wat is je e-mailadres?',
          description: 'We gebruiken je e-mailadres om je offertes te sturen en contact met je op te nemen.',
          order: 9,
          isFixed: true,
          fields: [
            { id: 'email', type: 'email', label: 'E-mailadres', required: true, placeholder: 'voorbeeld@email.nl', width: 'full', helpText: '' }
          ]
        });
      }

      // Ensure contact phone step exists
      const hasContactPhoneStep = config.steps.some(s => s.id === 'step-contact-phone');
      if (!hasContactPhoneStep) {
        config.steps.push({
          id: 'step-contact-phone',
          title: 'Wat is je telefoonnummer?',
          description: 'We bellen je graag om je aanvraag door te nemen en de beste vakmensen voor je te vinden.',
          order: 10,
          isFixed: true,
          fields: [
            { id: 'phone', type: 'tel', label: 'Telefoonnummer', required: true, placeholder: '06 12345678', width: 'full', helpText: '' }
          ]
        });
      }

      // Separate fixed and variable steps
      const fixedSteps = config.steps.filter(s => s.isFixed);
      const variableSteps = config.steps.filter(s => !s.isFixed);

      // Normalize fixed steps
      fixedSteps.forEach((step) => {
        if (!step.title) {
          const titleMap = { 
            'step-contact-name': 'Wat is je naam?',
            'step-contact-email': 'Wat is je e-mailadres?',
            'step-contact-phone': 'Wat is je telefoonnummer?',
            'step-location': 'Waar is de klus?',
            'step-job-type': 'Wat voor klus?',
            'step-urgency': 'Wanneer wil je starten?',
            'step-budget': 'Budget'
          };
          step.title = titleMap[step.id] || `Stap ${step.order}`;
        }
        if (!step.fields) step.fields = [];
        if (!step.description) step.description = null;
        step.isFixed = true; // Enforce
      });

      // Normalize variable steps
      variableSteps.forEach((step, index) => {
        if (!step.id) step.id = `step-${Date.now()}-${index}`;
        if (!step.title) step.title = `Stap ${3 + index + 1}`;
        if (!step.order) step.order = 3 + index + 1;
        if (!step.fields) step.fields = [];
        if (!step.description) step.description = null;
        step.isFixed = false; // Enforce
      });

      // Combine all steps temporarily
      config.steps = [...fixedSteps, ...variableSteps];
      
      // Use ensureStepOrder to properly order (contact last, budget second-to-last)
      // We need to temporarily set this.config to use ensureStepOrder
      const tempConfig = this.config;
      this.config = config;
      this.ensureStepOrder();
      config = this.config;
      this.config = tempConfig;

      // Normalize fields for all steps
      config.steps.forEach((step) => {
        step.fields = step.fields.map((field, fieldIndex) => {
          if (!field.id) field.id = `field-${step.id}-${fieldIndex}`;
          if (!field.type) field.type = 'text';
          if (!field.label) field.label = 'Nieuw veld';
          if (field.required === undefined) {
            // Enforce required for skeleton fields
            const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'job_category', 'job_type', 'urgency', 'budget'];
            field.required = requiredFields.includes(field.id);
          }
          if (!field.width) field.width = 'full';
          if (!field.placeholder) field.placeholder = '';
          if (!field.helpText) field.helpText = '';

          // Ensure options array for select/radio/checkbox
          if (['select', 'radio', 'checkbox', 'multiselect'].includes(field.type) && !field.options) {
            field.options = [];
          }

          return field;
        });
      });

      // Normalize settings
      if (!config.settings.primaryColor) config.settings.primaryColor = '#ea5d0d';
      if (config.settings.showProgressBar === undefined) config.settings.showProgressBar = true;
      if (config.settings.requireContactStep === undefined) config.settings.requireContactStep = true;
      if (!config.settings.submitButtonText) config.settings.submitButtonText = 'Verstuur aanvraag';
      if (!config.settings.successMessage) {
        config.settings.successMessage = 'Bedankt! We nemen zo snel mogelijk contact met u op.';
      }

      return config;
    },

    // Create default config - MODERN FORM BUILDER: 8 FIXED STEPS (HARD-CODED)
    // This structure is ALWAYS the same, only steps 2, 3, and 5 have variable content
    createDefaultConfig() {
      return {
        version: 1,
        industryId: DATA.industryId,
        slug: DATA.slug || null,
        title: `Aanvraagformulier ${DATA.industryName}`,
        description: null,
        steps: [
          // STEP 1: Job Type (Main Category) - FIXED STRUCTURE, variable options
          {
            id: 'step-job-type',
            title: 'Wat voor klus?',
            description: 'Vertel ons meer over wat er nodig is bij uw klus. Selecteer het type werk dat het beste bij je situatie past.',
            order: 1,
            isFixed: true,
            isVariable: false, // Structure fixed, but options can be customized
            fields: [
              {
                id: 'job_type',
                type: 'radio-cards',
                label: 'Wat voor klus?',
                required: true,
                placeholder: '',
                width: 'full',
                helpText: '',
                options: [] // Will be filled by AI or admin
              }
            ]
          },
          // STEP 2: Subcategory / Job Details - VARIABLE (AI can customize)
          {
            id: 'step-subcategory',
            title: 'Meer details over je klus',
            description: 'Help ons om je nog beter te helpen door meer details te geven over je specifieke situatie.',
            order: 2,
            isFixed: true,
            isVariable: true, // AI can customize options
            fields: [
              {
                id: 'subcategory',
                type: 'radio-cards',
                label: 'Wat voor type klus precies?',
                required: true,
                placeholder: '',
                width: 'full',
                helpText: '',
                options: [] // AI will generate industry-specific options
              }
            ]
          },
          // STEP 3: Scope (Size of Project) - VARIABLE (AI can customize)
          {
            id: 'step-scope',
            title: 'Omvang van de klus',
            description: 'Geef aan hoe groot de klus ongeveer is. Dit helpt ons om de juiste vakmensen voor je te vinden.',
            order: 3,
            isFixed: true,
            isVariable: true, // AI can customize options
            fields: [
              {
                id: 'scope',
                type: 'radio-cards',
                label: 'Hoe groot is de klus ongeveer?',
                required: true,
                placeholder: '',
                width: 'full',
                helpText: '',
                options: [] // AI will generate industry-specific options
              }
            ]
          },
          // STEP 4: Urgency - FIXED (standard options)
          {
            id: 'step-urgency',
            title: 'Wanneer wil je starten?',
            description: 'Dit helpt ons om beschikbare vakmensen voor je te vinden.',
            order: 4,
            isFixed: true,
            isVariable: false,
            fields: [
              {
                id: 'urgency',
                type: 'radio-cards',
                label: 'Wanneer wil je starten?',
                required: true,
                placeholder: '',
                width: 'full',
                helpText: 'Dit helpt ons om beschikbare vakmensen voor je te vinden.',
                options: [
                  'Met spoed / zo snel mogelijk',
                  'Binnen enkele dagen / weken',
                  'Binnen 3 maanden',
                  'Binnen 6 maanden',
                  'In overleg / nader te bepalen'
                ]
              }
            ]
          },
          // STEP 5: Description (Optional) - VARIABLE (AI can customize example sentences)
          {
            id: 'step-description',
            title: 'Extra informatie',
            description: 'Heb je nog aanvullende informatie die belangrijk is voor de vakmensen? Deel hier alles wat relevant kan zijn.',
            order: 5,
            isFixed: true,
            isVariable: true, // AI can customize example sentences
            fields: [
              {
                id: 'description',
                type: 'textarea-with-examples',
                label: 'Wil je de situatie nog kort toelichten?',
                required: false,
                placeholder: '',
                width: 'full',
                helpText: 'Optioneel maar helpt om de beste match te vinden',
                exampleSentences: [] // AI will generate industry-specific examples
              }
            ]
          },
          // STEP 6: Budget - FIXED (standard options)
          {
            id: 'step-budget',
            title: 'Wat is je budget?',
            description: 'Een indicatie is voldoende. Dit helpt om passende offertes te krijgen.',
            order: 6,
            isFixed: true,
            isVariable: false,
            fields: [
              {
                id: 'budget',
                type: 'radio-cards',
                label: 'Wat is je budget voor deze klus?',
                required: true,
                placeholder: '',
                width: 'full',
                helpText: 'Een indicatie is voldoende. Dit helpt om passende offertes te krijgen.',
                options: [
                  'Tot €500',
                  '€500 – €1.500',
                  '€1.500 – €3.000',
                  '€3.000 – €7.500',
                  'Meer dan €7.500',
                  'Ik weet het nog niet precies'
                ]
              }
            ]
          },
          // STEP 7: Location - FIXED (always same)
          {
            id: 'step-location',
            title: 'Waar is de klus?',
            description: null,
            order: 7,
            isFixed: true,
            isVariable: false,
            fields: [
              {
                id: 'postcode',
                type: 'text',
                label: 'Postcode',
                required: true,
                placeholder: '1234AB',
                width: 'half',
                helpText: ''
              },
              {
                id: 'city',
                type: 'text',
                label: 'Plaats',
                required: true,
                placeholder: 'Amsterdam',
                width: 'half',
                helpText: ''
              },
              {
                id: 'street',
                type: 'text',
                label: 'Straat en huisnummer',
                required: false,
                placeholder: 'Voorbeeldstraat 123',
                width: 'full',
                helpText: 'Optioneel'
              }
            ]
          },
          // STEP 8: Contact Name - FIXED
          {
            id: 'step-contact-name',
            title: 'Wat is je naam?',
            description: 'Vertel ons je naam zodat we je persoonlijk kunnen helpen.',
            order: 8,
            isFixed: true,
            isVariable: false,
            fields: [
              {
                id: 'first_name',
                type: 'text',
                label: 'Voornaam',
                required: true,
                placeholder: 'Vul uw voornaam in',
                width: 'full',
                helpText: ''
              },
              {
                id: 'last_name',
                type: 'text',
                label: 'Achternaam',
                required: true,
                placeholder: 'Vul uw achternaam in',
                width: 'full',
                helpText: ''
              }
            ]
          },
          // STEP 9: Contact Email - FIXED (SECOND TO LAST)
          {
            id: 'step-contact-email',
            title: 'Wat is je e-mailadres?',
            description: 'We gebruiken je e-mailadres om je offertes te sturen en contact met je op te nemen.',
            order: 9,
            isFixed: true,
            isVariable: false,
            fields: [
              {
                id: 'email',
                type: 'email',
                label: 'E-mailadres',
                required: true,
                placeholder: 'voorbeeld@email.nl',
                width: 'full',
                helpText: ''
              }
            ]
          },
          // STEP 10: Contact Phone - FIXED (ALWAYS LAST)
          {
            id: 'step-contact-phone',
            title: 'Wat is je telefoonnummer?',
            description: 'We bellen je graag om je aanvraag door te nemen en de beste vakmensen voor je te vinden.',
            order: 10,
            isFixed: true,
            isVariable: false,
            fields: [
              {
                id: 'phone',
                type: 'tel',
                label: 'Telefoonnummer',
                required: true,
                placeholder: '06 12345678',
                width: 'full',
                helpText: ''
              }
            ]
          }
        ],
        settings: {
          style: 'modern',
          primaryColor: '#ea5d0d',
          showProgressBar: true,
          progressBarHeight: 5,
          oneQuestionPerPage: true,
          requireContactStep: true,
          submitButtonText: 'Verstuur aanvraag',
          successMessage: 'Bedankt! We nemen zo snel mogelijk contact met u op.'
        }
      };
    },

    // Ensure correct step order (contact last, budget second-to-last, urgency before budget)
    // Ensure correct step order - MODERN FORM BUILDER: 8 FIXED STEPS IN EXACT ORDER
    // This function enforces the fixed 8-step structure
    ensureStepOrder() {
      // Define the fixed order (ALWAYS the same - HARD-CODED)
      const fixedOrder = [
        'step-job-type',         // 1. Job Type
        'step-subcategory',      // 2. Subcategory (variable content)
        'step-scope',             // 3. Scope (variable content)
        'step-urgency',           // 4. Urgency
        'step-description',       // 5. Description (variable examples)
        'step-budget',            // 6. Budget
        'step-location',          // 7. Location
        'step-contact-name',      // 8. Contact Name
        'step-contact-email',     // 9. Contact Email (SECOND TO LAST)
        'step-contact-phone'      // 10. Contact Phone (ALWAYS LAST)
      ];
      
      // Get all steps
      const allSteps = [...this.config.steps];
      const orderedSteps = [];
      
      // Add steps in fixed order
      fixedOrder.forEach((stepId, index) => {
        const step = allSteps.find(s => s.id === stepId);
        if (step) {
          step.order = index + 1;
          step.isFixed = true; // Enforce fixed flag
          orderedSteps.push(step);
        } else {
          // If step is missing, create it from default config
          const defaultConfig = this.createDefaultConfig();
          const defaultStep = defaultConfig.steps.find(s => s.id === stepId);
          if (defaultStep) {
            defaultStep.order = index + 1;
            orderedSteps.push(defaultStep);
          }
        }
      });
      
      // Remove any steps that are not in the fixed order
      // (This ensures no extra steps can be added)
      this.config.steps = orderedSteps;
    },

    // Get step by ID
    getStep(stepId) {
      return this.config.steps.find(s => s.id === stepId);
    },

    // Get field by ID (searches all steps)
    getField(fieldId) {
      for (const step of this.config.steps) {
        const field = step.fields.find(f => f.id === fieldId);
        if (field) return { field, step };
      }
      return null;
    },

    // Get current step
    getCurrentStep() {
      return this.config.steps[this.currentPreviewStep] || null;
    },

    // Check if step is fixed
    isFixedStep(stepId) {
      const step = this.getStep(stepId);
      return step && step.isFixed === true;
    },

    // Check if field is required (in fixed steps)
    isRequiredField(fieldId) {
      const requiredFields = [
        'first_name', 'last_name', 'email', 'phone', // Contact step
        'job_type', 'subcategory', 'scope', // Steps 1, 2, 3
        'urgency', 'budget', // Steps 4, 6
        'postcode', 'city' // Location step
      ];
      return requiredFields.includes(fieldId);
    },

    // Select field (opens inspector)
    selectField(fieldId) {
      this.renderFieldInspector(fieldId);
      // Highlight in preview
      document.querySelectorAll('.form-field-group').forEach(el => el.classList.remove('selected'));
      const fieldGroup = document.querySelector(`[data-field-id="${fieldId}"]`);
      if (fieldGroup) {
        fieldGroup.classList.add('selected');
      }
    },

    // Render steps list
    renderStepsList() {
      const container = document.getElementById('stepsList');
      if (!container) return;

      if (this.config.steps.length === 0) {
        container.innerHTML = `
          <div class="steps-sidebar-empty">
            <i class="fas fa-layer-group"></i>
            <p>Geen stappen beschikbaar.<br>Klik op + om een stap toe te voegen.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = this.config.steps.map((step, index) => {
        const isSelected = step.id === this.selectedStepId;
        const isFixed = step.isFixed === true;
        const stepNumber = index + 1;
        const fieldCount = step.fields.length;
        
        return `
          <button type="button" class="step-sidebar-item ${isSelected ? 'active' : ''}" 
                  data-step-id="${step.id}"
                  data-step-order="${stepNumber}">
            <div class="step-item-header">
              <div class="step-item-content">
                <span class="step-number">${stepNumber}</span>
                ${isFixed ? '<i class="fas fa-lock step-lock-icon"></i>' : ''}
                <span class="step-title">${this.escapeHtml(step.title)}</span>
              </div>
            </div>
            <p class="step-meta">${fieldCount} ${fieldCount === 1 ? 'veld' : 'velden'}</p>
                ${!isFixed ? `
              <div class="step-actions" onclick="event.stopPropagation()">
                <button type="button" class="step-action-btn" data-action="step-edit" title="Bewerken">
                    <i class="fas fa-edit"></i>
                  </button>
                <button type="button" class="step-action-btn" data-action="step-delete" title="Verwijderen">
                  <i class="fas fa-trash-alt"></i>
                  </button>
              </div>
            ` : ''}
          </button>
        `;
      }).join('');
    },

    // Render preview - MODERN FORM BUILDER: One question per page, large radio cards
    renderPreview() {
      const container = document.getElementById('previewContainer');
      if (!container) return;

      if (this.config.steps.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Geen stappen om te tonen.</p></div>';
        return;
      }

      const currentStep = this.getCurrentStep();
      if (!currentStep) {
        this.currentPreviewStep = 0;
        return this.renderPreview();
      }

      // Progress bar with step counter
      const progressPercent = ((this.currentPreviewStep + 1) / this.config.steps.length) * 100;
      const progressHtml = this.config.settings.showProgressBar ? `
        <div class="form-progress-section">
          <div class="progress-header">
            <span class="progress-step-info">Stap ${this.currentPreviewStep + 1} van ${this.config.steps.length}</span>
            <span class="progress-percentage">${Math.round(progressPercent)}%</span>
        </div>
          <div class="form-progress-bar">
            <div class="form-progress-fill" style="width: ${progressPercent}%;"></div>
            </div>
            </div>
      ` : '';

      // Main content area
      const mainContentHtml = `
        <form id="previewForm" onsubmit="return false;">
          ${progressHtml}
          <h1 class="form-step-title">${this.escapeHtml(currentStep.title)}</h1>
          ${currentStep.description ? `<p class="form-step-description">${this.escapeHtml(currentStep.description)}</p>` : ''}
          
          <div class="form-fields">
            ${currentStep.fields.length > 0 && currentStep.fields.some(f => ['text', 'email', 'tel'].includes(f.type) && f.width === 'half') ? `
              <div class="grid grid-cols-2">
                ${currentStep.fields.map(field => this.renderModernField(field)).join('')}
              </div>
            ` : `
              ${currentStep.fields.map(field => this.renderModernField(field)).join('')}
            `}
            </div>
            
            ${['step-contact-email', 'step-contact-phone', 'step-contact-name'].includes(currentStep.id) ? `
              <div class="form-privacy-notice">
                <p class="form-privacy-text">
                  <i class="fas fa-shield-alt"></i>
                  <span>Je gegevens zijn beschermd en worden alleen gebruikt om je offertes te sturen. Door een aanvraag in te dienen, accepteer je onze <a href="/algemene-voorwaarden" target="_blank" class="form-privacy-link">algemene voorwaarden</a> en <a href="/privacybeleid" target="_blank" class="form-privacy-link">privacybeleid</a>.</span>
                </p>
              </div>
            ` : ''}
            
          <div class="form-navigation">
              ${this.currentPreviewStep > 0 ? `
              <button type="button" class="btn-previous" onclick="FormBuilder.showPreviewStep(${this.currentPreviewStep - 1})">
                Vorige
                </button>
            ` : '<button type="button" class="btn-previous" disabled>Vorige</button>'}
              ${this.currentPreviewStep < this.config.steps.length - 1 ? `
              <button type="button" class="btn-next" onclick="FormBuilder.showPreviewStep(${this.currentPreviewStep + 1})">
                Volgende
                </button>
              ` : `
              <button type="button" class="btn-submit">
                  ${this.config.settings.submitButtonText || 'Verstuur aanvraag'}
                </button>
              `}
            </div>
        </form>
      `;

      // Full modern form layout
      const stepHtml = mainContentHtml;

      container.innerHTML = stepHtml;
    },

    // Get icon for option text (returns null if no match found)
    getOptionIcon(optionText) {
      const text = optionText.toLowerCase();
      // Roofing icons
      if (text.includes('dakreparatie') || text.includes('reparatie')) return 'fa-tools';
      if (text.includes('dakrenovatie') || text.includes('vervanging') || text.includes('nieuw dak') || text.includes('plaatsing')) return 'fa-home';
      if (text.includes('dakgoot') || text.includes('goot')) return 'fa-tint';
      if (text.includes('dakreiniging') || text.includes('onderhoud')) return 'fa-broom';
      if (text.includes('dakisolatie') || text.includes('isolatie')) return 'fa-snowflake';
      if (text.includes('dakcoating') || text.includes('coating')) return 'fa-paint-roller';
      // General icons
      if (text.includes('klein') || text.includes('small')) return 'fa-compress';
      if (text.includes('gemiddeld') || text.includes('medium')) return 'fa-equals';
      if (text.includes('groot') || text.includes('large') || text.includes('complete')) return 'fa-expand';
      if (text.includes('spoed') || text.includes('urgent') || text.includes('zo snel')) return 'fa-clock';
      if (text.includes('dagen') || text.includes('weken')) return 'fa-calendar-week';
      if (text.includes('maanden') || text.includes('months')) return 'fa-calendar-alt';
      if (text.includes('budget') || text.includes('€') || text.includes('euro')) return 'fa-euro-sign';
      if (text.includes('weet') || text.includes('niet') || text.includes('nader')) return 'fa-question-circle';
      if (text.includes('anders') || text.includes('other')) return 'fa-ellipsis-h';
      // No icon if no match
      return null;
    },

    // Render modern form field (large radio cards)
    renderModernField(field) {
      const currentStep = this.getCurrentStep();
      
      // Radio cards
      if (field.type === 'radio-cards') {
        // Use better label if field.label is just "Meer details" - use step title or generate better label
        const displayLabel = field.label === 'Meer details' && currentStep && currentStep.title !== 'Meer details' 
          ? currentStep.title 
          : (field.label || (currentStep ? currentStep.title : ''));
        const canDelete = !this.isRequiredField(field.id);
        
        return `
          <div class="relative group form-field-group" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(displayLabel)}
              ${field.required ? '<span class="form-required">*</span>' : ''}
            </label>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
            <div class="form-radio-cards">
              ${(field.options || []).map((opt, index) => {
                const optText = typeof opt === 'string' ? opt : opt.label || opt.value || opt;
                const icon = this.getOptionIcon(optText);
                return `
                <label class="form-radio-card">
                  <input type="radio" name="preview-${field.id}" value="${this.escapeHtml(optText)}" ${field.required ? 'required' : ''} disabled>
                  <div class="form-card-content">
                    ${icon ? `<i class="fas ${icon} form-card-icon"></i>` : ''}
                    <span class="form-card-text">${this.escapeHtml(optText)}</span>
                  </div>
                </label>
              `;
              }).join('')}
              ${(field.options || []).length === 0 ? `
                <div class="form-empty-options">
                  <p>Geen opties beschikbaar. Voeg opties toe in de field inspector.</p>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      // Textarea with examples (for description step)
      if (field.type === 'textarea-with-examples') {
        const examplesHtml = (field.exampleSentences || []).length > 0 ? `
          <div class="form-examples">
            <p class="form-examples-title">Voorbeelden:</p>
            <div class="form-example-chips">
              ${field.exampleSentences.map(example => `
                <button type="button" class="form-example-chip" onclick="FormBuilder.insertExample('${field.id}', '${this.escapeHtml(example).replace(/'/g, "\\'")}')">
                  ${this.escapeHtml(example)}
                </button>
              `).join('')}
            </div>
          </div>
        ` : '';
        const canDelete = !this.isRequiredField(field.id);
        
        return `
          <div class="relative group form-field-group" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(field.label)}
              ${field.required ? '<span class="form-required">*</span>' : ''}
            </label>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
            <textarea 
              id="preview-${field.id}"
              class="form-textarea" 
              placeholder="${this.escapeHtml(field.placeholder || '')}" 
              rows="6"
              ${field.required ? 'required' : ''}
              disabled
            ></textarea>
            ${examplesHtml}
          </div>
        `;
      }

      // Regular textarea field
      if (field.type === 'textarea') {
        const canDelete = !this.isRequiredField(field.id);
        
        return `
          <div class="relative group form-field-group" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(field.label)}
              ${field.required ? '<span class="form-required">*</span>' : ''}
            </label>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
            <textarea 
              id="preview-${field.id}"
              class="form-textarea" 
              placeholder="${this.escapeHtml(field.placeholder || '')}" 
              rows="6"
              ${field.required ? 'required' : ''}
              disabled
            ></textarea>
          </div>
        `;
      }

      // Regular text inputs (for location and contact)
      if (['text', 'email', 'tel'].includes(field.type)) {
        const widthClass = field.width === 'half' ? 'col-span-1' : 'col-span-2';
        const canDelete = !this.isRequiredField(field.id);
        return `
          <div class="relative group form-field-group ${widthClass}" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(field.label)}
              ${field.required ? '<span class="required">*</span>' : ''}
            </label>
            <input 
              type="${field.type}" 
              class="form-input" 
              placeholder="${this.escapeHtml(field.placeholder || '')}" 
              ${field.required ? 'required' : ''}
              disabled
            >
            ${field.helpText ? `<p class="field-help-text">${this.escapeHtml(field.helpText)}</p>` : ''}
          </div>
        `;
      }

      // Select type - convert to radio-cards for modern form style
      if (field.type === 'select' && field.options && field.options.length > 0) {
        const displayLabel = field.label === 'Meer details' && currentStep && currentStep.title !== 'Meer details' 
          ? currentStep.title 
          : (field.label || (currentStep ? currentStep.title : ''));
        const canDelete = !this.isRequiredField(field.id);
        
        return `
          <div class="relative group form-field-group" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(displayLabel)}
              ${field.required ? '<span class="form-required">*</span>' : ''}
            </label>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
            <div class="form-radio-cards">
              ${field.options.map((opt, index) => {
                const optText = typeof opt === 'string' ? opt : opt.label || opt.value || opt;
                const icon = this.getOptionIcon(optText);
                return `
                <label class="form-radio-card">
                  <input type="radio" name="preview-${field.id}" value="${this.escapeHtml(optText)}" ${field.required ? 'required' : ''} disabled>
                  <div class="form-card-content">
                    ${icon ? `<i class="fas ${icon} form-card-icon"></i>` : ''}
                    <span class="form-card-text">${this.escapeHtml(optText)}</span>
                  </div>
                </label>
              `;
              }).join('')}
            </div>
          </div>
        `;
      }

      // Checkbox field
      if (field.type === 'checkbox') {
        const canDelete = !this.isRequiredField(field.id);
        return `
          <div class="relative group form-field-group" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(field.label)}
              ${field.required ? '<span class="form-required">*</span>' : ''}
            </label>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
            <div class="form-checkbox-group">
              ${(field.options || []).map((opt, index) => `
                <label class="form-checkbox-item">
                  <input type="checkbox" name="preview-${field.id}[]" value="${this.escapeHtml(opt)}" ${field.required ? 'required' : ''} disabled>
                  <span class="form-checkbox-label">${this.escapeHtml(opt)}</span>
                </label>
              `).join('')}
              ${(!field.options || field.options.length === 0) ? `
                <div class="form-empty-options">
                  <p>Geen opties beschikbaar. Voeg opties toe in de field inspector.</p>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      // Yes/No field
      if (field.type === 'yesno') {
        const canDelete = !this.isRequiredField(field.id);
        return `
          <div class="relative group form-field-group" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(field.label)}
              ${field.required ? '<span class="form-required">*</span>' : ''}
            </label>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
            <div class="form-radio-cards">
              <label class="form-radio-card">
                <input type="radio" name="preview-${field.id}" value="ja" ${field.required ? 'required' : ''} disabled>
                <div class="form-card-content">
                  <span class="form-card-text">Ja</span>
                </div>
              </label>
              <label class="form-radio-card">
                <input type="radio" name="preview-${field.id}" value="nee" ${field.required ? 'required' : ''} disabled>
                <div class="form-card-content">
                  <span class="form-card-text">Nee</span>
                </div>
              </label>
            </div>
          </div>
        `;
      }

      // Heading field
      if (field.type === 'heading') {
        const canDelete = !this.isRequiredField(field.id);
        return `
          <div class="relative group form-field-group" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <h3 class="form-heading">${this.escapeHtml(field.label)}</h3>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
          </div>
        `;
      }

      // Number field
      if (field.type === 'number') {
        const widthClass = field.width === 'half' ? 'col-span-1' : 'col-span-2';
        const canDelete = !this.isRequiredField(field.id);
        return `
          <div class="relative group form-field-group ${widthClass}" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(field.label)}
              ${field.required ? '<span class="form-required">*</span>' : ''}
            </label>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
            <input 
              type="number" 
              class="form-input" 
              placeholder="${this.escapeHtml(field.placeholder || '')}" 
              ${field.required ? 'required' : ''}
              ${field.min !== undefined ? `min="${field.min}"` : ''}
              ${field.max !== undefined ? `max="${field.max}"` : ''}
              disabled
            >
          </div>
        `;
      }

      // Radio field (regular, not radio-cards)
      if (field.type === 'radio') {
        const canDelete = !this.isRequiredField(field.id);
        return `
          <div class="relative group form-field-group" data-field-id="${field.id}">
            <div class="field-actions">
              <button type="button" class="field-action-btn edit" onclick="FormBuilder.selectField('${field.id}')" title="Bewerken">
                <i class="fas fa-pencil"></i>
              </button>
              ${canDelete ? `
                <button type="button" class="field-action-btn delete" onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" title="Verwijderen">
                  <i class="fas fa-trash2"></i>
                </button>
              ` : ''}
            </div>
            <label class="form-field-label">
              ${this.escapeHtml(field.label)}
              ${field.required ? '<span class="form-required">*</span>' : ''}
            </label>
            ${field.helpText ? `<p class="form-field-help">${this.escapeHtml(field.helpText)}</p>` : ''}
            <div class="form-radio-group">
              ${(field.options || []).map((opt, index) => `
                <label class="form-radio-item">
                  <input type="radio" name="preview-${field.id}" value="${this.escapeHtml(opt)}" ${field.required ? 'required' : ''} disabled>
                  <span class="form-radio-label">${this.escapeHtml(opt)}</span>
                </label>
              `).join('')}
              ${(!field.options || field.options.length === 0) ? `
                <div class="form-empty-options">
                  <p>Geen opties beschikbaar. Voeg opties toe in de field inspector.</p>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      // Fallback for other types
      return `
        <div class="trustoo-field-group">
          <label class="trustoo-field-label">${this.escapeHtml(field.label)}</label>
          <p class="form-field-note">Field type "${field.type}" wordt nog niet ondersteund in preview</p>
        </div>
      `;
    },

    // Insert example sentence into textarea
    insertExample(fieldId, example) {
      const textarea = document.getElementById(`preview-${fieldId}`);
      if (textarea) {
        textarea.value = example;
        textarea.focus();
      }
    },

    // Render preview field
    renderPreviewField(field) {
      const widthClass = field.width === 'half' ? 'half-width' : '';
      const requiredHtml = field.required ? '<span class="required">*</span>' : '';
      const helpHtml = field.helpText ? `<div class="preview-field-help">${this.escapeHtml(field.helpText)}</div>` : '';

      let inputHtml = '';

      switch (field.type) {
        case 'textarea':
          inputHtml = `<textarea class="preview-field-textarea" placeholder="${this.escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}></textarea>`;
          break;

        case 'select':
          inputHtml = `
            <select class="preview-field-select" ${field.required ? 'required' : ''}>
              <option value="">Selecteer...</option>
              ${(field.options || []).map(opt => `<option value="${this.escapeHtml(opt)}">${this.escapeHtml(opt)}</option>`).join('')}
            </select>
          `;
          break;

        case 'radio':
          inputHtml = `
            <div class="preview-field-options">
              ${(field.options || []).map(opt => `
                <div class="preview-field-option">
                  <input type="radio" id="preview-${field.id}-${this.escapeHtml(opt)}" name="preview-${field.id}" value="${this.escapeHtml(opt)}" ${field.required ? 'required' : ''}>
                  <label for="preview-${field.id}-${this.escapeHtml(opt)}">${this.escapeHtml(opt)}</label>
                </div>
              `).join('')}
            </div>
          `;
          break;

        case 'checkbox':
          inputHtml = `
            <div class="preview-field-options">
              ${(field.options || []).map(opt => `
                <div class="preview-field-option">
                  <input type="checkbox" id="preview-${field.id}-${this.escapeHtml(opt)}" name="preview-${field.id}[]" value="${this.escapeHtml(opt)}">
                  <label for="preview-${field.id}-${this.escapeHtml(opt)}">${this.escapeHtml(opt)}</label>
                </div>
              `).join('')}
            </div>
          `;
          break;

        case 'yesno':
          inputHtml = `
            <div class="preview-field-options">
              <div class="preview-field-option">
                <input type="radio" id="preview-${field.id}-yes" name="preview-${field.id}" value="ja" ${field.required ? 'required' : ''}>
                <label for="preview-${field.id}-yes">Ja</label>
              </div>
              <div class="preview-field-option">
                <input type="radio" id="preview-${field.id}-no" name="preview-${field.id}" value="nee" ${field.required ? 'required' : ''}>
                <label for="preview-${field.id}-no">Nee</label>
              </div>
            </div>
          `;
          break;

        case 'heading':
          inputHtml = `<div style="font-size: 18px; font-weight: 600; color: #111827; margin: 8px 0;">${this.escapeHtml(field.label)}</div>`;
          return `<div class="preview-field-group ${widthClass}">${inputHtml}${helpHtml}</div>`;

        default:
          inputHtml = `<input type="${field.type}" class="preview-field-input" placeholder="${this.escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>`;
      }

      const isRequired = this.isRequiredField(field.id);
      const canDelete = !isRequired;
      
      return `
        <div class="preview-field-group ${widthClass} ${this.selectedFieldId === field.id ? 'selected' : ''}" data-field-id="${field.id}">
          <div class="preview-field-actions">
            <button type="button" class="preview-field-action-btn preview-field-edit-btn" 
                    onclick="FormBuilder.selectField('${field.id}')" 
                    title="Bewerken">
              <i class="fas fa-pen"></i>
            </button>
            ${canDelete ? `
              <button type="button" class="preview-field-action-btn preview-field-delete-btn" 
                      onclick="FormBuilder.deleteFieldWithConfirm('${field.id}')" 
                      title="Verwijderen">
                <i class="fas fa-trash"></i>
              </button>
            ` : `
              <button type="button" class="preview-field-action-btn preview-field-delete-btn preview-field-action-disabled" 
                      disabled 
                      title="Dit veld kan niet worden verwijderd">
                <i class="fas fa-trash"></i>
              </button>
            `}
          </div>
          <label class="preview-field-label">
            ${this.escapeHtml(field.label)}${requiredHtml}
          </label>
          ${inputHtml}
          ${helpHtml}
        </div>
      `;
    },

    // Show preview step
    showPreviewStep(stepIndex) {
      if (stepIndex < 0 || stepIndex >= this.config.steps.length) return;
      this.currentPreviewStep = stepIndex;
      this.renderPreview();
    },

    // Render field inspector
    renderFieldInspector(fieldId) {
      const result = this.getField(fieldId);
      if (!result) {
        // Close inspector panel
        document.querySelector('.form-builder-layout')?.classList.remove('inspector-open');
        return;
      }

      const { field } = result;
      const inspector = document.getElementById('fieldInspector');
      const layout = document.querySelector('.form-builder-layout');

      // Open inspector panel
      if (layout) {
        layout.classList.add('inspector-open');
      }
      this.selectedFieldId = fieldId;

      // Options editor (for select/radio/checkbox)
      let optionsHtml = '';
      if (['select', 'radio', 'checkbox', 'multiselect'].includes(field.type)) {
        optionsHtml = `
          <div class="inspector-field">
            <label>Opties</label>
            <div class="inspector-options-list" id="optionsList">
              ${(field.options || []).map((opt, index) => `
                <div class="inspector-option-item">
                  <input type="text" value="${this.escapeHtml(opt)}" data-option-index="${index}" placeholder="Optie waarde">
                  <button type="button" onclick="FormBuilder.removeOption('${field.id}', ${index})">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `).join('')}
            </div>
            <button type="button" class="inspector-add-option" onclick="FormBuilder.addOption('${field.id}')">
              <i class="fas fa-plus"></i> Optie toevoegen
            </button>
          </div>
        `;
      }

      inspector.innerHTML = `
        <div class="inspector-field">
          <label>Veld type</label>
          <select id="inspectorFieldType" onchange="FormBuilder.updateFieldType('${field.id}', this.value)">
            ${Object.keys(this.fieldTypes).map(type => `
              <option value="${type}" ${field.type === type ? 'selected' : ''}>${this.fieldTypes[type].label}</option>
            `).join('')}
          </select>
        </div>
        <div class="inspector-field">
          <label>Label</label>
          <input type="text" id="inspectorLabel" value="${this.escapeHtml(field.label)}" onchange="FormBuilder.updateFieldProperty('${field.id}', 'label', this.value)">
        </div>
        <div class="inspector-field">
          <label>Placeholder</label>
          <input type="text" id="inspectorPlaceholder" value="${this.escapeHtml(field.placeholder || '')}" onchange="FormBuilder.updateFieldProperty('${field.id}', 'placeholder', this.value)">
        </div>
        <div class="inspector-field">
          <label>Helptekst</label>
          <textarea id="inspectorHelpText" onchange="FormBuilder.updateFieldProperty('${field.id}', 'helpText', this.value)">${this.escapeHtml(field.helpText || '')}</textarea>
        </div>
        <div class="inspector-field">
          <div class="inspector-checkbox">
            <input type="checkbox" id="inspectorRequired" ${field.required ? 'checked' : ''} onchange="FormBuilder.updateFieldProperty('${field.id}', 'required', this.checked)">
            <label for="inspectorRequired">Verplicht veld</label>
          </div>
        </div>
        ${field.type !== 'heading' ? `
          <div class="inspector-field">
            <label>Breedte</label>
            <select id="inspectorWidth" onchange="FormBuilder.updateFieldProperty('${field.id}', 'width', this.value)">
              <option value="full" ${field.width === 'full' ? 'selected' : ''}>Volledige breedte</option>
              <option value="half" ${field.width === 'half' ? 'selected' : ''}>Halve breedte</option>
            </select>
          </div>
        ` : ''}
        ${optionsHtml}
        ${!this.isRequiredField(field.id) ? `
          <button type="button" class="inspector-delete-btn" onclick="FormBuilder.deleteField('${field.id}')">
            <i class="fas fa-trash"></i> Veld verwijderen
          </button>
        ` : `
          <button type="button" class="inspector-delete-btn inspector-delete-btn-disabled" disabled title="Dit veld kan niet worden verwijderd">
            <i class="fas fa-lock"></i> Verplicht veld
          </button>
        `}
      `;

      // Attach option change listeners
      if (optionsHtml) {
        setTimeout(() => {
          const optionInputs = document.querySelectorAll('#optionsList input[type="text"]');
          optionInputs.forEach(input => {
            input.addEventListener('change', (e) => {
              const index = parseInt(e.target.dataset.optionIndex);
              FormBuilder.updateOption(field.id, index, e.target.value);
            });
          });
        }, 100);
      }
    },

    // Update field property
    updateFieldProperty(fieldId, property, value) {
      const result = this.getField(fieldId);
      if (!result) return;

      result.field[property] = value;
      this.renderPreview();
      this.renderStepsList();
    },

    // Update field type
    updateFieldType(fieldId, newType) {
      const result = this.getField(fieldId);
      if (!result) return;

      const oldType = result.field.type;
      result.field.type = newType;

      // Initialize options if needed
      if (['select', 'radio', 'checkbox', 'multiselect'].includes(newType) && !result.field.options) {
        result.field.options = [];
      }

      // Remove options if not needed
      if (!['select', 'radio', 'checkbox', 'multiselect'].includes(newType)) {
        delete result.field.options;
      }

      // Re-render inspector and preview
      this.renderFieldInspector(fieldId);
      this.renderPreview();
    },

    // Add option
    addOption(fieldId) {
      const result = this.getField(fieldId);
      if (!result) return;

      if (!result.field.options) result.field.options = [];
      result.field.options.push('Nieuwe optie');
      this.renderFieldInspector(fieldId);
      this.renderPreview();
    },

    // Update option
    updateOption(fieldId, index, value) {
      const result = this.getField(fieldId);
      if (!result || !result.field.options) return;

      result.field.options[index] = value;
      this.renderPreview();
    },

    // Remove option
    removeOption(fieldId, index) {
      const result = this.getField(fieldId);
      if (!result || !result.field.options) return;

      result.field.options.splice(index, 1);
      this.renderFieldInspector(fieldId);
      this.renderPreview();
    },

    // Delete field
    deleteField(fieldId) {
      // Prevent deleting required fields
      if (this.isRequiredField(fieldId)) {
        this.showErrorNotification('Dit veld kan niet worden verwijderd. Het is een verplicht veld dat nodig is voor het platform.');
        return;
      }

      for (const step of this.config.steps) {
        const index = step.fields.findIndex(f => f.id === fieldId);
        if (index !== -1) {
          step.fields.splice(index, 1);
          break;
        }
      }

      this.selectedFieldId = null;
      // Close inspector panel
      document.querySelector('.form-builder-layout')?.classList.remove('inspector-open');
      this.renderPreview();
      this.renderStepsList();
    },

    // Delete field with confirmation dialog
    deleteFieldWithConfirm(fieldId) {
      // Prevent deleting required fields
      if (this.isRequiredField(fieldId)) {
        this.showErrorNotification('Dit veld kan niet worden verwijderd. Het is een verplicht veld dat nodig is voor het platform.');
        return;
      }

      const field = this.getField(fieldId);
      const fieldLabel = field ? field.label : 'dit veld';

      // Create custom confirmation modal
      const modal = document.createElement('div');
      modal.className = 'field-delete-modal-overlay';
      modal.innerHTML = `
        <div class="field-delete-modal">
          <div class="field-delete-modal-header">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Velden verwijderen</h3>
          </div>
          <div class="field-delete-modal-body">
            <p>Weet je zeker dat je <strong>"${this.escapeHtml(fieldLabel)}"</strong> wilt verwijderen?</p>
            <p class="field-delete-modal-warning">Deze actie kan niet ongedaan worden gemaakt.</p>
          </div>
          <div class="field-delete-modal-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.field-delete-modal-overlay').remove()">
              Annuleren
            </button>
            <button type="button" class="btn-danger" onclick="FormBuilder.deleteField('${fieldId}'); this.closest('.field-delete-modal-overlay').remove();">
              <i class="fas fa-trash"></i> Verwijderen
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    },

    // Add step
    addStep() {
      // Variable steps start at order 4 (after fixed steps 1-3)
      const variableSteps = this.config.steps.filter(s => !s.isFixed);
      const nextOrder = 4 + variableSteps.length;

      const newStep = {
        id: `step-${Date.now()}`,
        title: `Stap ${nextOrder}`,
        description: null,
        order: nextOrder,
        isFixed: false,
        fields: []
      };

      this.config.steps.push(newStep);
      this.selectedStepId = newStep.id;
      this.renderStepsList();
      this.renderPreview();
    },

    // Delete step
    async deleteStep(stepId) {
      // Prevent deleting fixed steps
      if (this.isFixedStep(stepId)) {
        this.showErrorNotification('Deze stap kan niet worden verwijderd. Het is een vaste stap die nodig is voor het platform.');
        return;
      }

      const variableSteps = this.config.steps.filter(s => !s.isFixed);
      if (variableSteps.length <= 1) {
        this.showErrorNotification('Je moet minimaal één variabele stap behouden.');
        return;
      }

      const confirmed = await this.showConfirmDialog(
        'Weet je zeker dat je deze stap wilt verwijderen? Alle velden in deze stap worden ook verwijderd.',
        'Stap verwijderen'
      );
      if (!confirmed) {
        return;
      }

      const index = this.config.steps.findIndex(s => s.id === stepId);
      if (index !== -1) {
        this.config.steps.splice(index, 1);
        // Reorder variable steps only
        const fixedSteps = this.config.steps.filter(s => s.isFixed).sort((a, b) => a.order - b.order);
        const remainingVariableSteps = this.config.steps.filter(s => !s.isFixed);
        remainingVariableSteps.forEach((step, i) => {
          step.order = 4 + i;
        });
        this.config.steps = [...fixedSteps, ...remainingVariableSteps];
      }

      if (this.selectedStepId === stepId) {
        this.selectedStepId = this.config.steps[0]?.id || null;
      }

      this.currentPreviewStep = 0;
      this.renderStepsList();
      this.renderPreview();
    },

    // Move step up/down
    moveStep(stepId, direction) {
      // Prevent moving fixed steps
      if (this.isFixedStep(stepId)) {
        this.showErrorNotification('Vaste stappen kunnen niet worden verplaatst.');
        return;
      }

      const index = this.config.steps.findIndex(s => s.id === stepId);
      if (index === -1) return;

      // Separate fixed and variable steps
      const fixedSteps = this.config.steps.filter(s => s.isFixed).sort((a, b) => a.order - b.order);
      const variableSteps = this.config.steps.filter(s => !s.isFixed).sort((a, b) => a.order - b.order);
      
      // Find step in variable steps
      const variableIndex = variableSteps.findIndex(s => s.id === stepId);
      if (variableIndex === -1) return;

      const newVariableIndex = direction === 'up' ? variableIndex - 1 : variableIndex + 1;
      if (newVariableIndex < 0 || newVariableIndex >= variableSteps.length) return;

      // Swap in variable steps array
      [variableSteps[variableIndex], variableSteps[newVariableIndex]] = [variableSteps[newVariableIndex], variableSteps[variableIndex]];

      // Update orders
      variableSteps.forEach((step, i) => {
        step.order = 4 + i;
      });

      // Recombine
      this.config.steps = [...fixedSteps, ...variableSteps];

      this.renderStepsList();
      this.renderPreview();
    },

    // Edit step title
    editStepTitle(stepId) {
      // Prevent editing fixed step titles
      if (this.isFixedStep(stepId)) {
        this.showErrorNotification('De titel van deze vaste stap kan niet worden gewijzigd.');
        return;
      }

      const step = this.getStep(stepId);
      if (!step) return;

      // Create custom input modal
      const modal = document.createElement('div');
      modal.className = 'field-delete-modal-overlay';
      modal.innerHTML = `
        <div class="field-delete-modal" style="max-width: 400px;">
          <div class="field-delete-modal-header">
            <i class="fas fa-edit"></i>
            <h3>Stap titel bewerken</h3>
          </div>
          <div class="field-delete-modal-body">
            <input type="text" id="stepTitleInput" value="${this.escapeHtml(step.title)}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" placeholder="Stap titel">
          </div>
          <div class="field-delete-modal-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.field-delete-modal-overlay').remove()">
              Annuleren
            </button>
            <button type="button" class="btn-primary" onclick="
              const input = document.getElementById('stepTitleInput');
              const newTitle = input.value.trim();
              if (newTitle) {
                FormBuilder.getStep('${stepId}').title = newTitle;
                FormBuilder.renderStepsList();
                FormBuilder.renderPreview();
              }
              this.closest('.field-delete-modal-overlay').remove();
            ">
              Opslaan
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Focus input
      setTimeout(() => {
        const input = document.getElementById('stepTitleInput');
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    },

    // Add field to current step
    addField(fieldType) {
      if (!this.selectedStepId) {
        this.showErrorNotification('Selecteer eerst een stap om een veld toe te voegen.');
        return;
      }

      const step = this.getStep(this.selectedStepId);
      if (!step) return;

      const fieldId = `field-${Date.now()}`;
      const fieldDef = this.fieldTypes[fieldType];
      
      const newField = {
        id: fieldId,
        type: fieldType,
        label: fieldDef.label,
        required: false,
        placeholder: '',
        helpText: '',
        width: 'full'
      };

      // Add options for select/radio/checkbox
      if (['select', 'radio', 'checkbox', 'multiselect'].includes(fieldType)) {
        newField.options = fieldType === 'yesno' ? ['Ja', 'Nee'] : [];
      }

      step.fields.push(newField);
      this.selectedFieldId = fieldId;

      this.renderPreview();
      this.renderStepsList();
      this.renderFieldInspector(fieldId);

      // Scroll to inspector (if panel exists)
      setTimeout(() => {
        const inspectorPanel = document.getElementById('inspectorPanel');
        if (inspectorPanel) {
          inspectorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    },

    // Validate config before save
    validateConfig() {
      const errors = [];

      // Check steps
      if (!this.config.steps || this.config.steps.length === 0) {
        errors.push('Formulier moet minimaal één stap bevatten.');
        return errors;
      }

      // Ensure step order is correct first
      this.ensureStepOrder();

      // Validate required steps exist
      const locationStep = this.config.steps.find(s => s.id === 'step-location');
      const jobTypeStep = this.config.steps.find(s => s.id === 'step-job-type');
      const contactNameStep = this.config.steps.find(s => s.id === 'step-contact-name');
      const contactEmailStep = this.config.steps.find(s => s.id === 'step-contact-email');
      const contactPhoneStep = this.config.steps.find(s => s.id === 'step-contact-phone');
      
      // Check Location step
      if (!locationStep) {
        errors.push('Formulier moet een Locatie stap (step-location) bevatten.');
      }
      
      // Check Job Type step
      if (!jobTypeStep) {
        errors.push('Formulier moet een Werksoort stap (step-job-type) bevatten.');
      }
      
      // Check Contact Name step
      if (!contactNameStep) {
        errors.push('Formulier moet een Contact Naam stap (step-contact-name) bevatten.');
      } else {
        const nameFields = contactNameStep.fields || [];
        const hasFirstName = nameFields.some(f => f.id === 'first_name' && f.type === 'text' && f.required === true);
        const hasLastName = nameFields.some(f => f.id === 'last_name' && f.type === 'text' && f.required === true);
        if (!hasFirstName) errors.push('Contact Naam stap moet een "first_name" veld bevatten (type: text, required: true).');
        if (!hasLastName) errors.push('Contact Naam stap moet een "last_name" veld bevatten (type: text, required: true).');
      }
      
      // Check Contact Email step (must be second to last)
      if (!contactEmailStep) {
        errors.push('Formulier moet een Contact Email stap (step-contact-email) bevatten als voorlaatste stap.');
      } else {
        const emailFields = contactEmailStep.fields || [];
        const hasEmail = emailFields.some(f => f.id === 'email' && f.type === 'email' && f.required === true);
        if (!hasEmail) errors.push('Contact Email stap moet een "email" veld bevatten (type: email, required: true).');
        
        // Validate email step is second to last
        const secondToLastStep = this.config.steps[this.config.steps.length - 2];
        if (secondToLastStep && secondToLastStep.id !== 'step-contact-email') {
          errors.push('Contact Email stap (step-contact-email) moet de voorlaatste stap zijn.');
        }
      }
      
      // Check Contact Phone step (must be last step)
      if (!contactPhoneStep) {
        errors.push('Formulier moet een Contact Telefoon stap (step-contact-phone) bevatten als laatste stap.');
      } else {
        const phoneFields = contactPhoneStep.fields || [];
        const hasPhone = phoneFields.some(f => f.id === 'phone' && f.type === 'tel' && f.required === true);
        if (!hasPhone) errors.push('Contact Telefoon stap moet een "phone" veld bevatten (type: tel, required: true).');
        
        // Validate phone step is last step
        const lastStep = this.config.steps[this.config.steps.length - 1];
        if (lastStep.id !== 'step-contact-phone') {
          errors.push('Contact Telefoon stap (step-contact-phone) moet de laatste stap zijn.');
        }
      }

      // Validate step-scope structure (step 3)
      const scopeStep = this.config.steps.find(s => s.id === 'step-scope');
      if (scopeStep) {
        const scopeFields = scopeStep.fields || [];
        const hasScope = scopeFields.some(f => f.id === 'scope');
        if (!hasScope) {
          errors.push('Scope stap moet een "scope" veld bevatten.');
        }
      }

      // Validate urgency step
      const urgencyStep = this.config.steps.find(s => s.id === 'step-urgency');
      if (urgencyStep) {
        const urgencyFields = urgencyStep.fields || [];
        const hasUrgency = urgencyFields.some(f => f.id === 'urgency' && f.type === 'select');
        if (!hasUrgency) {
          errors.push('Urgentie stap moet een "urgency" veld bevatten (type: select, required: true).');
        }
      } else {
        errors.push('Urgentie stap (step-urgency) moet bestaan.');
      }

      // Validate budget step
      const budgetStep = this.config.steps.find(s => s.id === 'step-budget');
      if (budgetStep) {
        const budgetFields = budgetStep.fields || [];
        const hasBudget = budgetFields.some(f => f.id === 'budget' && f.type === 'select');
        if (!hasBudget) {
          errors.push('Budget stap moet een "budget" veld bevatten (type: select, required: true).');
        }
      } else {
        errors.push('Budget stap (step-budget) moet bestaan.');
      }

      // Validate steps and fields
      const fieldIds = new Set();
      this.config.steps.forEach((step, stepIndex) => {
        if (!step.id || !step.title) {
          errors.push(`Stap ${stepIndex + 1} mist "id" of "title".`);
        }
        if (!step.fields || step.fields.length === 0) {
          errors.push(`Stap "${step.title}" heeft geen velden.`);
        }
        step.fields.forEach((field, fieldIndex) => {
          if (!field.id || !field.type || !field.label) {
            errors.push(`Stap "${step.title}", veld ${fieldIndex + 1} mist "id", "type" of "label".`);
          }
          if (fieldIds.has(field.id)) {
            errors.push(`Veld ID "${field.id}" komt meerdere keren voor. Elk veld moet een uniek ID hebben.`);
          }
          fieldIds.add(field.id);

          // Validate options
          if (['select', 'radio', 'checkbox', 'multiselect'].includes(field.type)) {
            if (!field.options || field.options.length === 0) {
              errors.push(`Veld "${field.label}" (${field.type}) heeft geen opties.`);
            }
          }
        });
      });

      return errors;
    },

    // Save config
    async saveConfig() {
      const errors = this.validateConfig();
      if (errors.length > 0) {
        this.showErrorNotification('Validatiefouten:\n\n' + errors.join('\n'));
        return;
      }

      const saveBtn = document.getElementById('saveBtn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opslaan...';

      try {
        const response = await fetch(`/admin/settings/industries/${DATA.industryId}/form`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            config: this.config
          })
        });

        if (response.ok) {
          // Success - reload page with saved flag
          window.location.href = `/admin/settings/industries/${DATA.industryId}/form?saved=1`;
        } else {
          const errorText = await response.text();
          throw new Error(errorText || 'Fout bij opslaan');
        }
      } catch (error) {
        console.error('Save error:', error);
        this.showErrorNotification('Fout bij opslaan: ' + error.message);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Opslaan';
      }
    },

    // Show AI generate confirmation modal
    showAIGenerateModal() {
      const hasExistingConfig = this.config && this.config.steps && this.config.steps.some(s => !s.isFixed);
      
      const modal = document.createElement('div');
      modal.className = 'ai-generate-modal-overlay';
      modal.innerHTML = `
        <div class="ai-generate-modal">
          <div class="ai-generate-modal-header">
            <div class="ai-generate-modal-icon">
              <i class="fas fa-magic"></i>
            </div>
            <h3>AI Formulier Genereren</h3>
          </div>
          <div class="ai-generate-modal-body">
            <p>Laat AI een formulier genereren voor <strong>${this.escapeHtml(DATA.industryName)}</strong>.</p>
            ${hasExistingConfig ? `
              <div class="ai-generate-options">
                <p class="ai-generate-options-title">Je hebt al variabele stappen. Wat wil je doen?</p>
                <div class="ai-generate-option" data-action="replace">
                  <div class="ai-generate-option-icon">
                    <i class="fas fa-redo"></i>
                  </div>
                  <div class="ai-generate-option-content">
                    <strong>Vervangen</strong>
                    <span>Verwijder alle bestaande variabele stappen en genereer nieuwe</span>
                  </div>
                  <div class="ai-generate-option-check">
                    <i class="fas fa-check"></i>
                  </div>
                </div>
                <div class="ai-generate-option" data-action="merge">
                  <div class="ai-generate-option-icon">
                    <i class="fas fa-plus-circle"></i>
                  </div>
                  <div class="ai-generate-option-content">
                    <strong>Samenvoegen</strong>
                    <span>Voeg nieuwe variabele stappen toe aan de bestaande stappen</span>
                  </div>
                  <div class="ai-generate-option-check">
                    <i class="fas fa-check"></i>
                  </div>
                </div>
              </div>
            ` : `
              <p class="ai-generate-info">AI genereert relevante variabele stappen op basis van de branche.</p>
            `}
          </div>
          <div class="ai-generate-modal-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.ai-generate-modal-overlay').remove()">
              Annuleren
            </button>
            <button type="button" class="btn-primary ai-generate-confirm-btn" data-action="${hasExistingConfig ? '' : 'replace'}">
              <i class="fas fa-magic"></i> ${hasExistingConfig ? 'Doorgaan' : 'Genereren'}
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Handle option selection
      if (hasExistingConfig) {
        let selectedAction = 'merge'; // Default to merge
        
        modal.querySelectorAll('.ai-generate-option').forEach(option => {
          option.addEventListener('click', () => {
            modal.querySelectorAll('.ai-generate-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedAction = option.dataset.action;
            modal.querySelector('.ai-generate-confirm-btn').dataset.action = selectedAction;
          });
        });

        // Set default selection
        modal.querySelector('.ai-generate-option[data-action="merge"]').classList.add('selected');
      }

      // Handle confirm button
      modal.querySelector('.ai-generate-confirm-btn').addEventListener('click', () => {
        const action = modal.querySelector('.ai-generate-confirm-btn').dataset.action || 'merge';
        modal.remove();
        this.generateWithAI(action === 'replace');
      });

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    },

    // Generate form with AI
    async generateWithAI(replace = false) {
      const aiBtn = document.getElementById('aiGenerateBtn');
      aiBtn.disabled = true;
      aiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Genereren...';

      try {
        const response = await fetch('/api/admin/form-builder/suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            industryId: DATA.industryId,
            industryName: DATA.industryName,
            existingConfig: replace ? null : this.config
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Fout bij genereren';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch (e) {
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();

        if (result.success && result.config) {
          // AI now returns full config with merged variable parts
          // We need to merge the variable parts (steps 2, 3, 5) into our existing config
          const aiConfig = result.config;
          
          // Ensure all fixed steps exist first
          this.ensureStepOrder();
          
          // Merge AI suggestions into variable steps
          // Step 1: job-type (REQUIRED - must have options!)
          const jobTypeStep = this.config.steps.find(s => s.id === 'step-job-type');
          const aiJobTypeStep = aiConfig.steps.find(s => s.id === 'step-job-type');
          if (jobTypeStep && jobTypeStep.fields[0]) {
            if (aiJobTypeStep && aiJobTypeStep.fields[0] && aiJobTypeStep.fields[0].options && aiJobTypeStep.fields[0].options.length > 0) {
              jobTypeStep.fields[0].options = aiJobTypeStep.fields[0].options;
            } else if (!jobTypeStep.fields[0].options || jobTypeStep.fields[0].options.length === 0) {
              // Fallback: if no options, keep empty array (will show message)
              console.warn('Step 1 (job-type) has no options from AI. User needs to add options manually.');
            }
            jobTypeStep.fields[0].type = 'radio-cards';
          }
          
          // Step 2: subcategory
          const subcategoryStep = this.config.steps.find(s => s.id === 'step-subcategory');
          const aiSubcategoryStep = aiConfig.steps.find(s => s.id === 'step-subcategory');
          if (subcategoryStep && aiSubcategoryStep && aiSubcategoryStep.fields[0]) {
            subcategoryStep.fields[0].options = aiSubcategoryStep.fields[0].options || [];
            subcategoryStep.fields[0].type = 'radio-cards';
          }
          
          // Step 3: scope
          const scopeStep = this.config.steps.find(s => s.id === 'step-scope');
          const aiScopeStep = aiConfig.steps.find(s => s.id === 'step-scope');
          if (scopeStep && aiScopeStep && aiScopeStep.fields[0]) {
            scopeStep.fields[0].options = aiScopeStep.fields[0].options || [];
            scopeStep.fields[0].type = 'radio-cards';
          }
          
          // Step 5: description examples
          const descriptionStep = this.config.steps.find(s => s.id === 'step-description');
          const aiDescriptionStep = aiConfig.steps.find(s => s.id === 'step-description');
          if (descriptionStep && aiDescriptionStep && aiDescriptionStep.fields[0]) {
            descriptionStep.fields[0].exampleSentences = aiDescriptionStep.fields[0].exampleSentences || [];
            descriptionStep.fields[0].type = 'textarea-with-examples';
          }
          
          // Re-ensure step order after merge
          this.ensureStepOrder();
          
          // Old code for reference (removed):
          // const variableSteps = result.variableSteps;
          
          // No need to add fixed steps - they're already in the config via ensureStepOrder()

          // Ensure correct order
          this.ensureStepOrder();

          // Select first step
          if (this.config.steps.length > 0) {
            this.selectedStepId = this.config.steps[0].id;
            this.currentPreviewStep = 0;
          }

          this.renderStepsList();
          this.renderPreview();
          this.showSuccessNotification('AI formulier gegenereerd! Controleer de stappen en velden voordat je opslaat.');
        } else {
          throw new Error(result.error || 'Fout bij genereren');
        }
      } catch (error) {
        console.error('AI generation error:', error);
        this.showErrorNotification('Fout bij AI genereren: ' + error.message);
      } finally {
        aiBtn.disabled = false;
        aiBtn.innerHTML = '<i class="fas fa-magic"></i> AI formulier genereren';
      }
    },

    // Show success notification
    showSuccessNotification(message) {
      const notification = document.createElement('div');
      notification.className = 'form-builder-notification form-builder-notification-success';
      notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${this.escapeHtml(message)}</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('show');
      }, 10);
      
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 4000);
    },

    // Show error notification
    showErrorNotification(message) {
      const notification = document.createElement('div');
      notification.className = 'form-builder-notification form-builder-notification-error';
      notification.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${this.escapeHtml(message)}</span>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('show');
      }, 10);
      
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    },

    // Show confirmation dialog (returns Promise)
    showConfirmDialog(message, title = 'Bevestigen') {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'field-delete-modal-overlay';
        modal.innerHTML = `
          <div class="field-delete-modal">
            <div class="field-delete-modal-header">
              <i class="fas fa-question-circle"></i>
              <h3>${this.escapeHtml(title)}</h3>
            </div>
            <div class="field-delete-modal-body">
              <p>${this.escapeHtml(message)}</p>
            </div>
            <div class="field-delete-modal-actions">
              <button type="button" class="btn-secondary confirm-cancel-btn">
                Annuleren
              </button>
              <button type="button" class="btn-danger confirm-ok-btn">
                Bevestigen
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        // Handle button clicks
        modal.querySelector('.confirm-cancel-btn').addEventListener('click', () => {
          modal.remove();
          resolve(false);
        });

        modal.querySelector('.confirm-ok-btn').addEventListener('click', () => {
          modal.remove();
          resolve(true);
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.remove();
            resolve(false);
          }
        });
      });
    },

    // Attach event listeners
    attachEventListeners() {
      // Save button
      document.getElementById('saveBtn').addEventListener('click', () => this.saveConfig());

      // AI generate button
      document.getElementById('aiGenerateBtn').addEventListener('click', () => this.showAIGenerateModal());

      // Add step button
      document.getElementById('addStepBtn').addEventListener('click', () => this.addStep());

      // Toolbar field type buttons
      document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const fieldType = e.currentTarget.dataset.fieldType;
          
          // Add visual feedback
          const button = e.currentTarget;
          button.style.transform = 'scale(0.95)';
          setTimeout(() => {
            button.style.transform = '';
          }, 150);
          
          // Add field
          this.addField(fieldType);
        });
      });

      // Steps list (event delegation)
      document.getElementById('stepsList').addEventListener('click', (e) => {
        const stepItem = e.target.closest('.step-sidebar-item');
        if (!stepItem) return;

        const stepId = stepItem.dataset.stepId;
        const action = e.target.closest('[data-action]')?.dataset.action;

        if (action === 'step-up') {
          this.moveStep(stepId, 'up');
        } else if (action === 'step-down') {
          this.moveStep(stepId, 'down');
        } else if (action === 'step-edit') {
          this.editStepTitle(stepId);
        } else if (action === 'step-delete') {
          this.deleteStep(stepId);
        } else {
          // Select step
          this.selectedStepId = stepId;
          const stepIndex = this.config.steps.findIndex(s => s.id === stepId);
          if (stepIndex !== -1) {
            this.currentPreviewStep = stepIndex;
          }
          this.renderStepsList();
          this.renderPreview();
        }
      });

      // Preview field clicks (select field)
      const previewContainer = document.getElementById('previewContainer');
      if (previewContainer) {
        previewContainer.addEventListener('click', (e) => {
          // Don't trigger on action buttons
          if (e.target.closest('.field-action-btn')) return;
          
          const fieldGroup = e.target.closest('.form-field-group');
        if (!fieldGroup) return;

          const fieldId = fieldGroup.dataset.fieldId;
          if (fieldId) {
            this.selectField(fieldId);
          }
        });
      }

      // Refresh preview button
      const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
      if (refreshPreviewBtn) {
        refreshPreviewBtn.addEventListener('click', () => {
          this.renderPreview();
        });
      }

      // Fullscreen preview button
      const fullscreenPreviewBtn = document.getElementById('fullscreenPreviewBtn');
      if (fullscreenPreviewBtn) {
        fullscreenPreviewBtn.addEventListener('click', () => {
          // Toggle fullscreen mode
          const viewport = document.getElementById('previewViewport');
          if (viewport) {
            viewport.classList.toggle('fullscreen');
          }
        });
      }

      // Device preview buttons
      document.querySelectorAll('.device-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const device = e.currentTarget.dataset.device;
          if (!device) return;

          // Remove active class from all device buttons
          document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
          
          // Add active class to clicked button
          e.currentTarget.classList.add('active');
          
          // Update preview viewport data-device attribute
          const viewport = document.getElementById('previewViewport');
          if (viewport) {
            // Add transition class for smooth animation
            viewport.style.transition = 'all 0.3s ease';
            
            // Update device attribute
            viewport.setAttribute('data-device', device);
            
            // Optional: Update device label if it exists
            const deviceLabel = document.querySelector('.device-label');
            if (deviceLabel) {
              const labels = {
                desktop: 'Desktop',
                tablet: 'Tablet',
                mobile: 'Mobiel'
              };
              deviceLabel.textContent = labels[device] || device;
            }
            
            // Scroll preview container into view if needed
            setTimeout(() => {
              const container = viewport.querySelector('.preview-container');
              if (container) {
                container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, 100);
          }
        });
      });
    },


    // Escape HTML
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FormBuilder.init());
  } else {
    FormBuilder.init();
  }

  // Expose to window for inline handlers
  window.FormBuilder = FormBuilder;

})();

