const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const leadValuePredictionService = require('../services/leadValuePredictionService');

// =====================================================
// PUBLIC FORM ROUTES (Phase 3)
// =====================================================

// GET /form/:slug
// Render multi-step form for a specific industry
router.get("/form/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Find industry by slug
    const { data: industry, error: industryError } = await supabaseAdmin
      .from('industries')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (industryError || !industry) {
      return res.status(404).render('forms/not-found', {
        message: 'Formulier niet gevonden',
        slug: slug
      });
    }

    // Find active form template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('lead_form_templates')
      .select('id, config_json')
      .eq('industry_id', industry.id)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (templateError || !template) {
      return res.status(404).render('forms/no-template', {
        industry: industry,
        slug: slug
      });
    }

    // Render form
    res.render('forms/lead-form', {
      industry: industry,
      template: {
        ...template.config_json,
        id: template.id
      },
      slug: slug,
      errors: {},
      values: {},
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
  } catch (err) {
    console.error("Error loading form:", err);
    res.status(500).render('forms/error', {
      message: 'Er is een fout opgetreden bij het laden van het formulier'
    });
  }
});

// POST /form/:slug/submit
// Handle form submission and create lead
router.post("/form/:slug/submit", async (req, res) => {
  try {
    const { slug } = req.params;
    const body = req.body;

    // Find industry by slug
    const { data: industry, error: industryError } = await supabaseAdmin
      .from('industries')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (industryError || !industry) {
      return res.status(404).render('forms/not-found', {
        message: 'Formulier niet gevonden',
        slug: slug
      });
    }

    // Find active form template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('lead_form_templates')
      .select('config_json')
      .eq('industry_id', industry.id)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (templateError || !template) {
      return res.status(404).render('forms/no-template', {
        industry: industry,
        slug: slug
      });
    }

    const templateConfig = template.config_json;
    const errors = {};
    const values = { ...body };

    // Validate all fields from template
    templateConfig.steps.forEach(step => {
      step.fields.forEach(field => {
        const fieldValue = body[field.id];
        
        // Required field validation
        if (field.required && (!fieldValue || fieldValue.trim() === '')) {
          errors[field.id] = 'Dit veld is verplicht.';
        }
        
        // Email validation
        if (field.type === 'email' && fieldValue && !fieldValue.includes('@')) {
          errors[field.id] = 'Ongeldig e-mailadres.';
        }
      });
    });

    // If validation errors, re-render form with errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).render('forms/lead-form', {
        industry: industry,
        template: templateConfig,
        slug: slug,
        errors: errors,
        values: values
      });
    }

    // Map form fields to leads columns
    // Support both old format (name) and new format (first_name, last_name)
    const firstName = body.first_name || body.name?.split(' ')[0] || '';
    const lastName = body.last_name || body.name?.split(' ').slice(1).join(' ') || '';
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : (body.name || body.full_name || '');
    
    const leadData = {
      name: fullName, // Keep name for backward compatibility
      email: body.email || '',
      phone: body.phone || '',
      message: body.description || body.message || null, // Support description field
      postcode: body.postcode || null,
      province: body.province || null,
      industry_id: industry.id,
      status: 'new',
      source_type: 'platform',
      source_channel: 'public_form',
      created_at: new Date().toISOString()
    };

    // Ensure required fields are present
    if (!leadData.name || !leadData.email || !leadData.phone) {
      return res.status(400).render('forms/lead-form', {
        industry: industry,
        template: templateConfig,
        slug: slug,
        errors: { 
          _general: 'Naam, e-mail en telefoonnummer zijn verplicht.' 
        },
        values: values
      });
    }

    // Insert lead
    const { data: newLead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (insertError) {
      console.error("Error creating lead from form:", insertError);
      return res.status(500).render('forms/error', {
        message: 'Er is een fout opgetreden bij het verzenden van uw aanvraag. Probeer het later opnieuw.'
      });
    }

    // Link analytics session to lead (if session_id is provided)
    const sessionId = body.session_id || req.headers['x-session-id'];
    if (sessionId && newLead.id) {
      try {
        await supabaseAdmin
          .from('form_analytics')
          .update({ lead_id: newLead.id })
          .eq('session_id', sessionId)
          .is('lead_id', null);
      } catch (analyticsError) {
        console.error('Error linking analytics to lead:', analyticsError);
        // Don't fail form submission if analytics linking fails
      }
    }

    // Generate lead value prediction (async, don't block form submission)
    try {
      // Prepare form answers object (all form fields except system fields)
      const formAnswers = {};
      Object.keys(body).forEach(key => {
        // Skip system fields and contact fields that are already in leadData
        if (!['session_id', '_csrf', 'name', 'full_name', 'email', 'phone'].includes(key)) {
          formAnswers[key] = body[key];
        }
      });

      // Add contact fields from leadData
      formAnswers.first_name = body.first_name || body.name?.split(' ')[0] || '';
      formAnswers.last_name = body.last_name || body.name?.split(' ').slice(1).join(' ') || '';
      formAnswers.email = leadData.email;
      formAnswers.phone = leadData.phone;

      // Generate prediction (fire and forget - don't block response)
      leadValuePredictionService.predictLeadValue(newLead, formAnswers, industry)
        .then(prediction => {
          console.log(`Lead value prediction generated for lead ${newLead.id}:`, {
            deal_value: prediction.predicted_deal_value,
            win_probability: prediction.predicted_win_probability
          });
        })
        .catch(predictionError => {
          console.error('Error generating lead value prediction:', predictionError);
          // Don't throw - prediction failure shouldn't block form submission
        });
    } catch (predictionError) {
      console.error('Error setting up lead value prediction:', predictionError);
      // Don't fail form submission if prediction fails
    }

    // Success - redirect to thank you page
    res.redirect(`/form/${slug}/bedankt`);
  } catch (err) {
    console.error("Error submitting form:", err);
    res.status(500).render('forms/error', {
      message: 'Er is een fout opgetreden bij het verzenden van uw aanvraag.'
    });
  }
});

// GET /form/:slug/bedankt
// Thank you page after form submission
router.get("/form/:slug/bedankt", async (req, res) => {
  try {
    const { slug } = req.params;

    // Find industry for display
    const { data: industry, error: industryError } = await supabaseAdmin
      .from('industries')
      .select('name')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    res.render('forms/thank-you', {
      industry: industry || { name: 'de branche' },
      slug: slug
    });
  } catch (err) {
    console.error("Error loading thank you page:", err);
    res.render('forms/thank-you', {
      industry: { name: 'de branche' },
      slug: req.params.slug
    });
  }
});

module.exports = router;

