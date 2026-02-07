const express = require("express")
const router = express.Router()
const bcrypt = require("bcrypt")
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { supabase, supabaseAdmin } = require('../config/supabase')
const { requireAuth, isAdmin, isManagerOrAdmin } = require("../middleware/auth")
const { requirePermission, requireAnyPermission, getUserPermissions, isAdminOrHasPermission, requireAdmin } = require('../middleware/permissions')
const userRepository = require("../database/userRepository")
const subscriptionsRoutes = require('./subscriptions')
const paymentsRoutes = require('./payments')
const webhooksRoutes = require('./webhooks')
const { createClient } = require('@supabase/supabase-js')
const { mollieClient } = require('../lib/mollie')
const { mapMollieMethodToDb } = require('../helpers/method-map')
const ActivityService = require('../services/activityService')
const SystemLogService = require('../services/systemLogService')
const { validateAssignment, validateAssignmentCreate } = require('../guards/validateAssignment')
const UserRiskAssessmentService = require('../services/userRiskAssessmentService')
const KvkApiService = require('../services/kvkApiService')
const LeadAssignmentService = require('../services/leadAssignmentService')

// API routes voor gebruikers

router.get("/profiles", requireAuth, async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, company_name, email, is_admin, created_at')
      .order('first_name')

    if (error) throw error

    // Log API access
    await SystemLogService.logAPI(
      'info',
      '/api/profiles',
      'Profielen opgehaald via API',
      `${profiles.length} profielen opgehaald`,
      req.user?.id,
      req.ip,
      req.get('User-Agent')
    );

    res.json(profiles)
  } catch (err) {
    console.error("Error fetching profiles:", err)
    
    // Log API error
    await SystemLogService.logAPI(
      'error',
      '/api/profiles',
      'Fout bij ophalen profielen',
      `Fout: ${err.message}`,
      req.user?.id,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruikers" })
  }
})

router.get("/profiles/search", requireAuth, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Sanitize the search query to prevent SQL injection
    const sanitizedQuery = query.replace(/[%_]/g, '\\$&');
    const searchPattern = `%${sanitizedQuery}%`;

    // Use text search with individual filters
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, company_name, email, first_name, last_name')
      .or(
        `company_name.ilike.${searchPattern},` +
        `email.ilike.${searchPattern},` +
        `first_name.ilike.${searchPattern},` +
        `last_name.ilike.${searchPattern}`
      )
      .order('company_name')
      .limit(10);

    if (error) {
      console.error("Supabase search error:", error);
      // Log the full error details
      console.error("Full error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    // Format the response to include full name and display name
    const formattedUsers = (profiles || []).map(user => ({
      ...user,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || null,
      display_name: user.company_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
    }));

    res.json(formattedUsers);
  } catch (err) {
    console.error("Error in user search:", err);
    // Log the full error in development
    if (process.env.NODE_ENV === 'development') {
      console.error("Full error details:", {
        message: err.message,
        stack: err.stack,
        details: err.details || err.hint || err.code
      });
    }
    res.status(500).json({ 
      error: "Er is een fout opgetreden bij het zoeken naar gebruikers",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.get("/profiles/:id", async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" })

    res.json(user)
  } catch (err) {
    console.error("Error fetching user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruiker" })
  }
})

router.post("/profiles", async (req, res) => {
  try {
    const { company_name, email, password, is_admin } = req.body

    // Controleer of email al bestaat
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return res.status(400).json({ error: "Email is al in gebruik" })
    }

    // Wachtwoord hashen
    const hashedPassword = await bcrypt.hash(password, 10)

    // Gebruiker aanmaken
    const { data: user, error } = await supabase
      .from('profiles')
      .insert([
        {
          company_name,
          email,
          password: hashedPassword,
          is_admin: is_admin || 0,
          created_at: new Date().toISOString(),
        }
      ])
      .select()
      .single()

    if (error) throw error

    res.status(201).json(user)
  } catch (err) {
    console.error("Error creating user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het aanmaken van de gebruiker" })
  }
})

router.put("/profiles/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const userData = {
      email: req.body.email,
      company_name: req.body.company_name,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      phone: req.body.phone
    };

    const result = await userRepository.updateUser(userId, userData);
    res.json(result);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update user profile'
    });
  }
})

router.delete("/profiles/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error

    res.json({ message: "Gebruiker succesvol verwijderd" })
  } catch (err) {
    console.error("Error deleting user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de gebruiker" })
  }
})

// API routes voor leads

router.get("/leads/:id", requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (error) throw error
    if (!lead) return res.status(404).json({ error: "Lead niet gevonden" })

    // Manually fetch user data if user_id exists
    let assignedUser = null
    if (lead.user_id) {
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, company_name')
        .eq('id', lead.user_id)
        .single()
      
      if (!userError && user) {
        assignedUser = user
      }
    }

    // Transform the data to include the assigned user's name
    const transformedLead = {
      ...lead,
      assigned_user: assignedUser,
      assigned_to: assignedUser ? 
        `${assignedUser.first_name} ${assignedUser.last_name}` : 
        null
    };

    res.json(transformedLead)
  } catch (err) {
    console.error("Error fetching lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van het lead" })
  }
})

// Public endpoint for landing page leads (no auth required)
router.post("/leads/public", async (req, res) => {
  try {
    const { name, email, phone, message, landing_page_id, gclid, gbraid, wbraid } = req.body;
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: "Naam en e-mail zijn verplicht" 
      });
    }

    const hasAdsIdentifiers = !!(gclid || gbraid || wbraid);

    // Prepare data
    const insertData = {
      name,
      email,
      phone: phone || null,
      message: message || null,
      status: 'new',
      priority: 'medium',
      created_at: new Date().toISOString(),
      gclid: gclid || null,
      gbraid: gbraid || null,
      wbraid: wbraid || null
    };

    // PART 1: If landing_page_id is provided, fetch landing page and resolve campaign ID
    let resolvedCampaignId = null;
    if (landing_page_id) {
      const PartnerLandingPageService = require('../services/partnerLandingPageService');
      const landingPage = await PartnerLandingPageService.getLandingPage(landing_page_id);
      
      if (landingPage) {
        insertData.landing_page_id = landing_page_id;
        insertData.source_type = landingPage.source_type || 'platform';
        insertData.routing_mode = 'ai_segment_routing'; // Platform LPs use AI routing

        // Optional: mark source as google_ads if we have click identifiers
        if (hasAdsIdentifiers) {
          insertData.source = 'google_ads';
        }

        // PART 1: Resolve campaign ID from landing page
        if (landingPage.google_ads_campaign_id) {
          resolvedCampaignId = landingPage.google_ads_campaign_id;
          insertData.google_ads_campaign_id = resolvedCampaignId;
        } else if (landingPage.segment_id) {
          // Fallback: try to get campaign ID from segment
          const { data: segment, error: segError } = await supabaseAdmin
            .from('lead_segments')
            .select('google_ads_campaign_id')
            .eq('id', landingPage.segment_id)
            .single();
          
          if (!segError && segment && segment.google_ads_campaign_id) {
            resolvedCampaignId = segment.google_ads_campaign_id;
            insertData.google_ads_campaign_id = resolvedCampaignId;
          }
        }
      } else {
        console.warn(`Landing page ${landing_page_id} not found, continuing without LP tracking`);
      }
    }

    // PART 1: If no campaign ID resolved yet but we have Ads identifiers, log a warning
    if (hasAdsIdentifiers && !resolvedCampaignId) {
      console.warn('⚠️ Lead has Google Ads identifiers (gclid/gbraid/wbraid) but no campaign ID could be resolved from landing page or segment');
    }

    // Insert lead
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ 
        success: false, 
        error: "Fout bij opslaan van uw aanvraag. Probeer het later opnieuw." 
      });
    }

    console.log('Created public lead from landing page:', lead.id);

    // PART 1: Create a conversion record for this lead (form submit)
    // Ensure campaign ID is resolved even if it wasn't set on the lead initially
    try {
      let finalCampaignId = lead.google_ads_campaign_id || resolvedCampaignId;
      
      // PART 1: Last resort: try to resolve from segment if we have landing_page_id
      if (!finalCampaignId && lead.landing_page_id) {
        const { data: lp } = await supabaseAdmin
          .from('partner_landing_pages')
          .select('segment_id, google_ads_campaign_id')
          .eq('id', lead.landing_page_id)
          .single();
        
        if (lp) {
          finalCampaignId = lp.google_ads_campaign_id || null;
          if (!finalCampaignId && lp.segment_id) {
            const { data: seg } = await supabaseAdmin
              .from('lead_segments')
              .select('google_ads_campaign_id')
              .eq('id', lp.segment_id)
              .single();
            if (seg && seg.google_ads_campaign_id) {
              finalCampaignId = seg.google_ads_campaign_id;
              // Update the lead with the resolved campaign ID
              await supabaseAdmin
                .from('leads')
                .update({ google_ads_campaign_id: finalCampaignId })
                .eq('id', lead.id);
            }
          }
        }
      }

      const conversionInsert = {
        lead_id: lead.id,
        google_ads_campaign_id: finalCampaignId,
        event_type: 'form_submit',
        value: null,
        currency: 'EUR',
        gclid: lead.gclid || gclid || null,
        gbraid: lead.gbraid || gbraid || null,
        wbraid: lead.wbraid || wbraid || null
      };

      await supabaseAdmin
        .from('lead_conversions')
        .insert([conversionInsert]);
    } catch (convError) {
      console.error('Error creating lead_conversions row:', convError);
      // Do not block the user on conversion logging
    }

    // Assign segment to lead (async, don't block on errors)
    try {
      const LeadSegmentService = require('../services/leadSegmentService');
      await LeadSegmentService.assignSegmentToLead(lead.id);
    } catch (segmentError) {
      console.error('Error assigning segment to lead:', segmentError);
    }

    // Auto-assign lead via AI router if routing_mode is 'ai_segment_routing'
    if (lead.routing_mode === 'ai_segment_routing' && !lead.user_id) {
      try {
        const LeadAssignmentService = require('../services/leadAssignmentService');
        const candidates = await LeadAssignmentService.getCandidates(lead.id);
        
        if (candidates && candidates.length > 0) {
          // Try to assign to candidates in order (best match first)
          // If one fails (quota reached, paused, etc.), try the next one
          let assigned = false;
          for (const candidate of candidates) {
            try {
              await LeadAssignmentService.assignLead(lead.id, candidate.partnerId);
              console.log(`Auto-assigned lead ${lead.id} to partner ${candidate.partnerId} via AI router (score: ${candidate.score.totalScore})`);
              assigned = true;
              break; // Success, stop trying
            } catch (assignError) {
              // Log but continue to next candidate
              console.log(`Failed to assign lead ${lead.id} to partner ${candidate.partnerId}: ${assignError.message}. Trying next candidate...`);
              continue;
            }
          }
          
          if (!assigned) {
            console.warn(`Could not auto-assign lead ${lead.id} to any partner. All ${candidates.length} candidates failed (quota reached, paused, etc.). Lead will remain unassigned.`);
          }
        }
      } catch (assignError) {
        // Only log if getCandidates itself failed, not individual assignment failures
        console.error('Error getting candidates for auto-assignment:', assignError);
      }
    }

    return res.json({
      success: true,
      message: "Uw aanvraag is verzonden. We nemen zo snel mogelijk contact met u op.",
      lead: {
        id: lead.id
      }
    });

  } catch (error) {
    console.error('Error creating public lead:', error);
    return res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden. Probeer het later opnieuw." 
    });
  }
});

/**
 * Internal helper route to inspect basic Google Ads campaign settings.
 * DEV ONLY: returns networks, geo target types, locations and languages for a campaign.
 */
router.get("/internal/google-ads/campaign/:campaignId/inspect", async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const { campaignId } = req.params;
    const customerId = req.query.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'GOOGLE_ADS_CUSTOMER_ID is not configured'
      });
    }

    const GoogleAdsCampaignBuilderService = require('../services/googleAdsCampaignBuilderService');
    const inspection = await GoogleAdsCampaignBuilderService.inspectCampaignBasics(customerId, campaignId);

    return res.json({
      success: true,
      data: inspection
    });
  } catch (error) {
    console.error('Error inspecting Google Ads campaign:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to inspect campaign'
    });
  }
});

// Admin endpoint for leads (requires auth)
router.post("/leads", requireAuth, requirePermission('leads.create'), validateAssignmentCreate, async (req, res) => {
  try {
    const { name, email, phone, message, user_id, assigned_to, industry_id, status, deadline, priority, budget, landing_page_id } = req.body;
    
    // Use assigned_to if user_id is not provided
    const userId = user_id || assigned_to;

    // Debug logging
    console.log('Received lead data:', {
      name,
      email,
      phone,
      message,
      user_id,
      assigned_to,
      userId,
      industry_id,
      status,
      deadline,
      priority,
      budget,
      landing_page_id
    });

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: "Naam en e-mail zijn verplicht" 
      });
    }

    // Prepare data with correct types
    const insertData = {
      name,
      email,
      phone: phone || null,
      message: message || null,
      user_id: userId || null,
      industry_id: industry_id ? parseInt(industry_id) : null,
      status: status || 'new',
      deadline: deadline || null,
      priority: priority || 'medium',
      budget: budget || null,
      created_at: new Date().toISOString()
    };

    // If landing_page_id is provided, fetch landing page and set source_type/routing_mode
    if (landing_page_id) {
      const PartnerLandingPageService = require('../services/partnerLandingPageService');
      const landingPage = await PartnerLandingPageService.getLandingPage(landing_page_id);
      
      if (landingPage) {
        insertData.landing_page_id = landing_page_id;
        insertData.source_type = landingPage.source_type || 'platform';
        insertData.routing_mode = 'ai_segment_routing'; // Platform LPs use AI routing
      } else {
        // Landing page not found, but don't fail - just log warning
        console.warn(`Landing page ${landing_page_id} not found, continuing without LP tracking`);
      }
    }

    // Debug logging for insert data
    console.log('Inserting lead with data:', insertData);

    // Validate industry_id if provided
    if (insertData.industry_id) {
      const { data: industry, error: industryError } = await supabaseAdmin
        .from('industries')
        .select('id')
        .eq('id', insertData.industry_id)
        .single();

      if (industryError || !industry) {
        return res.status(400).json({ 
          success: false, 
          error: "Ongeldige branche" 
        });
      }
    }

    // Validate user_id if provided
    if (insertData.user_id) {
      const { data: user, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', insertData.user_id)
        .single();

      if (userError || !user) {
        return res.status(400).json({ 
          success: false, 
          error: "Ongeldige gebruiker" 
        });
      }
    }

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      throw new Error("Database error: " + error.message);
    }

    console.log('Created lead:', lead);

    // Assign segment to lead (async, don't block on errors)
    try {
      const LeadSegmentService = require('../services/leadSegmentService');
      await LeadSegmentService.assignSegmentToLead(lead.id);
    } catch (segmentError) {
      console.error('Error assigning segment to lead:', segmentError);
      // Don't throw - segment assignment is optional
    }

    // Auto-assign lead via AI router if routing_mode is 'ai_segment_routing'
    if (lead.routing_mode === 'ai_segment_routing' && !lead.user_id) {
      try {
        const LeadAssignmentService = require('../services/leadAssignmentService');
        const candidates = await LeadAssignmentService.getCandidates(lead.id);
        
        if (candidates && candidates.length > 0) {
          const bestMatch = candidates[0]; // Highest score
          await LeadAssignmentService.assignLead(lead.id, bestMatch.partnerId);
          console.log(`Auto-assigned lead ${lead.id} to partner ${bestMatch.partnerId} via AI router`);
        }
      } catch (assignError) {
        console.error('Error auto-assigning lead via AI router:', assignError);
        // Don't throw - auto-assignment is optional, lead can be assigned manually later
      }
    }

    // Auto-assign lead if enabled and no user_id provided (legacy flow)
    if (!insertData.user_id && lead.routing_mode !== 'ai_segment_routing') {
      try {
        // Check if auto-assign is enabled
        const { data: autoAssignSetting } = await supabaseAdmin
          .from('ai_router_settings')
          .select('setting_value')
          .eq('setting_key', 'auto_assign_enabled')
          .single();

        const autoAssignEnabled = autoAssignSetting?.setting_value !== 'false';

        if (autoAssignEnabled) {
          // Get threshold
          const { data: thresholdSetting } = await supabaseAdmin
            .from('ai_router_settings')
            .select('setting_value')
            .eq('setting_key', 'auto_assign_threshold')
            .single();

          const threshold = parseInt(thresholdSetting?.setting_value || '70', 10);

          // Try to auto-assign
          try {
            const assignmentResult = await LeadAssignmentService.assignLead(lead.id, 'auto');
            
            // Only proceed if score meets threshold
            if (assignmentResult.score >= threshold) {
              console.log(`✅ Auto-assigned lead ${lead.id} to partner ${assignmentResult.assignedTo} with score ${assignmentResult.score}`);
              
              // Update lead with assignment
              lead.assigned_to = assignmentResult.assignedTo;
              lead.user_id = assignmentResult.assignedTo;
              lead.assigned_by = 'auto';
              lead.assignment_score = assignmentResult.score;
              
              // Send notification (will be handled below)
            } else {
              console.log(`⚠️ Auto-assign skipped: score ${assignmentResult.score} below threshold ${threshold}`);
            }
          } catch (assignError) {
            console.warn('⚠️ Auto-assign failed (will be assigned manually later):', assignError.message);
            // Don't throw - lead creation succeeded, assignment can happen later
          }
        }
      } catch (autoAssignError) {
        console.error('Error checking auto-assign settings:', autoAssignError);
        // Don't throw - lead creation succeeded
      }
    }

    // Send lead assigned notification if lead was assigned immediately
    if (insertData.user_id || lead.user_id) {
      try {
        const NotificationService = require('../services/notificationService');
        const notificationService = new NotificationService();
        
        // Get industry name
        let industryName = 'Onbekend';
        if (insertData.industry_id) {
          const { data: industry } = await supabaseAdmin
            .from('industries')
            .select('name')
            .eq('id', insertData.industry_id)
            .single();
          if (industry) {
            industryName = industry.name;
          }
        }
        
        const assignedUserId = lead.user_id || insertData.user_id;
        await notificationService.sendLeadAssigned(assignedUserId, {
          company_name: name || 'Onbekend bedrijf',
          contact_name: name || 'Onbekend',
          email: email || '',
          phone: phone || '',
          industry: industryName,
          lead_id: lead.id
        });
        
        // Check quota after assignment
        const { data: usage } = await supabaseAdmin
          .from('v_monthly_lead_usage')
          .select('effective_count')
          .eq('user_id', insertData.user_id)
          .maybeSingle();
        
        const { data: subscription } = await supabaseAdmin
          .from('subscriptions')
          .select('leads_per_month')
          .eq('user_id', insertData.user_id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (usage && subscription) {
          const leadsUsed = usage.effective_count || 0;
          const monthlyQuota = subscription.leads_per_month || 0;
          const leadsRemaining = Math.max(0, monthlyQuota - leadsUsed);
          const usagePercentage = monthlyQuota > 0 ? Math.round((leadsUsed / monthlyQuota) * 100) : 0;
          
          // Send quota reached notification if exactly at quota
          if (leadsUsed >= monthlyQuota && monthlyQuota > 0) {
            await notificationService.sendQuotaReached(insertData.user_id, {
              leads_used: leadsUsed,
              monthly_quota: monthlyQuota,
              quota_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
            });
          }
          // Send quota warning if >= 80% used
          else if (usagePercentage >= 80 && usagePercentage < 100) {
            await notificationService.sendQuotaWarning(insertData.user_id, {
              leads_used: leadsUsed,
              monthly_quota: monthlyQuota,
              leads_remaining: leadsRemaining,
              usage_percentage: usagePercentage,
              quota_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
            });
          }
        }
      } catch (notifError) {
        console.error('Error sending notifications:', notifError);
        // Don't throw error, lead creation was successful
      }
    }

    // Log the initial activity
    const { error: activityError } = await supabase
      .from('lead_activities')
      .insert([
        {
          lead_id: lead.id,
          type: 'created',
          description: 'Aanvraag ingediend',
          created_by: req.user.id
        }
      ]);

    if (activityError) {
      console.error("Error logging initial activity:", activityError);
      // Don't throw error here, as the lead was created successfully
    }

    // Log lead creation in system logs
    try {
      const SystemLogService = require('../services/systemLogService');
      
      // Get industry name if available
      let industryName = 'Onbekend';
      if (insertData.industry_id) {
        const { data: industry } = await supabaseAdmin
          .from('industries')
          .select('name')
          .eq('id', insertData.industry_id)
          .single();
        if (industry) {
          industryName = industry.name;
        }
      }

      // Get assigned user name if available
      let assignedUserName = 'Niet toegewezen';
      if (insertData.user_id) {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, company_name')
          .eq('id', insertData.user_id)
          .single();
        if (user) {
          assignedUserName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.company_name || 'Onbekende gebruiker';
        }
      }

      await SystemLogService.logSystem(
        'success',
        'Nieuwe Lead Aangemaakt',
        `Nieuwe lead aangemaakt: ${name} (${email})`,
        `Lead ID: ${lead.id}, Branche: ${industryName}, Toegewezen aan: ${assignedUserName}, Prioriteit: ${insertData.priority}`,
        {
          lead_id: lead.id,
          lead_name: name,
          lead_email: email,
          industry_id: insertData.industry_id,
          industry_name: industryName,
          assigned_user_id: insertData.user_id,
          assigned_user_name: assignedUserName,
          priority: insertData.priority,
          status: insertData.status,
          deadline: insertData.deadline
        },
        req.user?.id
      );
    } catch (logError) {
      console.error("Error logging lead creation:", logError);
      // Don't throw error here, as the lead was created successfully
    }

    res.status(201).json({ 
      success: true, 
      data: lead 
    });
  } catch (err) {
    console.error("Error creating lead:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het aanmaken van de lead" 
    });
  }
})

router.put("/leads/:id", requireAuth, validateAssignment, async (req, res) => {
  try {
    const leadId = req.params.id
    const { name, email, phone, message, user_id, status, industry_id, budget, assigned_to } = req.body

    // Valideer input
    if (!name || !email || !phone) {
      return res.status(400).json({ 
        success: false,
        error: "Naam, email en telefoon zijn verplicht" 
      })
    }

    // Controleer of lead bestaat
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError) throw leadError
    if (!lead) return res.status(404).json({ 
      success: false,
      error: "Lead niet gevonden" 
    })

    // Prevent status changes for accepted leads
    if (lead.status === 'accepted' && status && status !== 'accepted') {
      return res.status(400).json({ 
        success: false,
        error: "Geaccepteerde leads kunnen niet meer worden gewijzigd" 
      })
    }

    // Prepare update data
    const updateData = {
      name,
      email,
      phone,
      message,
      user_id: user_id || null,
      status,
      industry_id: industry_id ? parseInt(industry_id) : null,
      budget: budget || null,
      assigned_to: assigned_to || null
    }

    // If status is being changed to 'approved', set price_at_purchase and approved_at
    if (status === 'approved' && lead.status !== 'approved') {
      // Get the current industry price
      let priceAtPurchase = 10.00; // Default price
      
      const industryId = industry_id || lead.industry_id;
      if (industryId) {
        const { data: industry, error: industryError } = await supabaseAdmin
          .from('industries')
          .select('price_per_lead')
          .eq('id', industryId)
          .single();
          
        if (!industryError && industry) {
          priceAtPurchase = industry.price_per_lead;
        }
      }
      
      updateData.price_at_purchase = priceAtPurchase;
      updateData.approved_at = new Date().toISOString();
    }

    // Lead bijwerken
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single()

    if (updateError) throw updateError

    // =====================================================
    // 🔖 DESIGN DECISION: Real-time open_leads_count Update
    // =====================================================
    // Bij rejection/closure: open_leads_count - 1
    // Bij acceptance: open_leads_count blijft gelijk (lead is nog "open")
    // Cron job is alleen backup, niet de "bron van de waarheid"
    // Zie: docs/ARCHITECTURE.md sectie "Current Open Leads Updates"
    // =====================================================
    // TODO: Implementeer real-time update:
    // if (status === 'rejected' || status === 'closed') {
    //   UPDATE partner_performance_stats 
    //   SET open_leads_count = GREATEST(0, open_leads_count - 1)
    //   WHERE partner_id = :assignedPartnerId;
    // }
    // =====================================================

    // Send notifications if lead was assigned to a new user
    const previousUserId = lead.user_id;
    const newUserId = updateData.user_id;
    
    if (newUserId && newUserId !== previousUserId && status === 'accepted') {
      try {
        const NotificationService = require('../services/notificationService');
        const notificationService = new NotificationService();
        
        // Get industry name
        const industryId = updateData.industry_id || updatedLead.industry_id;
        let industryName = 'Onbekend';
        if (industryId) {
          const { data: industry } = await supabaseAdmin
            .from('industries')
            .select('name')
            .eq('id', industryId)
            .single();
          if (industry) {
            industryName = industry.name;
          }
        }
        
        await notificationService.sendLeadAssigned(newUserId, {
          company_name: updatedLead.name || 'Onbekend bedrijf',
          contact_name: updatedLead.name || 'Onbekend',
          email: updatedLead.email || '',
          phone: updatedLead.phone || '',
          industry: industryName,
          lead_id: updatedLead.id
        });
        
        // Check quota after assignment
        const { data: usage } = await supabaseAdmin
          .from('v_monthly_lead_usage')
          .select('effective_count')
          .eq('user_id', newUserId)
          .maybeSingle();
        
        const { data: subscription } = await supabaseAdmin
          .from('subscriptions')
          .select('leads_per_month')
          .eq('user_id', newUserId)
          .eq('status', 'active')
          .maybeSingle();
        
        if (usage && subscription) {
          const leadsUsed = usage.effective_count || 0;
          const monthlyQuota = subscription.leads_per_month || 0;
          const leadsRemaining = Math.max(0, monthlyQuota - leadsUsed);
          const usagePercentage = monthlyQuota > 0 ? Math.round((leadsUsed / monthlyQuota) * 100) : 0;
          
          // Send quota reached notification if exactly at quota
          if (leadsUsed >= monthlyQuota && monthlyQuota > 0) {
            await notificationService.sendQuotaReached(newUserId, {
              leads_used: leadsUsed,
              monthly_quota: monthlyQuota,
              quota_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
            });
          }
          // Send quota warning if >= 80% used
          else if (usagePercentage >= 80 && usagePercentage < 100) {
            await notificationService.sendQuotaWarning(newUserId, {
              leads_used: leadsUsed,
              monthly_quota: monthlyQuota,
              leads_remaining: leadsRemaining,
              usage_percentage: usagePercentage,
              quota_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
            });
          }
        }
      } catch (notifError) {
        console.error('Error sending notifications:', notifError);
        // Don't throw error, lead update was successful
      }
    }

    // Log lead update in system logs
    try {
      const SystemLogService = require('../services/systemLogService');
      
      // Determine what changed
      const changes = [];
      if (lead.name !== name) changes.push(`Naam: ${lead.name} → ${name}`);
      if (lead.email !== email) changes.push(`Email: ${lead.email} → ${email}`);
      if (lead.phone !== phone) changes.push(`Telefoon: ${lead.phone} → ${phone}`);
      if (lead.user_id !== user_id) {
        const oldUserName = lead.user_id ? 'Toegewezen' : 'Niet toegewezen';
        const newUserName = user_id ? 'Toegewezen' : 'Niet toegewezen';
        changes.push(`Toewijzing: ${oldUserName} → ${newUserName}`);
      }
      if (lead.status !== status) changes.push(`Status: ${lead.status} → ${status}`);
      
      // Get industry name if available
      let industryName = 'Onbekend';
      const industryId = industry_id || lead.industry_id;
      if (industryId) {
        const { data: industry } = await supabaseAdmin
          .from('industries')
          .select('name')
          .eq('id', industryId)
          .single();
        if (industry) {
          industryName = industry.name;
        }
      }

      // Get assigned user name if available
      let assignedUserName = 'Niet toegewezen';
      if (user_id) {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, company_name')
          .eq('id', user_id)
          .single();
        if (user) {
          assignedUserName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.company_name || 'Onbekende gebruiker';
        }
      }

      const changeDescription = changes.length > 0 ? changes.join(', ') : 'Geen wijzigingen gedetecteerd';

      await SystemLogService.logSystem(
        'info',
        'Lead Bijgewerkt',
        `Lead bijgewerkt: ${name} (${email})`,
        `Lead ID: ${leadId}, Wijzigingen: ${changeDescription}, Branche: ${industryName}, Toegewezen aan: ${assignedUserName}`,
        {
          lead_id: leadId,
          lead_name: name,
          lead_email: email,
          industry_id: industryId,
          industry_name: industryName,
          assigned_user_id: user_id,
          assigned_user_name: assignedUserName,
          changes: changes,
          old_status: lead.status,
          new_status: status,
          price_at_purchase: updateData.price_at_purchase
        },
        req.user?.id
      );
    } catch (logError) {
      console.error("Error logging lead update:", logError);
      // Don't throw error here, as the lead was updated successfully
    }

    res.json({ 
      success: true, 
      data: updatedLead 
    })
  } catch (err) {
    console.error("Error updating lead:", err)
    res.status(500).json({ 
      success: false,
      error: "Er is een fout opgetreden bij het bijwerken van het lead" 
    })
  }
})

// Approve lead endpoint - sets price_at_purchase to current industry price
router.post("/leads/:id/approve", requireAuth, isAdmin, async (req, res) => {
  try {
    const leadId = req.params.id;
    
    // Get the lead with industry information
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select(`
        *,
        industries:industry_id (
          id,
          name,
          price_per_lead
        )
      `)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        error: "Lead niet gevonden"
      });
    }

    // Calculate price at purchase
    let priceAtPurchase = 10.00; // Default price
    
    if (lead.industry_id && lead.industries) {
      priceAtPurchase = lead.industries.price_per_lead;
    }

    // Update lead status to approved with price_at_purchase
    const { data: updatedLead, error: updateError } = await supabaseAdmin
      .from('leads')
      .update({
        status: 'approved',
        price_at_purchase: priceAtPurchase,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log the approval activity
    const { error: activityError } = await supabaseAdmin
      .from('lead_activities')
      .insert([
        {
          lead_id: leadId,
          type: 'approved',
          description: `Lead goedgekeurd voor €${priceAtPurchase.toFixed(2)}`,
          created_by: req.user.id,
          created_at: new Date().toISOString()
        }
      ]);

    if (activityError) {
      console.error("Error logging approval activity:", activityError);
      // Don't throw error here, as the lead was approved successfully
    }

    // Log lead approval in system logs
    try {
      const SystemLogService = require('../services/systemLogService');
      
      // Get assigned user name if available
      let assignedUserName = 'Niet toegewezen';
      if (lead.user_id) {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, company_name')
          .eq('id', lead.user_id)
          .single();
        if (user) {
          assignedUserName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.company_name || 'Onbekende gebruiker';
        }
      }

      await SystemLogService.logSystem(
        'success',
        'Lead Goedgekeurd',
        `Lead goedgekeurd: ${lead.name} (${lead.email})`,
        `Lead ID: ${leadId}, Prijs: €${priceAtPurchase.toFixed(2)}, Branche: ${lead.industries?.name || 'Onbekend'}, Toegewezen aan: ${assignedUserName}`,
        {
          lead_id: leadId,
          lead_name: lead.name,
          lead_email: lead.email,
          industry_id: lead.industry_id,
          industry_name: lead.industries?.name || 'Onbekend',
          assigned_user_id: lead.user_id,
          assigned_user_name: assignedUserName,
          price_at_purchase: priceAtPurchase,
          old_status: lead.status,
          new_status: 'approved'
        },
        req.user?.id
      );
    } catch (logError) {
      console.error("Error logging lead approval:", logError);
      // Don't throw error here, as the lead was approved successfully
    }

    res.json({
      success: true,
      data: updatedLead,
      message: `Lead goedgekeurd voor €${priceAtPurchase.toFixed(2)}`
    });

  } catch (err) {
    console.error("Error approving lead:", err);
    res.status(500).json({
      success: false,
      error: "Er is een fout opgetreden bij het goedkeuren van het lead"
    });
  }
});

// Assign lead to user
router.post("/leads/:id/assign", requireAuth, isAdmin, validateAssignment, async (req, res) => {
  try {
    const leadId = req.params.id
    const { user_id } = req.body

    // Validation is now handled by validateAssignment middleware
    // req.validatedLead and req.validatedUser are available

    // Get lead price for billing
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('price_at_purchase, industry_id')
      .eq('id', leadId)
      .single()

    if (leadError) throw leadError

    // Get industry price if not set
    let leadPrice = lead.price_at_purchase || 10.00; // Default price
    if (!lead.price_at_purchase && lead.industry_id) {
      const { data: industry, error: industryError } = await supabaseAdmin
        .from('industries')
        .select('price_per_lead')
        .eq('id', lead.industry_id)
        .single();
        
      if (!industryError && industry) {
        leadPrice = industry.price_per_lead;
      }
    }

    // Check user's balance first
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', user_id)
      .single()

    if (profileError) throw profileError

    // Check user's balance and payment methods
    const currentBalance = userProfile.balance || 0;
    
    // Check if user has SEPA mandate
    const { data: paymentMethods, error: paymentMethodError } = await supabaseAdmin
      .from('payment_methods')
      .select('type, provider_payment_method_id')
      .eq('user_id', user_id)
      .eq('type', 'sepa')
      .eq('provider', 'mollie')
      .single();

    const hasSEPAMandate = !paymentMethodError && paymentMethods;

    // Determine billing strategy
    let billingStrategy = 'balance_only';
    let amountToCharge = 0;
    let amountFromBalance = 0;

    if (currentBalance >= leadPrice) {
      // Sufficient balance - use balance only
      billingStrategy = 'balance_only';
      amountFromBalance = leadPrice;
      amountToCharge = 0;
    } else if (currentBalance > 0 && hasSEPAMandate) {
      // Partial balance + SEPA - use balance first, then SEPA
      billingStrategy = 'balance_then_sepa';
      amountFromBalance = currentBalance;
      amountToCharge = leadPrice - currentBalance;
    } else if (hasSEPAMandate) {
      // No balance but has SEPA - use SEPA only
      billingStrategy = 'sepa_only';
      amountFromBalance = 0;
      amountToCharge = leadPrice;
    } else {
      // No balance and no SEPA - error
      return res.status(400).json({
        success: false,
        error: "Onvoldoende saldo en geen SEPA incasso beschikbaar. Voeg eerst saldo toe of stel SEPA in."
      });
    }

    console.log(`💰 Billing strategy: ${billingStrategy}, Balance: €${currentBalance}, Lead: €${leadPrice}`);
    console.log(`💰 From balance: €${amountFromBalance}, To charge: €${amountToCharge}`);

    // Update user balance (deduct available balance)
    if (amountFromBalance > 0) {
      const newBalance = Math.max(0, currentBalance - amountFromBalance);
      
      const { error: balanceError } = await supabaseAdmin
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', user_id)

      if (balanceError) throw balanceError

      console.log(`💰 Deducted €${amountFromBalance} from user ${user_id} balance: ${currentBalance} -> ${newBalance}`);
    }

    // Lead toewijzen aan gebruiker
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({
        user_id: user_id,
        status: 'accepted', // Automatisch accepteren bij toewijzing
        price_at_purchase: leadPrice,
        accepted_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .select()
      .single()

    if (updateError) throw updateError

    // Send lead assigned notification
    try {
      const NotificationService = require('../services/notificationService');
      const notificationService = new NotificationService();
      
      // Get lead details for notification
      const { data: leadDetails } = await supabaseAdmin
        .from('leads')
        .select(`
          id,
          name,
          email,
          phone,
          industries:industry_id (name)
        `)
        .eq('id', leadId)
        .single();
      
      if (leadDetails) {
        await notificationService.sendLeadAssigned(user_id, {
          company_name: leadDetails.name || 'Onbekend bedrijf',
          contact_name: leadDetails.name || 'Onbekend',
          email: leadDetails.email || '',
          phone: leadDetails.phone || '',
          industry: leadDetails.industries?.name || 'Onbekend',
          lead_id: leadDetails.id
        });
      }
      
      // Check quota after assignment and send warnings if needed
      const { data: usage } = await supabaseAdmin
        .from('v_monthly_lead_usage')
        .select('effective_count')
        .eq('user_id', user_id)
        .maybeSingle();
      
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('leads_per_month')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (usage && subscription) {
        const leadsUsed = usage.effective_count || 0;
        const monthlyQuota = subscription.leads_per_month || 0;
        const leadsRemaining = Math.max(0, monthlyQuota - leadsUsed);
        const usagePercentage = monthlyQuota > 0 ? Math.round((leadsUsed / monthlyQuota) * 100) : 0;
        
        // Send quota reached notification if exactly at quota
        if (leadsUsed >= monthlyQuota && monthlyQuota > 0) {
          await notificationService.sendQuotaReached(user_id, {
            leads_used: leadsUsed,
            monthly_quota: monthlyQuota,
            quota_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
          });
        }
        // Send quota warning if >= 80% used
        else if (usagePercentage >= 80 && usagePercentage < 100) {
          await notificationService.sendQuotaWarning(user_id, {
            leads_used: leadsUsed,
            monthly_quota: monthlyQuota,
            leads_remaining: leadsRemaining,
            usage_percentage: usagePercentage,
            quota_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
          });
        }
      }
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
      // Don't throw error, assignment was successful
    }

    res.json({
      success: true,
      data: updatedLead,
      assigned_to: `${req.validatedUser.first_name} ${req.validatedUser.last_name}`,
      billing: {
        lead_price: leadPrice,
        previous_balance: currentBalance,
        amount_from_balance: amountFromBalance,
        amount_to_charge: amountToCharge,
        billing_strategy: billingStrategy,
        has_sepa_mandate: hasSEPAMandate
      }
    })
  } catch (err) {
    console.error("Error assigning lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het toewijzen van het lead" })
  }
})

// Update user lead limit
router.put("/user/lead-limit", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { lead_limit } = req.body

    // Valideer input
    if (typeof lead_limit !== 'number' || lead_limit < 0 || lead_limit > 100) {
      return res.status(400).json({ error: "Lead limiet moet een getal tussen 0 en 100 zijn" })
    }

    // Check if subscription already exists
    const { data: existingSubscription, error: checkError } = await supabase
      .from('subscriptions')
      .select('id, leads_per_month')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    let subscription;
    if (existingSubscription) {
      // Update existing subscription
      const { data, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          leads_per_month: lead_limit === 100 ? null : lead_limit,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)
        .select()
        .single()

      if (updateError) throw updateError
      subscription = data
    } else {
      // Create new subscription
      const { data, error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          leads_per_month: lead_limit === 100 ? null : lead_limit,
          status: 'active'
        })
        .select()
        .single()

      if (insertError) throw insertError
      subscription = data
    }

    // Trigger target recalculation for all segments this user is part of (async, don't block)
    // This ensures targets update immediately when capacity changes
    try {
      const LeadDemandPlannerService = require('../services/leadDemandPlannerService');
      const LeadSegmentService = require('../services/leadSegmentService');
      
      // Get all active segments this user is part of
      const segments = await LeadSegmentService.getAllActiveSegments();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Recalculate targets for all segments (async, fire and forget)
      // This ensures targets reflect the new capacity immediately
      Promise.all(
        segments.map(segment => 
          LeadDemandPlannerService.planSegment(segment.id, today).catch(err => {
            console.error(`Error recalculating target for segment ${segment.id} after lead limit change:`, err);
          })
        )
      ).catch(err => {
        console.error('Error in batch target recalculation:', err);
      });
    } catch (recalcError) {
      // Don't fail the request if recalculation fails
      console.error('Error triggering target recalculation:', recalcError);
    }

    res.json({
      success: true,
      data: subscription,
      message: `Lead limiet bijgewerkt naar ${lead_limit === 100 ? 'onbeperkt' : lead_limit + ' leads per maand'}`
    })
  } catch (err) {
    console.error("Error updating lead limit:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de lead limiet" })
  }
})

// Update user lead pause status
router.put("/user/lead-pause", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { is_paused, pause_reason, pause_other_reason, pause_expires_at } = req.body

    // Valideer input
    if (typeof is_paused !== 'boolean') {
      return res.status(400).json({ error: "Pauze status moet een boolean zijn" })
    }

    // Valideer pause reden als pausing
    if (is_paused && !pause_reason) {
      return res.status(400).json({ error: "Reden voor pauze is verplicht" })
    }

    // Update user profile metadata with pause information
    const pauseMetadata = {
      pause_reason: pause_reason || null,
      pause_other_reason: pause_other_reason || null,
      pause_expires_at: pause_expires_at || null,
      pause_requested_at: is_paused ? new Date().toISOString() : null,
      pause_requested_by: req.user.email
    }

    // Update user profile metadata
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        profile_metadata: pauseMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (profileError) throw profileError

    // Update existing subscription record
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        is_paused: is_paused,
        status: is_paused ? 'paused' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .in('status', ['active', 'paused'])
      .select()
      .single()

    if (subscriptionError) throw subscriptionError

    // Log the pause action
    const SystemLogService = require('../services/systemLogService')
    await SystemLogService.log({
      type: is_paused ? 'warning' : 'info',
      category: 'user_management',
      title: is_paused ? 'Aanvragen Gepauzeerd' : 'Aanvragen Geactiveerd',
      message: `Gebruiker heeft aanvragen ${is_paused ? 'gepauzeerd' : 'geactiveerd'}`,
      details: is_paused ? 
        `Reden: ${pause_reason}${pause_other_reason ? ` (${pause_other_reason})` : ''}. Verloopt op: ${pause_expires_at}` :
        'Aanvragen zijn weer actief',
      source: 'Pause System',
      userId: userId,
      metadata: {
        user_id: userId,
        user_email: req.user.email,
        pause_reason: pause_reason,
        pause_other_reason: pause_other_reason,
        pause_expires_at: pause_expires_at,
        action: is_paused ? 'pause' : 'resume',
        performed_by: req.user.email,
        performed_by_email: req.user.email,
        is_admin_action: false
      },
      severity: is_paused ? 'medium' : 'low'
    })

    // Stuur interne notificatie naar Sales wanneer pauze is ingeschakeld
    if (is_paused === true) {
      try {
        console.log('📧 Preparing to send pause notification email...')
        const EmailService = require('../services/emailService')
        const emailService = new EmailService()

        // Haal optioneel extra profielinfo op (bedrijf/naam)
        let companyName = ''
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name, first_name, last_name')
            .eq('id', userId)
            .maybeSingle()

          if (profile) {
            companyName = profile.company_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          }
        } catch (profileErr) {
          console.error('Error fetching profile for email:', profileErr)
        }

        const dashboardUrl = process.env.DASHBOARD_URL || (process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000') + '/dashboard'
        const reasonText = pause_reason || 'Onbekend'
        const otherText = pause_other_reason ? ` (${pause_other_reason})` : ''
        const expiresText = pause_expires_at ? new Date(pause_expires_at).toLocaleString('nl-NL') : 'Geen einddatum opgegeven'

        const html = `
          <html>
            <body style="font-family: Arial, sans-serif; color: #111827;">
              <h2 style="margin:0 0 8px 0;">Pauze ingeschakeld</h2>
              <p style="margin:0 0 16px 0;">Een gebruiker heeft aanvragen gepauzeerd. Neem contact op om te helpen weer te activeren.</p>
              <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
                <tbody>
                  <tr>
                    <td style="padding: 6px 0; width: 180px; color:#6B7280;">Gebruiker</td>
                    <td style="padding: 6px 0;">${req.user.email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color:#6B7280;">Bedrijf / Naam</td>
                    <td style="padding: 6px 0;">${companyName || 'Onbekend'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color:#6B7280;">Reden</td>
                    <td style="padding: 6px 0;">${reasonText}${otherText}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color:#6B7280;">Verloopt</td>
                    <td style="padding: 6px 0;">${expiresText}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color:#6B7280;">Datum/Tijd</td>
                    <td style="padding: 6px 0;">${new Date().toLocaleString('nl-NL')}</td>
                  </tr>
                </tbody>
              </table>
              <p style="margin: 16px 0;">
                <a href="${dashboardUrl}/leads" style="display:inline-block; padding:10px 14px; background:#ea5d0d; color:#fff; border-radius:8px; text-decoration:none;">Open dashboard</a>
              </p>
            </body>
          </html>`

        // Tijdelijk altijd naar info@growsocialmedia.nl sturen voor testen
        const recipientEmail = 'info@growsocialmedia.nl'
        const subject = `Pauze ingeschakeld door ${companyName || req.user.email}`

        console.log(`📧 Sending pause notification email to: ${recipientEmail}`)
        console.log(`   Subject: ${subject}`)
        console.log(`   User: ${req.user.email}`)
        console.log(`   Company: ${companyName || 'Onbekend'}`)
        console.log(`   Reason: ${reasonText}${otherText}`)

        const emailSent = await emailService.sendEmail({
          to: recipientEmail,
          subject: subject,
          html: html
        })

        if (emailSent) {
          console.log('✅ Pause notification email sent successfully to:', recipientEmail)
        } else {
          console.error('❌ Failed to send pause notification email to:', recipientEmail)
        }
      } catch (emailErr) {
        console.error('❌ Error sending pause notification email:', emailErr)
        console.error('   Error details:', emailErr.message)
        console.error('   Stack:', emailErr.stack)
        // Don't throw - we don't want email failures to break the API response
      }
    }

    res.json({
      success: true,
      data: subscription,
      message: `Aanvragen zijn ${is_paused ? 'gepauzeerd' : 'geactiveerd'}`
    })
  } catch (err) {
    console.error("Error updating lead pause status:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de pauze status" })
  }
})

// Get user lead settings
router.get("/user/lead-settings", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id

    // Haal subscription data op
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('leads_per_month, is_paused, status')
      .eq('user_id', userId)
      .in('status', ['active', 'paused'])
      .single()

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      throw subscriptionError
    }

    // Default waarden als er geen subscription is
    const leadLimit = subscription?.leads_per_month ?? 0
    const isPaused = subscription?.is_paused ?? false

    res.json({
      success: true,
      data: {
        lead_limit: leadLimit,
        is_paused: isPaused,
        status: subscription?.status ?? 'active'
      }
    })
  } catch (err) {
    console.error("Error getting lead settings:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de lead instellingen" })
  }
})

// Get all users (admin only)
router.get("/users", requireAuth, isAdmin, async (req, res) => {
  try {
    console.log("Fetching users for admin...")
    
    // Check if detailed info is requested
    const includeDetails = req.query.details === 'true';
    const includeQuota = req.query.includeQuota === 'true';
    
    if (includeDetails) {
      console.log("Fetching users with industry details...")
      
      // Haal alle gebruikers op
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, company_name, created_at')
        .order('first_name', { ascending: true })

      if (usersError) throw usersError

      // Haal industrie voorkeuren op voor alle gebruikers
      const { data: preferences, error: preferencesError } = await supabaseAdmin
        .from('user_industry_preferences')
        .select(`
          user_id,
          industry_id,
          is_enabled,
          industries!inner(
            id,
            name,
            price_per_lead
          )
        `)
        .eq('is_enabled', true)

      if (preferencesError) {
        console.error('Error fetching preferences:', preferencesError)
      }

      // Groepeer voorkeuren per gebruiker
      const preferencesByUser = {}
      if (preferences) {
        preferences.forEach(pref => {
          if (!preferencesByUser[pref.user_id]) {
            preferencesByUser[pref.user_id] = []
          }
          preferencesByUser[pref.user_id].push({
            id: pref.industries.id,
            name: pref.industries.name,
            price_per_lead: pref.industries.price_per_lead
          })
        })
      }

      // Haal lead counts en quota op voor elke gebruiker
      const usersWithDetails = await Promise.all(users.map(async (user) => {
        // Haal lead count op voor deze maand
        const { data: leadCount, error: leadCountError } = await supabaseAdmin
          .from('leads')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
          .lt('created_at', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString())

        if (leadCountError) {
          console.error(`Error fetching lead count for user ${user.id}:`, leadCountError)
        }

        // Haal quota op uit subscriptions
        const { data: subscription, error: subscriptionError } = await supabaseAdmin
          .from('subscriptions')
          .select('leads_per_month')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)

        if (subscriptionError) {
          console.error(`Error fetching subscription for user ${user.id}:`, subscriptionError)
        }

        return {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          company_name: user.company_name,
          created_at: user.created_at,
          industries: preferencesByUser[user.id] || [],
          leads_this_month: leadCount?.length || 0,
          leads_quota: subscription?.[0]?.leads_per_month || 0
        }
      }))

      // Filter alleen gebruikers met industrie voorkeuren
      const usersWithIndustries = usersWithDetails.filter(user => user.industries.length > 0)

      console.log(`Fetched ${usersWithIndustries.length} users with industry details`)

      res.json(usersWithIndustries)
    } else if (includeQuota) {
      // Fetch users with quota information
      console.log("Fetching users with quota information...")
      
      // Haal alle gebruikers op
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, company_name, created_at')
        .order('first_name', { ascending: true })

      if (usersError) throw usersError

      // Haal quota informatie op voor elke gebruiker
      const usersWithQuota = await Promise.all(users.map(async (user) => {
        // Haal subscriptions op (active/paused) - zelfde logica als validateAssignment
        const { data: subscriptions, error: subError } = await supabaseAdmin
          .from('subscriptions')
          .select('leads_per_month, status, is_paused')
          .eq('user_id', user.id);

        if (subError) console.error(`Subs error for ${user.id}`, subError);

        const relevantSubs = (subscriptions || []).filter(s => ['active', 'paused'].includes(s.status));
        const totalQuota = relevantSubs.reduce((sum, s) => sum + (s.leads_per_month || 0), 0);
        const isPaused = relevantSubs.some(s => s.is_paused === true || s.status === 'paused');

        // Haal leads van deze maand op via v_monthly_lead_usage view (same source as quota endpoint)
        const { data: monthlyUsage, error: usageError } = await supabaseAdmin
          .from('v_monthly_lead_usage')
          .select('approved_count, effective_count, approved_amount')
          .eq('user_id', user.id)
          .maybeSingle();

        if (usageError) console.error(`Usage error for ${user.id}`, usageError);

        const usedAccepted = monthlyUsage?.approved_count || 0;
        const usedEffective = monthlyUsage?.effective_count || 0;
        const remaining = totalQuota - usedEffective; // Allow negative values to show over-limit
        const canReceiveLeads = totalQuota > 0 && remaining > 0 && !isPaused;

        console.log('[users:quota]', { 
          userId: user.id, 
          total: totalQuota, 
          usedAccepted, 
          usedEffective, 
          remaining, 
          canReceiveLeads, 
          isPaused 
        });

        // Haal industry preferences op
        const { data: preferences, error: preferencesError } = await supabaseAdmin
          .from('user_industry_preferences')
          .select(`
            industry_id,
            is_enabled,
            industries!inner(
              id,
              name,
              is_active
            )
          `)
          .eq('user_id', user.id)
          .eq('is_enabled', true)

        if (preferencesError) {
          console.error(`Error fetching preferences for user ${user.id}:`, preferencesError)
        }

        // Remove duplicate lines - already defined above

        // Format industries
        const industries = preferences ? preferences.map(pref => ({
          id: pref.industries.id,
          name: pref.industries.name
        })) : []

        return {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          company_name: user.company_name,
          created_at: user.created_at,
          isPaused,
          quota: {
            total: totalQuota,
            usedAccepted,
            used: usedEffective,     // 👈 UI gebruikt deze
            remaining,
            canReceiveLeads
          },
          industries: industries
        }
      }))

      // Return alle gebruikers (niet filteren)
      console.log(`Found ${usersWithQuota.length} users with quota information`)

      // Prevent caching
      res.set('Cache-Control', 'no-store');
      res.json(usersWithQuota)
    } else {
      // Regular users endpoint
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, company_name, created_at')
        .order('first_name', { ascending: true })

      console.log("Users query result:", { users, error: usersError })

      if (usersError) throw usersError

      res.json(users)
    }
  } catch (err) {
    console.error("Error fetching users:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruikers" })
  }
})


// Get single user by ID (admin only)
router.get("/users/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (userError) throw userError

    res.json(user)
  } catch (err) {
    console.error("Error fetching user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruiker" })
  }
})

// Delete user by ID (admin only)
router.delete("/users/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    
    console.log(`🗑️ API: Deleting user: ${userId}`);

    // Check if user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error("❌ Error finding user:", userError);
      return res.status(404).json({ error: "Gebruiker niet gevonden" });
    }

    // Check for outstanding payments before deletion
    const { data: outstandingPayments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('id, amount, status')
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (paymentsError) {
      console.error("❌ Error checking outstanding payments:", paymentsError);
    }

    if (outstandingPayments && outstandingPayments.length > 0) {
      const totalOutstanding = outstandingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      console.log(`❌ Cannot delete user: User ${userId} has ${outstandingPayments.length} outstanding payments (€${totalOutstanding.toFixed(2)})`);
      return res.status(400).json({ 
        error: `Kan gebruiker niet verwijderen - er zijn openstaande betalingen (€${totalOutstanding.toFixed(2)})`,
        outstandingPayments: outstandingPayments.length,
        totalAmount: totalOutstanding
      });
    }

    // Check for pending SEPA mandates
    const { data: pendingMandates, error: mandatesError } = await supabaseAdmin
      .from('pending_mandates')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'pending_verification');

    if (mandatesError) {
      console.error("❌ Error checking pending mandates:", mandatesError);
    }

    if (pendingMandates && pendingMandates.length > 0) {
      console.log(`❌ Cannot delete user: User ${userId} has ${pendingMandates.length} pending SEPA mandates`);
      return res.status(400).json({ 
        error: `Kan gebruiker niet verwijderen - er zijn openstaande SEPA mandaten in behandeling`,
        pendingMandates: pendingMandates.length
      });
    }

    // Delete related records first to avoid foreign key constraints
    const tablesToClean = [
      { table: 'user_industry_preferences', column: 'user_id' },
      { table: 'lead_activities', column: 'user_id' },
      { table: 'payments', column: 'user_id' },
      { table: 'leads', column: 'user_id' },
      { table: 'invoices', column: 'user_id' },
      { table: 'payment_methods', column: 'user_id' },
      { table: 'settings', column: 'user_id' },
      { table: 'pdfs', column: 'user_id' }
    ];

    // Handle profile_completion_status - MUST be deleted before profiles due to NO ACTION constraint
    try {
      console.log(`🧹 API: Deleting from profile_completion_status for user: ${userId}`);
      
      const { error: completionError } = await supabaseAdmin
        .from('profile_completion_status')
        .delete()
        .eq('id', userId);
      
      if (completionError) {
        console.error(`❌ Error deleting from profile_completion_status:`, completionError);
        return res.status(400).json({ 
          error: "Kon profile completion status niet verwijderen", 
          details: completionError.message 
        });
      } else {
        console.log(`✅ Successfully deleted from profile_completion_status`);
      }
    } catch (err) {
      console.error(`❌ Exception deleting from profile_completion_status:`, err);
      return res.status(400).json({ 
        error: "Kon profile completion status niet verwijderen", 
        details: err.message 
      });
    }

    // Clean up other tables
    for (const { table, column } of tablesToClean) {
      try {
        const { error: deleteError } = await supabaseAdmin
          .from(table)
          .delete()
          .eq(column, userId);
        
        if (deleteError && !deleteError.message.includes('does not exist')) {
          console.warn(`⚠️ Warning deleting from ${table}:`, deleteError.message);
        }
      } catch (err) {
        console.warn(`⚠️ Warning deleting from ${table}:`, err.message);
      }
    }

    // Delete from profiles table (now that profile_completion_status is cleaned up)
    console.log(`🗑️ API: Deleting from profiles table for user: ${userId}`);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error("❌ Error deleting profile:", profileError);
      return res.status(400).json({ 
        error: "Kon gebruiker niet verwijderen", 
        details: profileError.message 
      });
    }

    // Finally delete from auth.users
    console.log(`🗑️ API: Deleting from auth.users for user: ${userId}`);
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("❌ Error deleting auth user:", authError);
      return res.status(400).json({ error: "Kon gebruiker niet verwijderen uit authenticatie systeem" });
    }

    console.log("✅ API: User deleted successfully:", user.email);
    res.json({ success: true, message: `Gebruiker ${user.email} succesvol verwijderd` });
  } catch (err) {
    console.error("❌ Error in API delete user:", err);
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de gebruiker" });
  }
})

// Bulk delete users (admin only)
router.post("/users/bulk/delete", requireAuth, isAdmin, async (req, res) => {
  try {
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Geen gebruikers geselecteerd" })
    }

    // Delete users from profiles table
    const { error: deleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .in('id', ids)

    if (deleteError) throw deleteError

    res.json({
      success: true,
      message: `${ids.length} gebruikers succesvol verwijderd`
    })
  } catch (err) {
    console.error("Error bulk deleting users:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de gebruikers" })
  }
})

router.delete("/leads/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const leadId = req.params.id

    // Controleer of lead bestaat
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError) throw leadError
    if (!lead) return res.status(404).json({ error: "Lead niet gevonden" })

    // Lead verwijderen
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)

    if (deleteError) throw deleteError

    res.json({ message: "Lead succesvol verwijderd" })
  } catch (err) {
    console.error("Error deleting lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van het lead" })
  }
})

// API routes voor betalingen

// Payment methods endpoints - MUST be before /payments/:id route
router.get('/payments/methods', requireAuth, async (req, res) => {
  try {
    console.log('🔍 API Request received for /payments/methods');
    console.log('🔍 User object:', req.user ? 'Present' : 'Missing');
    console.log('🔍 User ID:', req.user?.id || 'No user ID');
    console.log('🔍 Cookies:', Object.keys(req.cookies || {}));
    
    if (!req.user) {
      console.log('❌ No user found in request');
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const userId = req.user.id;
    console.log('🔍 Fetching payment methods for user:', userId);
    
    // Use admin client to bypass RLS for this query
    const { data: methods, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (error) {
      console.error('❌ Error fetching payment methods:', error);
      throw error;
    }

    console.log('✅ Payment methods fetched successfully:', methods?.length || 0, 'methods');
    console.log('🔍 Payment methods data:', JSON.stringify(methods, null, 2));
    
    res.json({
      success: true,
      paymentMethods: methods || []
    });
  } catch (error) {
    console.error('❌ Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het ophalen van je betaalmethoden'
    });
  }
});

router.get("/payments/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const paymentId = req.params.id
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (error) throw error
    if (!payment) return res.status(404).json({ error: "Betaling niet gevonden" })

    res.json(payment)
  } catch (err) {
    console.error("Error fetching payment:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de betaling" })
  }
})

router.post("/payments", requireAuth, isAdmin, async (req, res) => {
  try {
    const { userId, amount, description, status } = req.body

    // Valideer input
    if (!userId || !amount || !description) {
      return res.status(400).json({ error: "Gebruiker, bedrag en beschrijving zijn verplicht" })
    }

    // Controleer of gebruiker bestaat
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError) throw userError
    if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" })

    // Betaling toevoegen
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([
        {
          user_id: userId,
          amount,
          description,
          status: status || "completed",
          created_at: new Date().toISOString(),
        }
      ])
      .select()
      .single()

    if (paymentError) throw paymentError

    // Als betaling voltooid is, update gebruikerssaldo
    if (status === "completed") {
      await supabase
        .from('profiles')
        .update({ balance: user.balance + amount })
        .eq('id', userId)
    }

    res.status(201).json(payment)
  } catch (err) {
    console.error("Error creating payment:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het aanmaken van de betaling" })
  }
})

router.put("/payments/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const paymentId = req.params.id
    const { userId, amount, description, status } = req.body

    // Valideer input
    if (!userId || !amount || !description) {
      return res.status(400).json({ error: "Gebruiker, bedrag en beschrijving zijn verplicht" })
    }

    // Controleer of betaling bestaat
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (paymentError) throw paymentError
    if (!payment) return res.status(404).json({ error: "Betaling niet gevonden" })

    // Betaling bijwerken
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        user_id: userId,
        amount,
        description,
        status,
      })
      .eq('id', paymentId)
      .select()
      .single()

    if (updateError) throw updateError

    // Als status is gewijzigd, update gebruikerssaldo
    if (payment.status !== status) {
      if (payment.status !== "completed" && status === "completed") {
        await supabase
          .from('profiles')
          .update({ balance: user.balance + amount })
          .eq('id', userId)
      } else if (payment.status === "completed" && status !== "completed") {
        await supabase
          .from('profiles')
          .update({ balance: user.balance - amount })
          .eq('id', userId)
      }
    }

    res.json(updatedPayment)
  } catch (err) {
    console.error("Error updating payment:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de betaling" })
  }
})

router.delete("/payments/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const paymentId = req.params.id

    // Controleer of betaling bestaat
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (paymentError) throw paymentError
    if (!payment) return res.status(404).json({ error: "Betaling niet gevonden" })

    // Als betaling voltooid was, pas gebruikerssaldo aan
    if (payment.status === "completed") {
      await supabase
        .from('profiles')
        .update({ balance: user.balance - payment.amount })
        .eq('id', payment.user_id)
    }

    // Betaling verwijderen
    const { error: deleteError } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId)

    if (deleteError) throw deleteError

    res.json({ message: "Betaling succesvol verwijderd" })
  } catch (err) {
    console.error("Error deleting payment:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de betaling" })
  }
})

// Add the bulk actions API endpoints
// Add this code at the end of the file, just before module.exports = router

// Bulk actions API endpoints
router.post("/profiles/bulk/status", requireAuth, isAdmin, async (req, res) => {
  try {
    const { status, ids } = req.body

    if (!status || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Status en gebruiker IDs zijn verplicht" })
    }

    // Valideer status
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Ongeldige status" })
    }

    // Update alle gebruikers
    const placeholders = ids.map(() => "?").join(",")
    await supabase
      .from('profiles')
      .update({ status })
      .eq('id', supabase.from('profiles').select('id').in('id', ids))

    res.json({
      success: true,
      message: `${ids.length} gebruiker(s) succesvol ${status === "active" ? "geactiveerd" : "gedeactiveerd"}`,
    })
  } catch (err) {
    console.error("Error updating profiles:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de status" })
  }
})

// Helper function to handle bulk delete operations
async function handleBulkDelete(tableName, ids, req, res, options = {}) {
  try {
    console.log(`Starting bulk delete for ${tableName} with IDs:`, ids);
    console.log('Options:', options);

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      console.log('Invalid input: ids is required and must be a non-empty array');
      return res.status(400).json({ 
        success: false,
        error: `${options.entityName || 'Items'} IDs zijn verplicht` 
      });
    }

    // Check if all items exist
    console.log(`Checking if all ${tableName} exist...`);
    const { data: existingItems, error: checkError } = await supabase
      .from(tableName)
      .select('id')
      .in('id', ids);

    if (checkError) {
      console.error(`Error checking ${tableName}:`, checkError);
      return res.status(500).json({
        success: false,
        error: `Er is een fout opgetreden bij het controleren van de ${options.entityName || 'items'}`
      });
    }

    console.log(`Found ${existingItems?.length || 0} existing items`);

    if (!existingItems || existingItems.length !== ids.length) {
      console.log('Not all items found:', {
        requested: ids.length,
        found: existingItems?.length || 0
      });
      return res.status(404).json({
        success: false,
        error: `Een of meer ${options.entityName || 'items'} niet gevonden`
      });
    }

    // If cascade delete is required, handle related records first
    if (options.cascade) {
      console.log('Performing cascade delete...');
      for (const id of ids) {
        // Delete related records based on the table
        if (tableName === 'profiles') {
          // Delete user's leads and payments
          console.log(`Deleting related records for user ${id}...`);
          await supabase.from('leads').delete().eq('user_id', id);
          await supabase.from('payments').delete().eq('user_id', id);
        } else if (tableName === 'leads') {
          // Delete lead's activities
          console.log(`Deleting related records for lead ${id}...`);
          await supabase.from('lead_activities').delete().eq('lead_id', id);
        }
      }
    } else if (options.checkRelations) {
      // Check for related records if cascade is not enabled
      console.log('Checking for related records...');
      const hasRelatedRecords = [];
      
      for (const id of ids) {
        let hasRelations = false;
        
        if (tableName === 'profiles') {
          const { data: leads } = await supabase.from('leads').select('id').eq('user_id', id);
          const { data: payments } = await supabase.from('payments').select('id').eq('user_id', id);
          
          if (leads?.length > 0 || payments?.length > 0) {
            hasRelations = true;
          }
        } else if (tableName === 'leads') {
          const { data: activities } = await supabase.from('lead_activities').select('id').eq('lead_id', id);
          
          if (activities?.length > 0) {
            hasRelations = true;
          }
        }
        
        if (hasRelations) {
          hasRelatedRecords.push(id);
        }
      }
      
      if (hasRelatedRecords.length > 0) {
        console.log('Found items with relations:', hasRelatedRecords);
        return res.status(400).json({
          success: false,
          error: `Sommige ${options.entityName || 'items'} hebben nog gerelateerde gegevens. Gebruik cascade=true om alles te verwijderen.`,
          itemsWithRelations: hasRelatedRecords
        });
      }
    }

    // Delete the items
    console.log(`Deleting ${ids.length} items from ${tableName}...`);
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error(`Error deleting ${tableName}:`, deleteError);
      return res.status(500).json({
        success: false,
        error: `Er is een fout opgetreden bij het verwijderen van de ${options.entityName || 'items'}`
      });
    }

    console.log(`Successfully deleted ${ids.length} items from ${tableName}`);
    return res.json({
      success: true,
      message: `${ids.length} ${options.entityName || 'item(s)'} succesvol verwijderd`,
      data: { deletedIds: ids }
    });
  } catch (err) {
    console.error(`Error bulk deleting ${tableName}:`, err);
    return res.status(500).json({ 
      success: false,
      error: `Er is een fout opgetreden bij het verwijderen van de ${options.entityName || 'items'}` 
    });
  }
}

// Bootstrap endpoint for admin - returns all common data in one request
router.get("/admin/bootstrap", requireAuth, isAdmin, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Fetch all data in parallel
    const [
      permissionsResult,
      usersResult,
      industriesResult,
      aiRouterSettingsResult
    ] = await Promise.all([
      // Permissions
      Promise.resolve().then(() => {
        const isAdmin = req.user.user_metadata?.is_admin === true;
        return {
          success: true,
          permissions: isAdmin ? [
            'leads.create', 'leads.read', 'leads.update', 'leads.delete', 'leads.bulk_delete',
            'users.create', 'users.read', 'users.update', 'users.delete',
            'admin.access', 'admin.settings'
          ] : [
            'leads.read', 'leads.create'
          ],
          is_admin: isAdmin,
          user_id: req.user.id
        };
      }),
      // Users list (basic, without quota for speed)
      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, company_name, is_admin, created_at, employee_status')
        .order('first_name', { ascending: true })
        .then(({ data, error }) => {
          if (error) throw error;
          return { success: true, users: data || [] };
        })
        .catch(err => {
          console.error('Error fetching users in bootstrap:', err);
          return { success: false, users: [], error: err.message };
        }),
      // Industries
      supabaseAdmin
        .from('industries')
        .select('id, name, description, price_per_lead, is_active')
        .eq('is_active', true)
        .order('name')
        .then(({ data, error }) => {
          if (error) throw error;
          return { success: true, data: data || [] };
        })
        .catch(err => {
          console.error('Error fetching industries in bootstrap:', err);
          return { success: false, data: [], error: err.message };
        }),
      // AI Router Settings
      supabaseAdmin
        .from('ai_router_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['region_weight', 'performance_weight', 'fairness_weight', 'auto_assign_enabled', 'auto_assign_threshold'])
        .then(({ data, error }) => {
          if (error) throw error;
          const settingsMap = {};
          if (data) {
            data.forEach(s => {
              settingsMap[s.setting_key] = s.setting_value;
            });
          }
          return {
            success: true,
            data: {
              regionWeight: parseInt(settingsMap.region_weight || '50', 10),
              performanceWeight: parseInt(settingsMap.performance_weight || '50', 10),
              fairnessWeight: parseInt(settingsMap.fairness_weight || '50', 10),
              autoAssign: settingsMap.auto_assign_enabled !== 'false',
              autoAssignThreshold: parseInt(settingsMap.auto_assign_threshold || '70', 10)
            }
          };
        })
        .catch(err => {
          console.error('Error fetching AI router settings in bootstrap:', err);
          return {
            success: false,
            data: {
              regionWeight: 50,
              performanceWeight: 50,
              fairnessWeight: 50,
              autoAssign: false,
              autoAssignThreshold: 70
            },
            error: err.message
          };
        })
    ]);

    const loadTime = Date.now() - startTime;
    console.log(`✅ /admin/bootstrap loaded in ${loadTime}ms`);

    res.json({
      success: true,
      permissions: permissionsResult,
      users: usersResult.success ? usersResult.users : [],
      industries: industriesResult.success ? industriesResult.data : [],
      aiRouterSettings: aiRouterSettingsResult.success ? aiRouterSettingsResult.data : {
        regionWeight: 50,
        performanceWeight: 50,
        fairnessWeight: 50,
        autoAssign: false,
        autoAssignThreshold: 70
      },
      loadTime: loadTime
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het ophalen van bootstrap data'
    });
  }
});

// Get user permissions (simplified version using is_admin)
router.get("/permissions", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.user_metadata?.is_admin === true;
    
    // Return basic permissions based on admin status
    const permissions = isAdmin ? [
      'leads.create', 'leads.read', 'leads.update', 'leads.delete', 'leads.bulk_delete',
      'users.create', 'users.read', 'users.update', 'users.delete',
      'admin.access', 'admin.settings'
    ] : [
      'leads.read', 'leads.create'
    ];

    res.json({
      success: true,
      permissions: permissions,
      is_admin: isAdmin,
      user_id: req.user.id
    });
  } catch (err) {
    console.error('Get permissions error:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het ophalen van rechten'
    });
  }
});

// Bulk delete leads
router.post("/leads/bulk/delete", requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('=== BULK DELETE LEADS REQUEST START ===');
    console.log('Request body:', req.body);
    console.log('User session:', req.session);
    
    const { ids } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.user_metadata?.is_admin === true;
    
    console.log('Lead IDs to delete:', ids);
    console.log('User ID:', userId);
    console.log('Is Admin:', isAdmin);
    console.log('Admin value:', req.user.user_metadata?.is_admin);
    console.log('Admin type:', typeof req.user.user_metadata?.is_admin);

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      console.log('Invalid input: ids is required and must be a non-empty array');
      return res.status(400).json({ 
        success: false,
        error: "Lead IDs zijn verplicht" 
      });
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = ids.filter(id => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      console.log('Invalid UUIDs found:', invalidIds);
      return res.status(400).json({
        success: false,
        error: "Ongeldige lead IDs gevonden"
      });
    }

    // Check if all leads exist and get their details
    console.log('Checking if all leads exist...');
    const { data: existingLeads, error: checkError } = await supabase
      .from('leads')
      .select('*')
      .in('id', ids);

    if (checkError) {
      console.error('Error checking leads:', checkError);
      console.error('Error details:', JSON.stringify(checkError, null, 2));
      return res.status(500).json({
        success: false,
        error: "Er is een fout opgetreden bij het controleren van de leads"
      });
    }

    console.log(`Found ${existingLeads?.length || 0} existing leads:`, existingLeads);

    if (!existingLeads || existingLeads.length !== ids.length) {
      console.log('Not all leads found:', {
        requested: ids.length,
        found: existingLeads?.length || 0,
        requestedIds: ids,
        foundIds: existingLeads?.map(lead => lead.id) || []
      });
      return res.status(404).json({
        success: false,
        error: "Een of meer leads niet gevonden"
      });
    }

    // Check if user has access to all leads
    if (!isAdmin) {
      const unauthorizedLeads = existingLeads.filter(lead => lead.user_id !== userId);
      if (unauthorizedLeads.length > 0) {
        console.log('Unauthorized leads found:', unauthorizedLeads);
        return res.status(403).json({
          success: false,
          error: "Geen toegang tot een of meer leads",
          unauthorizedLeads: unauthorizedLeads.map(lead => lead.id)
        });
      }
    }

    // Check if any leads are already assigned (accepted/approved) - these cannot be deleted
    const assignedLeads = existingLeads.filter(lead => 
      lead.status === 'accepted' || lead.status === 'approved'
    );
    
    if (assignedLeads.length > 0) {
      console.log('Assigned leads found that cannot be deleted:', assignedLeads);
      return res.status(400).json({
        success: false,
        error: "Toegewezen leads kunnen niet worden verwijderd",
        assignedLeads: assignedLeads.map(lead => ({
          id: lead.id,
          name: lead.name,
          status: lead.status,
          assigned_to: lead.user_id
        })),
        canDelete: existingLeads.filter(lead => 
          lead.status !== 'accepted' && lead.status !== 'approved'
        ).map(lead => ({
          id: lead.id,
          name: lead.name,
          status: lead.status
        }))
      });
    }

    // First, log the deletion in lead_activities
    console.log('Logging deletion activities...');
    const activities = existingLeads.map(lead => ({
      lead_id: lead.id,
      type: 'deleted',
      description: `Lead verwijderd door ${isAdmin ? 'admin' : 'gebruiker'}`,
      created_by: userId,
      created_at: new Date().toISOString()
    }));

    const { error: activityError } = await supabase
      .from('lead_activities')
      .insert(activities);

    if (activityError) {
      console.error('Error logging activities:', activityError);
      return res.status(500).json({
        success: false,
        error: "Er is een fout opgetreden bij het loggen van de activiteiten"
      });
    }

    // Then delete the leads
    console.log('Deleting leads...');
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('Error deleting leads:', deleteError);
      return res.status(500).json({
        success: false,
        error: "Er is een fout opgetreden bij het verwijderen van de leads"
      });
    }

    console.log(`Successfully deleted ${existingLeads.length} leads`);
    console.log('=== BULK DELETE LEADS REQUEST END ===');
    
    return res.json({
      success: true,
      message: `${existingLeads.length} lead(s) succesvol verwijderd`,
      data: { 
        deletedIds: existingLeads.map(lead => lead.id),
        deletedLeads: existingLeads,
        totalDeleted: existingLeads.length
      }
    });
  } catch (err) {
    console.error('Error bulk deleting leads:', err);
    console.error('Error stack:', err.stack);
    console.error('Error details:', JSON.stringify(err, null, 2));
    console.log('=== BULK DELETE LEADS REQUEST FAILED ===');
    
    return res.status(500).json({ 
      success: false,
      error: err.message || "Er is een fout opgetreden bij het verwijderen van de leads" 
    });
  }
});

// Bulk delete profiles
router.post("/profiles/bulk/delete", requireAuth, isAdmin, async (req, res) => {
  console.log('Bulk delete profiles request received:', req.body);
  return handleBulkDelete('profiles', req.body.ids, req, res, {
    entityName: 'gebruiker(s)',
    cascade: req.body.cascade === true,
    checkRelations: !req.body.cascade
  });
});

// Add admin API endpoints for individual user operations
router.get("/admin/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" })

    res.json(user)
  } catch (err) {
    console.error("Error fetching user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de gebruiker" })
  }
})

router.delete("/admin/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const cascade = req.query.cascade === "true" || (req.body && req.body.cascade === true)

    console.log(`Admin delete voor gebruiker ${userId}, cascade: ${cascade}`)

    // Begin een transactie
    await supabase.from('profiles').update({ status: 'inactive' }).eq('id', userId)

    // Als cascade=true, verwijder eerst alle gerelateerde records
    if (cascade) {
      // Verwijder gerelateerde records uit alle tabellen met foreign keys
      await supabase.from('payments').delete().eq('user_id', userId)
      await supabase.from('leads').delete().eq('user_id', userId)
    } else {
      // Controleer of er gerelateerde records zijn
      let hasRelatedRecords = false

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)

      if (paymentsError) throw paymentsError
      if (payments.length > 0) hasRelatedRecords = true

      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)

      if (leadsError) throw leadsError
      if (leads.length > 0) hasRelatedRecords = true

      if (hasRelatedRecords) {
        // Rollback de transactie
        await supabase.from('profiles').update({ status: 'active' }).eq('id', userId)
        return res.status(400).json({
          error: "Gebruiker heeft nog gerelateerde gegevens. Gebruik cascade=true om alles te verwijderen.",
          hasRelatedRecords: true,
        })
      }
    }

    res.json({ message: "Gebruiker succesvol verwijderd" })
  } catch (err) {
    console.error("Error deleting user:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen van de gebruiker" })
  }
})

router.put('/profiles/:id/status', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;

    if (status === undefined) {
      throw new Error('Status field is required');
    }

    const result = await userRepository.updateUserStatus(userId, status);
    res.json({
      success: true,
      message: 'User status updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update user status'
    });
  }
});

// Bulk actions for leads
router.post("/leads/bulk/status", requireAuth, isAdmin, async (req, res) => {
  try {
    const { status, ids } = req.body;

    if (!status || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "Status en lead IDs zijn verplicht" 
      });
    }

    // Valideer status
    if (!["new", "accepted", "rejected", "in_progress"].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: "Ongeldige status" 
      });
    }

    // Check if any of the leads are already accepted (prevent status changes)
    const { data: existingLeads, error: checkError } = await supabase
      .from('leads')
      .select('id, status')
      .in('id', ids);

    if (checkError) throw checkError;

    const acceptedLeads = existingLeads.filter(lead => lead.status === 'accepted');
    if (acceptedLeads.length > 0 && status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: `Geaccepteerde leads kunnen niet meer worden gewijzigd. ${acceptedLeads.length} van de geselecteerde leads zijn al geaccepteerd.`
      });
    }

    // Update alle leads
    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .in('id', ids);

    if (error) {
      console.error("Supabase error updating leads:", error);
      throw error;
    }

    // Log activiteiten voor elke lead
    const activities = ids.map(leadId => ({
      lead_id: leadId,
      type: 'status_changed',
      description: `Status gewijzigd naar ${getStatusLabel(status)}`,
      created_by: req.user.id
    }));

    const { error: activityError } = await supabase
      .from('lead_activities')
      .insert(activities);

    if (activityError) {
      console.error("Error logging activities:", activityError);
      // Don't throw error here, as the leads were updated successfully
    }

    // Update lead_usage table and handle billing if status is 'accepted'
    if (status === 'accepted') {
      try {
        // Get the leads that were just accepted to update their usage and handle billing
        const { data: acceptedLeads, error: fetchError } = await supabase
          .from('leads')
          .select('id, user_id, assigned_to, created_at, price_at_purchase, industry_id')
          .in('id', ids);

        if (fetchError) {
          console.error("Error fetching accepted leads for usage update:", fetchError);
        } else {
          // Group leads by user for efficient billing
          const userLeads = {};
          for (const lead of acceptedLeads) {
            const userId = lead.assigned_to || lead.user_id;
            if (!userId) continue;
            
            if (!userLeads[userId]) {
              userLeads[userId] = [];
            }
            userLeads[userId].push(lead);
          }

          // Process billing for each user
          for (const [userId, userLeadList] of Object.entries(userLeads)) {
            try {
              // Get user profile and payment methods
              const { data: userProfile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('balance, payment_method')
                .eq('id', userId)
                .single();

              if (profileError) {
                console.error(`Error fetching user profile for ${userId}:`, profileError);
                continue;
              }

              // Check if user has SEPA mandate
              const { data: paymentMethods, error: paymentMethodError } = await supabaseAdmin
                .from('payment_methods')
                .select('type, provider_payment_method_id')
                .eq('user_id', userId)
                .eq('type', 'sepa')
                .eq('provider', 'mollie')
                .single();

              const hasSEPAMandate = !paymentMethodError && paymentMethods;
              const currentBalance = userProfile.balance || 0;

              // Calculate total amount for all leads
              let totalLeadPrice = 0;
              for (const lead of userLeadList) {
                let leadPrice = lead.price_at_purchase || 10.00;
                if (!lead.price_at_purchase && lead.industry_id) {
                  const { data: industry, error: industryError } = await supabaseAdmin
                    .from('industries')
                    .select('price_per_lead')
                    .eq('id', lead.industry_id)
                    .single();
                    
                  if (!industryError && industry) {
                    leadPrice = industry.price_per_lead;
                  }
                }
                totalLeadPrice += leadPrice;
              }

              // Determine billing strategy
              let billingStrategy = 'balance_only';
              let amountToCharge = 0;
              let amountFromBalance = 0;

              if (currentBalance >= totalLeadPrice) {
                billingStrategy = 'balance_only';
                amountFromBalance = totalLeadPrice;
                amountToCharge = 0;
              } else if (currentBalance > 0 && hasSEPAMandate) {
                billingStrategy = 'balance_then_sepa';
                amountFromBalance = currentBalance;
                amountToCharge = totalLeadPrice - currentBalance;
              } else if (hasSEPAMandate) {
                billingStrategy = 'sepa_only';
                amountFromBalance = 0;
                amountToCharge = totalLeadPrice;
              } else {
                console.error(`User ${userId} has insufficient balance (€${currentBalance}) and no SEPA mandate for €${totalLeadPrice} in leads`);
                continue;
              }

              console.log(`💰 Bulk billing for user ${userId}: ${billingStrategy}, Balance: €${currentBalance}, Total: €${totalLeadPrice}`);
              console.log(`💰 From balance: €${amountFromBalance}, To charge: €${amountToCharge}`);

              // Update user balance (deduct available balance)
              if (amountFromBalance > 0) {
                const newBalance = Math.max(0, currentBalance - amountFromBalance);
                
                const { error: balanceError } = await supabaseAdmin
                  .from('profiles')
                  .update({ balance: newBalance })
                  .eq('id', userId)

                if (balanceError) {
                  console.error(`Error updating balance for user ${userId}:`, balanceError);
                  continue;
                }

                console.log(`💰 Deducted €${amountFromBalance} from user ${userId} balance: ${currentBalance} -> ${newBalance}`);
              }

              // Create payment record
              const paymentStatus = amountToCharge > 0 ? 'pending' : 'paid';
              const paymentDescription = amountToCharge > 0 
                ? `Bulk betaling voor ${userLeadList.length} leads - €${amountFromBalance} van saldo, €${amountToCharge} via SEPA`
                : `Bulk betaling voor ${userLeadList.length} leads - €${amountFromBalance} van saldo`;

              const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert([
                  {
                    user_id: userId,
                    amount: totalLeadPrice,
                    description: paymentDescription,
                    status: paymentStatus,
                    payment_details: {
                      payment_type: billingStrategy,
                      lead_ids: userLeadList.map(l => l.id),
                      previous_balance: currentBalance,
                      amount_from_balance: amountFromBalance,
                      amount_to_charge: amountToCharge,
                      billing_strategy: billingStrategy,
                      has_sepa_mandate: hasSEPAMandate,
                      leads_count: userLeadList.length
                    },
                    created_at: new Date().toISOString()
                  }
                ])
                .select()
                .single()

              if (paymentError) {
                console.error(`Error creating payment for user ${userId}:`, paymentError);
                continue;
              }

              // Update lead_usage for this user
              const month = new Date().toISOString().slice(0, 7) + '-01';
              
              const { data: currentUsage, error: usageError } = await supabase
                .from('lead_usage')
                .select('leads_count, total_amount')
                .eq('user_id', userId)
                .eq('period_month', month)
                .single();

              if (usageError && usageError.code !== 'PGRST116') {
                console.error("Error fetching current usage:", usageError);
                continue;
              }

              const currentCount = currentUsage?.leads_count || 0;
              const currentAmount = currentUsage?.total_amount || 0;

              // Upsert the updated usage
              const { error: upsertError } = await supabase
                .from('lead_usage')
                .upsert({
                  user_id: userId,
                  period_month: month,
                  leads_count: currentCount + userLeadList.length,
                  total_amount: currentAmount + totalLeadPrice
                }, {
                  onConflict: 'user_id,period_month'
                });

              if (upsertError) {
                console.error("Error upserting usage for user", userId, ":", upsertError);
              } else {
                console.log(`✅ Updated lead usage for user ${userId} in ${month}`);
              }

            } catch (userError) {
              console.error(`Error processing billing for user ${userId}:`, userError);
              // Continue with other users
            }
          }
        }
      } catch (usageUpdateError) {
        console.error("Error updating lead usage and billing:", usageUpdateError);
        // Don't throw error here, as the leads were updated successfully
      }
    }

    res.json({
      success: true,
      message: `${ids.length} lead(s) succesvol bijgewerkt naar ${status}`,
      data: data
    });
  } catch (err) {
    console.error("Error updating leads:", err);
    res.status(500).json({ 
      success: false,
      error: "Er is een fout opgetreden bij het bijwerken van de status" 
    });
  }
});

// Get all leads - OPTIMIZED VERSION (no N+1 queries)
router.get("/", requireAuth, requirePermission('leads.read'), async (req, res) => {
  try {
    // Laat eventueel ?fields=... toe, anders alles
    // Validate fields parameter to prevent SQL injection
    let fields = req.query.fields || '*'
    if (fields !== '*' && typeof fields === 'string') {
      // Only allow alphanumeric, commas, spaces, and underscores
      if (!/^[a-zA-Z0-9_,\s]+$/.test(fields)) {
        fields = '*'
      }
    }
    
    // Use supabaseAdmin to bypass RLS and get ALL leads (admin-only endpoint)
    // This ensures admins can see all leads regardless of RLS policies
    const result = await supabaseAdmin
      .from('leads')
      .select(fields)
      .order('created_at', { ascending: false })
    
    if (result.error) throw result.error
    let leads = result.data || []
    
    // Efficiently fetch user data for all leads in one query (not N+1)
    const userIds = [...new Set(leads.filter(l => l.user_id).map(l => l.user_id))]
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, company_name')
        .in('id', userIds)
      
      if (!usersError && users) {
        const userMap = new Map(users.map(u => [u.id, u]))
        
        leads = leads.map(lead => ({
          ...lead,
          assigned_user: lead.user_id ? userMap.get(lead.user_id) : null
        }))
      }
    } else {
      // No user_ids, just add null assigned_user
      leads = leads.map(lead => ({
        ...lead,
        assigned_user: null
      }))
    }

    // Efficiently fetch industry data for all leads in one query (not N+1)
    const industryIds = [...new Set(leads.filter(l => l.industry_id).map(l => l.industry_id))]
    if (industryIds.length > 0) {
      const { data: industries, error: industriesError } = await supabaseAdmin
        .from('industries')
        .select('id, name')
        .in('id', industryIds)
      
      if (!industriesError && industries) {
        const industryMap = new Map(industries.map(i => [i.id, i]))
        
        leads = leads.map(lead => ({
          ...lead,
          industry: lead.industry_id ? industryMap.get(lead.industry_id) : null
        }))
      }
    } else {
      // No industry_ids, just add null industry
      leads = leads.map(lead => ({
        ...lead,
        industry: null
      }))
    }

    // Transform leads to maintain backward compatibility
    const transformedLeads = leads.map(lead => ({
      ...lead,
      assigned_user: lead.assigned_user || null,
      industry: lead.industry || null,
      // Keep the original assigned_to UUID, don't overwrite it
      assigned_to: lead.assigned_to || (lead.assigned_user ? lead.assigned_user.id : null)
    }));

    res.json(transformedLeads)
  } catch (err) {
    console.error("Error fetching leads:", err)
    res.status(500).json({ 
      success: false,
      error: "Er is een fout opgetreden bij het ophalen van de leads",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
})

// Get lead activities
router.get("/leads/:id/activities", requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id;

    // Haal activiteiten op voor deze lead
    const { data: activities, error } = await supabase
      .from('lead_activities')
      .select(`
        *,
        created_by_user:created_by (
          first_name,
          last_name
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform the data to include user names
    const transformedActivities = activities.map(activity => ({
      ...activity,
      created_by_name: activity.created_by_user ? 
        `${activity.created_by_user.first_name} ${activity.created_by_user.last_name}` : 
        'Systeem'
    }));

    res.json({
      success: true,
      activities: transformedActivities
    });
  } catch (err) {
    console.error("Error fetching lead activities:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het ophalen van de activiteiten" 
    });
  }
});

// Log lead activity
router.post("/leads/:id/activities", requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id;
    const { type, description } = req.body;
    const userId = req.user.id;

    // Valideer input
    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: "Type en beschrijving zijn verplicht"
      });
    }

    // Log de activiteit
    const { data: activity, error } = await supabase
      .from('lead_activities')
      .insert([
        {
          lead_id: leadId,
          type,
          description,
          created_by: userId
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      activity
    });
  } catch (err) {
    console.error("Error logging lead activity:", err);
    res.status(500).json({
      success: false,
      error: "Er is een fout opgetreden bij het loggen van de activiteit"
    });
  }
});

// Helper function to get status label
function getStatusLabel(status) {
  switch(status) {
    case 'new':
      return 'Nieuw';
    case 'accepted':
      return 'Geaccepteerd';
    case 'rejected':
      return 'Afgewezen';
    case 'in_progress':
      return 'In behandeling';
    default:
      return status;
  }
}

// Profile API routes
router.get("/profile/check", requireAuth, async (req, res) => {
  try {
    console.log('Profile check - Full session:', req.session);
    console.log('Profile check - Session user:', req.user);
    console.log('Profile check - User ID:', req.user?.id);
    
    const userId = req.user.id;
    
    // Get profile completion status
    console.log('Profile check - Querying profile_completion_status for user:', userId);
    const { data: completionStatus, error } = await supabase
      .from('profile_completion_status')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    console.log('Profile check - Query result:', { completionStatus, error });

    if (error) {
      console.error('Error fetching profile completion status:', error);
      throw error;
    }

    res.json({
      success: true,
      hasProfile: !!completionStatus,
      isComplete: completionStatus?.is_complete || false,
      completionStatus: completionStatus || null
    });
  } catch (error) {
    console.error('Error in profile check:', error);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het controleren van je profiel',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post("/profile", requireAuth, async (req, res) => {
  try {
    // Get user from session (set by requireAuth middleware)
    const userId = req.user.id;
    const userToken = req.user.token; // JWT token from session

    if (!userId || !userToken) {
      return res.status(401).json({
        success: false,
        error: 'Niet geauthenticeerd'
      });
    }

    // Create a new Supabase client with the user's JWT for RLS context
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${userToken}`
          }
        }
      }
    );

    // Extract and validate profile data
    const {
      company_name,
      postal_code,
      city,
      country,
      vat_number,
      coc_number,
      email, // Optional - only update if provided
      phone, // Optional - only update if provided
      street, // Optional - only update if provided
      house_number // Optional - only update if provided
    } = req.body;

    // Validate required fields
    const requiredFields = {
      company_name: 'Bedrijfsnaam',
      postal_code: 'Postcode',
      city: 'Plaats',
      country: 'Land',
      vat_number: 'BTW nummer',
      coc_number: 'KvK nummer'
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([field]) => !req.body[field])
      .map(([_, label]) => label);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Verplichte velden ontbreken: ${missingFields.join(', ')}`
      });
    }

    // Prepare profile data with sanitization
    const profileData = {
      id: userId, // Required for upsert
      company_name: company_name.trim(),
      postal_code: postal_code.trim().toUpperCase(),
      city: city.trim(),
      country: country.trim(),
      vat_number: vat_number.trim().toUpperCase(),
      coc_number: coc_number.trim(),
      updated_at: new Date().toISOString()
    };

    // KVK Verification (if KVK number is provided and KVK API is available)
    let kvkVerificationResult = null;
    let kvkVerificationErrors = [];
    
    if (coc_number && coc_number.trim() && KvkApiService.isAvailable()) {
      try {
        console.log(`🔍 Verifying KVK number for user ${userId}: ${coc_number}`);
        
        // Verify KVK number
        const verification = await KvkApiService.verifyKvkNumber(coc_number.trim());
        
        if (verification.valid && verification.exists && verification.profile) {
          // KVK number is valid and company exists
          const kvkProfile = verification.profile;
          
          // Prepare user data for comparison
          const userData = {
            company_name: company_name || '',
            postal_code: postal_code || '',
            city: city || '',
            street: street || ''
          };
          
          // Compare user data with KVK data
          const comparison = KvkApiService.compareWithKvkData(userData, kvkProfile);
          
          // Store KVK verification data
          profileData.kvk_verified = true;
          profileData.kvk_verified_at = new Date().toISOString();
          profileData.kvk_company_name = kvkProfile.companyName || null;
          profileData.kvk_founding_date = kvkProfile.foundingDate || null;
          profileData.kvk_status = kvkProfile.status || null;
          profileData.kvk_data = kvkProfile.rawData || null;
          
          // Check for mismatches
          profileData.kvk_name_mismatch = !!comparison.mismatches.companyName;
          profileData.kvk_address_mismatch = !!(comparison.mismatches.postalCode || comparison.mismatches.city);
          
          kvkVerificationResult = {
            verified: true,
            exists: true,
            matches: comparison.matches,
            mismatches: comparison.mismatches,
            score: comparison.score,
            profile: {
              companyName: kvkProfile.companyName,
              status: kvkProfile.status,
              foundingDate: kvkProfile.foundingDate
            }
          };
          
          console.log(`✅ KVK verification successful for user ${userId}:`, {
            verified: true,
            companyName: kvkProfile.companyName,
            status: kvkProfile.status
          });
          
          // Log warnings for mismatches
          if (comparison.mismatches.companyName) {
            console.warn(`⚠️ KVK name mismatch for user ${userId}`);
            kvkVerificationErrors.push({
              type: 'name_mismatch',
              message: 'Bedrijfsnaam komt niet overeen met KVK gegevens'
            });
          }
          
          if (comparison.mismatches.postalCode || comparison.mismatches.city) {
            console.warn(`⚠️ KVK address mismatch for user ${userId}`);
            kvkVerificationErrors.push({
              type: 'address_mismatch',
              message: 'Adres komt niet overeen met KVK gegevens'
            });
          }
          
        } else if (verification.valid && !verification.exists) {
          // KVK number format is valid but company doesn't exist
          console.warn(`⚠️ KVK number not found for user ${userId}`);
          profileData.kvk_verified = false;
          profileData.kvk_verified_at = new Date().toISOString();
          kvkVerificationResult = {
            verified: false,
            exists: false,
            error: verification.error || 'KVK nummer niet gevonden'
          };
        } else {
          // Invalid KVK number format
          profileData.kvk_verified = false;
          kvkVerificationResult = {
            verified: false,
            exists: false,
            error: verification.error || 'Ongeldig KVK nummer formaat'
          };
        }
      } catch (error) {
        // KVK API error - don't block update, but log the error
        console.error(`❌ KVK API error for user ${userId}:`, error.message);
        profileData.kvk_verified = false;
        kvkVerificationResult = {
          verified: false,
          exists: false,
          error: error.message || 'KVK API fout'
        };
        // Don't throw - allow update to continue
      }
    } else if (coc_number && coc_number.trim() && !KvkApiService.isAvailable()) {
      // KVK number provided but API not configured
      profileData.kvk_verified = false;
    }

    // Add optional fields if provided
    if (email) {
      profileData.email = email.trim();
    } else {
      // Fetch existing profile to get the email
      const { data: existingProfile, error: fetchError } = await userSupabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();
      if (existingProfile && existingProfile.email) {
        profileData.email = existingProfile.email;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Email is verplicht'
        });
      }
    }
    if (phone) profileData.phone = phone.trim();
    if (street) profileData.street = street.trim();
    if (house_number) profileData.house_number = house_number.trim();

    // Get old profile data BEFORE update for risk re-evaluation
    const { data: oldProfile } = await supabaseAdmin
      .from('profiles')
      .select('company_name, coc_number, vat_number, email, street, postal_code, city, country, phone')
      .eq('id', userId)
      .single();

    // Perform upsert with the user's JWT context
    const { data: profile, error } = await userSupabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting profile:', error);
      
      // Handle specific error cases
      if (error.code === '42501' || /row-level security/i.test(error.message)) {
        return res.status(403).json({
          success: false,
          error: 'Geen toegang tot dit profiel (RLS policy)'
        });
      }
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({
          success: false,
          error: 'Dit profiel bestaat al'
        });
      }

      throw error; // Re-throw other errors
    }

    // Update profile completion status
    const { error: completionError } = await userSupabase
      .from('profile_completion_status')
      .upsert({
        id: userId,
        is_complete: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (completionError) {
      console.error('Error updating profile completion status:', completionError);
      // Don't throw here, as the profile was updated successfully
    }

    // Re-evaluate risk if relevant fields changed (async, don't block response)
    if (profile && oldProfile && UserRiskAssessmentService.shouldReevaluate(oldProfile, profile)) {
        console.log(`🔄 Relevant profile fields changed via API, re-evaluating risk for user ${userId}`);
        UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, profile)
          .then(result => {
            if (result.success) {
              console.log(`✅ Risk re-evaluation completed for user ${userId}: score=${result.score}, requires_review=${result.requires_manual_review}`);
            } else {
              console.warn(`⚠️ Risk re-evaluation failed for user ${userId}:`, result.error);
            }
          })
          .catch(err => {
            console.error(`❌ Error in async risk re-evaluation for user ${userId}:`, err);
          });
    }

    // Return success response with profile data
    const response = {
      success: true,
      profile,
      message: 'Profiel succesvol bijgewerkt'
    };
    
    // Include KVK verification result if available
    if (kvkVerificationResult) {
      response.kvkVerification = {
        ...kvkVerificationResult,
        errors: kvkVerificationErrors.length > 0 ? kvkVerificationErrors : undefined
      };
    }
    
    res.json(response);

  } catch (error) {
    console.error('Error updating profile:', error);
    
    // Handle specific error types
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        success: false,
        error: 'Ongeldige JSON data'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het bijwerken van je profiel'
    });
  }
});


// Add credit card endpoint - Redirect to the correct implementation
router.post('/payments/methods/creditcard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is verplicht'
      });
    }

    // Get user profile or ensure it exists
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, mollie_customer_id, email')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Profile query error:', profileError);
      return res.status(500).json({ 
        success: false, 
        error: 'Er is een fout opgetreden bij het ophalen van je profiel.' 
      });
    }

    // If profile doesn't exist, create it using the RPC
    if (!profile) {
      console.log('Profile not found, creating via RPC for user:', userId);
      const { data: ensuredProfile, error: ensureError } = await supabase
        .rpc('ensure_profile', { uid: userId, p_email: userEmail });
      
      if (ensureError || !ensuredProfile) {
        console.error('Failed to ensure profile:', ensureError);
        return res.status(500).json({ 
          success: false, 
          error: 'Er is een fout opgetreden bij het aanmaken van je profiel.' 
        });
      }
      
      profile = ensuredProfile;
      console.log('Profile ensured:', profile.id);
    }

    // Get or create Mollie customer
    const mollie = mollieClient;
    let mollieCustomerId = profile.mollie_customer_id;

    if (!mollieCustomerId) {
      console.log('Creating new Mollie customer for user:', userId);
      const customer = await mollieClient.customers.create({
        name: profile.email,
        email: profile.email,
        metadata: {
          userId: userId
        }
      });
      
      mollieCustomerId = customer.id;
      console.log('Created new Mollie customer:', mollieCustomerId);

      // Store the Mollie customer ID in the profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ mollie_customer_id: mollieCustomerId })
        .eq('id', userId);

      if (updateError) {
        console.error('Error storing Mollie customer ID:', updateError);
        throw new Error('Kon Mollie klant ID niet opslaan');
      }
    }

    // Create credit card verification payment
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUrl = new URL('/dashboard/payments?payment_success=true&payment_method=creditcard', baseUrl).toString();
    
    const verification = await mollieClient.customers_payments.create({
      customerId: mollieCustomerId,
      amount: { currency: 'EUR', value: '0.01' },
      method: 'creditcard',
      cardToken: token,
      sequenceType: 'first',
      redirectUrl: redirectUrl,
      locale: 'nl_NL',
      description: 'Creditcard verificatie voor GrowSocial'
    });

    console.log('Credit card verification created:', verification.id, 'Status:', verification.status);

    // Check if user already has a default payment method
    const { data: existingMethods, error: checkError } = await supabase
      .from('payment_methods')
      .select('id, is_default')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing payment methods:', checkError);
      throw new Error('Kon bestaande betaalmethoden niet ophalen');
    }

    // Save payment method in database
    // Log the verification details to see what data is available
    console.log('🔍 Mollie verification details:', JSON.stringify(verification.details, null, 2));
    
    const mollieMethod = 'creditcard'; // Raw provider method string
    const dbMethod = mapMollieMethodToDb(mollieMethod);

    if (!dbMethod) {
      return res.status(400).json({
        error: 'unsupported_payment_method',
        provider_method: mollieMethod
      });
    }

    const { error: dbError } = await supabase
      .from('payment_methods')
      .insert({
        user_id: userId,
        type: dbMethod,                    // enum: credit_card | sepa | ideal | paypal
        provider: 'mollie',
        provider_method: mollieMethod,     // raw provider string: "creditcard"
        provider_payment_method_id: verification.id,
        status: 'pending',
        is_default: !existingMethods,
        account_name: verification.details?.cardHolder || verification.details?.card_holder || 'Cardholder',
        card_type: verification.details?.cardType || verification.details?.card_type || 'Unknown',
        card_last4: verification.details?.cardNumber?.slice(-4) || verification.details?.card_last4 || null,
        card_expiry_month: verification.details?.expiryMonth || verification.details?.expiry_month || null,
        card_expiry_year: verification.details?.expiryYear || verification.details?.expiry_year || null,
        card_holder: verification.details?.cardHolder || verification.details?.card_holder || 'Cardholder',
        details: {
          verification_id: verification.id,
          verification_status: verification.status,
          checkout_url: verification.getCheckoutUrl(),
          card_type: verification.details?.cardType || verification.details?.card_type || 'Unknown',
          card_last4: verification.details?.cardNumber?.slice(-4) || verification.details?.card_last4 || null,
          card_holder: verification.details?.cardHolder || verification.details?.card_holder || 'Cardholder',
          expiry_date: verification.details?.expiryDate || verification.details?.expiry_date || verification.details?.expiryMonth + '/' + verification.details?.expiryYear || '**/**'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Database error bij opslaan payment method:', dbError);
      throw new Error('Kon betaalmethode niet opslaan in database');
    }

    // Update profile to reflect that user has a payment method
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ 
        has_payment_method: true,
        payment_method: 'creditcard',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError);
      // Don't throw error here, payment method was saved successfully
    }

    // Log activity for admin tracking
    try {
      const requestInfo = ActivityService.getRequestInfo(req);
      await ActivityService.logActivity({
        userId: userId,
        type: 'payment_method_added',
        severity: 'medium',
        title: 'Creditcard betaalmethode toegevoegd',
        description: `Gebruiker heeft een creditcard betaalmethode toegevoegd. Mollie verificatie ID: ${verification.id}`,
        metadata: {
          payment_method_type: 'creditcard',
          mollie_verification_id: verification.id,
          verification_status: verification.status,
          card_type: verification.details?.cardType || 'Unknown',
          card_last4: verification.details?.cardNumber?.slice(-4) || '****',
          mollie_customer_id: mollieCustomerId
        },
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent
      });
    } catch (activityError) {
      console.error('Error logging payment method activity:', activityError);
      // Don't throw error here, payment method was saved successfully
    }

    // Return response with checkout URL for 3D Secure
    res.json({
      success: true,
      checkoutUrl: verification.getCheckoutUrl(),
      verification: {
        checkoutUrl: verification.getCheckoutUrl(),
        status: verification.status,
        id: verification.id
      }
    });

  } catch (error) {
    console.error('Error adding credit card:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      field: error.field
    });
    
    let errorMessage = 'Er is een fout opgetreden bij het toevoegen van je creditcard';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.code === 'invalid_token') {
      errorMessage = 'Ongeldige creditcard gegevens';
      errorCode = 'INVALID_TOKEN';
    } else if (error.code === 'invalid_card_number') {
      errorMessage = 'Ongeldig kaartnummer';
      errorCode = 'INVALID_CARD_NUMBER';
    } else if (error.code === 'invalid_expiry_date') {
      errorMessage = 'Ongeldige vervaldatum';
      errorCode = 'INVALID_EXPIRY';
    } else if (error.code === 'invalid_cvv') {
      errorMessage = 'Ongeldige CVV code';
      errorCode = 'INVALID_CVV';
    } else if (error.code === 'card_declined') {
      errorMessage = 'Kaart geweigerd door de bank';
      errorCode = 'CARD_DECLINED';
    } else if (error.message && error.message.includes('fraud')) {
      errorMessage = 'Betaling geweigerd vanwege mogelijke fraude. Probeer een andere kaart of neem contact op met je bank.';
      errorCode = 'FRAUD_DETECTED';
    } else if (error.message) {
      // Use the actual Mollie error message if available
      errorMessage = error.message;
      errorCode = error.code || 'MOLLIE_ERROR';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      code: errorCode
    });
  }
});

// Add bank account endpoint
router.post('/payments/methods/bankaccount', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountName, iban, bank } = req.body;
    
    console.log('SEPA submission for user:', userId);
    console.log('User object:', req.user);

    // Validate required fields
    if (!accountName || !iban || !bank) {
      return res.status(400).json({
        success: false,
        error: 'Alle velden zijn verplicht'
      });
    }

    // Clean IBAN (remove spaces and convert to uppercase)
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    
    // Validate IBAN format
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    if (!ibanRegex.test(cleanIban)) {
      return res.status(400).json({
        success: false,
        error: `Ongeldig IBAN nummer: ${iban} (gecleand: ${cleanIban})`
      });
    }

    // Get user profile for Mollie customer creation
    console.log('Looking for profile with user ID:', userId);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, mollie_customer_id')
      .eq('id', userId)
      .maybeSingle();

    console.log('Profile query result:', { profile, profileError });

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      throw profileError;
    }

    if (!profile) {
      console.log('No profile found, creating profile for user...');
      
      // Create profile for the user using admin client to bypass RLS
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: req.user.email,
          // role_id will use the default value from the database
          company_name: req.user.user_metadata?.company_name || '',
          first_name: req.user.user_metadata?.first_name || '',
          last_name: req.user.user_metadata?.last_name || '',
          is_admin: req.user.user_metadata?.is_admin || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user profile. Please contact support.'
        });
      }

      console.log('Profile created successfully:', newProfile);
      profile = newProfile;
    }

    let mollieCustomerId = profile.mollie_customer_id;

    // Get Mollie client
    const mollie = require('../lib/mollie').mollieClient;

    // Create Mollie customer if doesn't exist
    if (!mollieCustomerId) {
      console.log('Creating Mollie customer for user:', userId);
      
      const mollieCustomer = await mollie.customers.create({
        name: accountName,
        email: profile.email,
        locale: 'nl_NL'
      });

      mollieCustomerId = mollieCustomer.id;
      console.log('Created Mollie customer:', mollieCustomerId);

      // Update profile with Mollie customer ID
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ mollie_customer_id: mollieCustomerId })
        .eq('id', userId);

      if (updateError) {
        console.error('Error storing Mollie customer ID:', updateError);
        throw new Error('Kon Mollie klant ID niet opslaan');
      }
    }

    // Map bank names to BIC codes
    const bankBicMap = {
      'abn': 'ABNANL2A',
      'ing': 'INGBNL2A', 
      'rabobank': 'RABONL2U',
      'asn': 'ASNBNL21',
      'bunq': 'BUNQNL2A',
      'knab': 'KNABNL2H',
      'sns': 'SNSBNL2A',
      'triodos': 'TRIONL2U'
    };
    
    const bicCode = bankBicMap[bank] || 'ABNANL2A'; // Default to ABN AMRO if not found
    
    // Create SEPA mandate in Mollie
    console.log('Creating SEPA mandate for customer:', mollieCustomerId);
    console.log('Using BIC code:', bicCode, 'for bank:', bank);
    
    const mandate = await mollieClient.customers_mandates.create({
      customerId: mollieCustomerId,
      method: 'directdebit',
      consumerName: accountName,
      consumerAccount: cleanIban,
      consumerBic: bicCode, // Use proper BIC code
      signatureDate: new Date().toISOString().split('T')[0],
      mandateReference: `MANDATE_${userId}_${Date.now()}`
    });

    console.log('Created Mollie mandate:', mandate.id);

    // Save payment method with Mollie mandate ID
    const mollieMethod = 'directdebit';
    const dbMethod = mapMollieMethodToDb(mollieMethod);

    if (!dbMethod) {
      return res.status(400).json({
        error: 'unsupported_payment_method',
        provider_method: mollieMethod
      });
    }

    const { data: method, error } = await supabaseAdmin
      .from('payment_methods')
      .insert({
        user_id: userId,
        type: dbMethod,                    // enum: sepa
        provider: 'mollie',
        provider_method: mollieMethod,     // raw provider string: "directdebit"
        provider_payment_method_id: mandate.id, // Use actual Mollie mandate ID
        account_name: accountName,
        iban: iban,
        bank: bank,
        is_default: true, // Set as default if it's the first method
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error saving bank account:', error);
      throw error;
    }

    // Update profile to reflect that user has a payment method
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        has_payment_method: true,
        payment_method: 'sepa',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError);
      // Don't throw error here, payment method was saved successfully
    }

    // Log activity for admin tracking
    try {
      const requestInfo = ActivityService.getRequestInfo(req);
      await ActivityService.logActivity({
        userId: userId,
        type: 'payment_method_added',
        severity: 'medium',
        title: 'SEPA betaalmethode toegevoegd',
        description: `Gebruiker heeft een SEPA automatische incasso betaalmethode toegevoegd. IBAN: ${iban ? iban.slice(0, 4) + '****' + iban.slice(-4) : 'N/A'}`,
        metadata: {
          payment_method_type: 'sepa',
          mollie_mandate_id: mandate.id,
          account_name: accountName,
          bank: bank
        },
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent
      });
    } catch (logError) {
      console.error('Error logging payment method addition:', logError);
      // Don't throw error, payment method was saved successfully
    }

    res.json({
      success: true,
      method
    });
  } catch (error) {
    console.error('Error adding bank account:', error);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het toevoegen van je bankrekening'
    });
  }
});

// POST /api/payments/methods/sepa-mandate-ideal - Create SEPA mandate via iDEAL (SECURE)
router.post('/payments/methods/sepa-mandate-ideal', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { iban, accountName, bank } = req.body;
    
    console.log('🔒 Creating SECURE SEPA mandate via iDEAL for user:', userId);

    // Validate required fields
    if (!iban || !accountName || !bank) {
      return res.status(400).json({
        success: false,
        error: 'Alle velden zijn verplicht'
      });
    }

    // Clean IBAN (remove spaces and convert to uppercase)
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    
    // Validate IBAN format
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    if (!ibanRegex.test(cleanIban)) {
      return res.status(400).json({
        success: false,
        error: `Ongeldig IBAN nummer: ${iban}`
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, mollie_customer_id, first_name, last_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return res.status(404).json({
        success: false,
        error: 'Gebruiker niet gevonden'
      });
    }

    // Create or get Mollie customer
    let mollieCustomerId = profile.mollie_customer_id;
    
    if (!mollieCustomerId) {
      console.log('Creating Mollie customer for user:', userId);
      
      const customer = await mollieClient.customers.create({
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || accountName,
        email: profile.email,
        locale: 'nl_NL'
      });

      mollieCustomerId = customer.id;
      console.log('Created Mollie customer:', mollieCustomerId);

      // Store customer ID in profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ mollie_customer_id: mollieCustomerId })
        .eq('id', userId);

      if (updateError) {
        console.error('Error storing Mollie customer ID:', updateError);
        throw new Error('Kon Mollie klant ID niet opslaan');
      }
    } else {
      // Verify existing customer still exists in Mollie
      try {
        await mollieClient.customers.get(mollieCustomerId);
        console.log('Existing Mollie customer verified:', mollieCustomerId);
      } catch (error) {
        if (error.statusCode === 410 || error.message.includes('no longer available')) {
          console.log('Existing Mollie customer no longer available, creating new one:', mollieCustomerId);
          
          // Create new customer
          const customer = await mollieClient.customers.create({
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || accountName,
            email: profile.email,
            locale: 'nl_NL'
          });

          mollieCustomerId = customer.id;
          console.log('Created new Mollie customer:', mollieCustomerId);

          // Update customer ID in profile
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ mollie_customer_id: mollieCustomerId })
            .eq('id', userId);

          if (updateError) {
            console.error('Error updating Mollie customer ID:', updateError);
            throw new Error('Kon Mollie klant ID niet bijwerken');
          }
        } else {
          throw error;
        }
      }
    }

    // Map bank names to BIC codes
    const bankBicMap = {
      'abn': 'ABNANL2A',
      'ing': 'INGBNL2A', 
      'rabobank': 'RABONL2U',
      'asn': 'ASNBNL21',
      'bunq': 'BUNQNL2A',
      'knab': 'KNABNL2H',
      'sns': 'SNSBNL2A',
      'triodos': 'TRIONL2U'
    };
    
    const bicCode = bankBicMap[bank] || 'ABNANL2A';

    // Create iDEAL payment for mandate verification
    const mandateReference = `MANDATE_${userId}_${Date.now()}`;
    const idempotencyKey = `mandate_ideal_${userId}_${Date.now()}`;
    
    console.log('🔒 Creating iDEAL payment for mandate verification');
    
    // Prepare payment data
    const paymentData = {
      amount: {
        currency: 'EUR',
        value: '0.01' // Minimal amount for mandate verification
      },
      description: `SEPA Mandate verificatie - ${accountName}`,
      redirectUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/payments?consent=complete`,
      method: 'ideal',
      customerId: mollieCustomerId,
      metadata: {
        type: 'sepa_mandate_verification',
        user_id: userId,
        iban: cleanIban,
        account_name: accountName,
        bank: bank,
        bic_code: bicCode,
        mandate_reference: mandateReference
      },
      idempotencyKey: idempotencyKey
    };

    // Only add webhook URL in production or if BASE_URL is set
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    if (baseUrl !== 'http://localhost:3000' && !baseUrl.includes('localhost')) {
      paymentData.webhookUrl = `${baseUrl}/api/webhooks/mollie/mandate`;
      console.log('🔒 Using webhook URL:', paymentData.webhookUrl);
    } else {
      console.log('🔒 Skipping webhook URL for localhost development');
    }
    
    const payment = await mollieClient.payments.create(paymentData);

    console.log('🔒 Created iDEAL payment for mandate:', payment.id);

    // Store pending mandate data
    const { error: pendingError } = await supabaseAdmin
      .from('pending_mandates')
      .insert({
        user_id: userId,
        payment_id: payment.id,
        iban: cleanIban,
        account_name: accountName,
        bank: bank,
        bic_code: bicCode,
        mandate_reference: mandateReference,
        status: 'pending_verification',
        created_at: new Date().toISOString()
      });

    if (pendingError) {
      console.error('Error storing pending mandate:', pendingError);
      throw new Error('Kon pending mandate niet opslaan');
    }

    res.json({
      success: true,
      paymentId: payment.id,
      redirectUrl: payment._links.checkout.href,
      message: 'Je wordt doorgestuurd naar je bank voor verificatie'
    });

  } catch (error) {
    console.error('Error creating SEPA mandate via iDEAL:', error);
    
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het aanmaken van de SEPA mandate'
    });
  }
});

// POST /api/payments/methods/sepa-mandate - Create SEPA mandate (DEPRECATED - INSECURE)
router.post('/payments/methods/sepa-mandate', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { iban, accountName, bank } = req.body;
    
    console.log('Creating SEPA mandate for user:', userId);

    // Validate required fields
    if (!iban || !accountName || !bank) {
      return res.status(400).json({
        success: false,
        error: 'Alle velden zijn verplicht'
      });
    }

    // Clean IBAN (remove spaces and convert to uppercase)
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    
    // Validate IBAN format
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    console.log('🔍 IBAN validation:', { 
      original: iban, 
      cleaned: cleanIban, 
      originalLength: iban?.length, 
      cleanedLength: cleanIban?.length, 
      matches: ibanRegex.test(cleanIban) 
    });
    
    if (!ibanRegex.test(cleanIban)) {
      return res.status(400).json({
        success: false,
        error: `Ongeldig IBAN nummer: ${iban} (gecleand: ${cleanIban})`
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, mollie_customer_id, first_name, last_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return res.status(404).json({
        success: false,
        error: 'Gebruiker niet gevonden'
      });
    }

    // Get Mollie client
    const { mollieClient } = require('../lib/mollie');

    // Create or get Mollie customer
    let mollieCustomerId = profile.mollie_customer_id;
    
    if (!mollieCustomerId) {
      console.log('Creating Mollie customer for user:', userId);
      
      const customer = await mollieClient.customers.create({
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || accountName,
        email: profile.email,
        locale: 'nl_NL'
      });

      mollieCustomerId = customer.id;
      console.log('Created Mollie customer:', mollieCustomerId);

      // Store customer ID in profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ mollie_customer_id: mollieCustomerId })
        .eq('id', userId);

      if (updateError) {
        console.error('Error storing Mollie customer ID:', updateError);
        throw new Error('Kon Mollie klant ID niet opslaan');
      }
    }

    // Map bank names to BIC codes
    const bankBicMap = {
      'abn': 'ABNANL2A',
      'ing': 'INGBNL2A', 
      'rabobank': 'RABONL2U',
      'asn': 'ASNBNL21',
      'bunq': 'BUNQNL2A',
      'knab': 'KNABNL2H',
      'sns': 'SNSBNL2A',
      'triodos': 'TRIONL2U'
    };
    
    const bicCode = bankBicMap[bank] || 'ABNANL2A';

    // Create SEPA mandate
    console.log('Creating SEPA mandate for customer:', mollieCustomerId);
    
    // Generate idempotency key for mandate creation
    const idempotencyKey = `mandate_${userId}_${Date.now()}`;
    
    const mandate = await mollieClient.customers_mandates.create({
      customerId: mollieCustomerId,
      method: 'directdebit',
      consumerName: accountName,
      consumerAccount: cleanIban,
      consumerBic: bicCode,
      signatureDate: new Date().toISOString().split('T')[0],
      mandateReference: `MANDATE_${userId}_${Date.now()}`,
      idempotencyKey: idempotencyKey
    });

    console.log('Created Mollie mandate:', mandate.id);

    // Save mandate in database
    const { data: mandateRecord, error: mandateError } = await supabaseAdmin
      .from('payment_methods')
      .insert({
        user_id: userId,
        type: 'sepa',
        provider: 'mollie',
        provider_method: 'directdebit',
        provider_payment_method_id: mandate.id,
        account_name: accountName,
        iban: iban,
        bank: bank,
        is_default: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (mandateError) {
      console.error('Error saving mandate:', mandateError);
      throw mandateError;
    }

    // Update profile
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        has_payment_method: true,
        payment_method: 'sepa',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError);
      // Don't throw error here, mandate was saved successfully
    }

    res.json({
      success: true,
      mandate: mandateRecord,
      mollieMandateId: mandate.id
    });

  } catch (error) {
    console.error('Error creating SEPA mandate:', error);
    
    // Check if it's a SEPA activation error
    if (error.message && error.message.includes('not activated')) {
      return res.status(400).json({
        success: false,
        error: 'SEPA Direct Debit is niet geactiveerd in je Mollie account. Activeer SEPA Direct Debit in je Mollie Dashboard → Settings → Payment methods.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het aanmaken van de SEPA mandate'
    });
  }
});

// GET /api/payments/methods/mandate-status/:paymentId - Check mandate verification status (for development)
router.get('/payments/methods/mandate-status/:paymentId', requireAuth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;
    
    console.log('🔒 Checking mandate status for payment:', paymentId);
    
    // Get payment details from Mollie
    const payment = await mollieClient.payments.get(paymentId);
    
    if (!payment.metadata || payment.metadata.type !== 'sepa_mandate_verification') {
      return res.status(400).json({
        success: false,
        error: 'Payment is not a mandate verification'
      });
    }

    // Verify user owns this payment
    if (payment.metadata.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get pending mandate data
    const { data: pendingMandate, error: pendingError } = await supabaseAdmin
      .from('pending_mandates')
      .select('*')
      .eq('payment_id', paymentId)
      .eq('user_id', userId)
      .single();

    if (pendingError || !pendingMandate) {
      return res.status(404).json({
        success: false,
        error: 'Pending mandate not found'
      });
    }

    // If payment is paid and mandate not yet created, create it
    if (payment.status === 'paid' && pendingMandate.status === 'pending_verification') {
      console.log('🔒 Payment successful, creating SEPA mandate');
      
      // Create SEPA mandate in Mollie
      const mandate = await mollieClient.customers_mandates.create({
        customerId: payment.customerId,
        method: 'directdebit',
        consumerName: pendingMandate.account_name,
        consumerAccount: pendingMandate.iban,
        consumerBic: pendingMandate.bic_code,
        signatureDate: new Date().toISOString().split('T')[0],
        mandateReference: pendingMandate.mandate_reference
      });

      console.log('🔒 Created SEPA mandate:', mandate.id);

      // Save mandate in database
      const { data: mandateRecord, error: mandateError } = await supabaseAdmin
        .from('payment_methods')
        .insert({
          user_id: pendingMandate.user_id,
          type: 'sepa',
          provider: 'mollie',
          provider_method: 'directdebit',
          provider_payment_method_id: mandate.id,
          account_name: pendingMandate.account_name,
          iban: pendingMandate.iban,
          bank: pendingMandate.bank,
          is_default: true,
          created_at: new Date().toISOString()
        })
        .select();

      if (mandateError) {
        console.error('Error saving mandate:', mandateError);
        throw mandateError;
      }

      // Update profile
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          has_payment_method: true,
          payment_method: 'sepa',
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingMandate.user_id);

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError);
      }

      // Update pending mandate status
      await supabaseAdmin
        .from('pending_mandates')
        .update({ 
          status: 'completed',
          mollie_mandate_id: mandate.id,
          completed_at: new Date().toISOString()
        })
        .eq('id', pendingMandate.id);

      console.log('🔒 Mandate verification completed successfully');
      
      return res.json({
        success: true,
        status: 'completed',
        mandate: mandateRecord,
        message: 'SEPA mandate successfully created'
      });
    }

    res.json({
      success: true,
      status: payment.status,
      mandateStatus: pendingMandate.status,
      message: payment.status === 'paid' ? 'Payment successful, mandate created' : 'Payment pending'
    });

  } catch (error) {
    console.error('Error checking mandate status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/payments/methods/revoke-sepa-mandate - Revoke SEPA mandate in Mollie
router.post('/payments/methods/revoke-sepa-mandate', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('🔒 Revoking SEPA mandate for user:', userId);
    
    // Get user profile with Mollie customer ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mollie_customer_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return res.status(404).json({
        success: false,
        error: 'Gebruiker niet gevonden'
      });
    }

    if (!profile.mollie_customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Geen Mollie klant gevonden'
      });
    }

    // Get user's SEPA mandates from database
    const { data: mandates, error: mandatesError } = await supabaseAdmin
      .from('payment_methods')
      .select('provider_payment_method_id')
      .eq('user_id', userId)
      .eq('type', 'sepa')
      .eq('provider', 'mollie');

    if (mandatesError) {
      console.error('Error fetching mandates:', mandatesError);
      return res.status(500).json({
        success: false,
        error: 'Kon mandates niet ophalen'
      });
    }

    if (!mandates || mandates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Geen SEPA mandates gevonden'
      });
    }

    // Revoke each mandate in Mollie
    const revocationResults = [];
    
    for (const mandate of mandates) {
      try {
        console.log('🔒 Revoking mandate in Mollie:', mandate.provider_payment_method_id);
        
        // Revoke mandate in Mollie
        await mollieClient.customers_mandates.delete(mandate.provider_payment_method_id, {
          customerId: profile.mollie_customer_id
        });
        
        console.log('🔒 Mandate revoked successfully:', mandate.provider_payment_method_id);
        revocationResults.push({
          mandateId: mandate.provider_payment_method_id,
          status: 'revoked'
        });
        
      } catch (mandateError) {
        console.error('Error revoking mandate:', mandateError);
        revocationResults.push({
          mandateId: mandate.provider_payment_method_id,
          status: 'error',
          error: mandateError.message
        });
      }
    }

    // Remove mandates from database
    const { error: deleteError } = await supabaseAdmin
      .from('payment_methods')
      .delete()
      .eq('user_id', userId)
      .eq('type', 'sepa')
      .eq('provider', 'mollie');

    if (deleteError) {
      console.error('Error deleting mandates from database:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Kon mandates niet verwijderen uit database'
      });
    }

    console.log('🔒 SEPA mandate revocation completed:', revocationResults);

    res.json({
      success: true,
      message: 'SEPA mandate succesvol ingetrokken',
      revokedMandates: revocationResults.length
    });

  } catch (error) {
    console.error('Error revoking SEPA mandate:', error);
    
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het intrekken van de SEPA mandate'
    });
  }
});

// POST /api/webhooks/mollie/mandate - Handle mandate verification webhook
router.post('/webhooks/mollie/mandate', async (req, res) => {
  try {
    const { id: paymentId } = req.body;
    
    console.log('🔒 Processing mandate verification webhook for payment:', paymentId);
    
    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    // Get payment details from Mollie
    const payment = await mollieClient.payments.get(paymentId);
    
    if (!payment.metadata || payment.metadata.type !== 'sepa_mandate_verification') {
      console.log('Payment is not a mandate verification, skipping');
      return res.status(200).json({ status: 'ignored' });
    }

    // Get pending mandate data
    const { data: pendingMandate, error: pendingError } = await supabaseAdmin
      .from('pending_mandates')
      .select('*')
      .eq('payment_id', paymentId)
      .eq('status', 'pending_verification')
      .single();

    if (pendingError || !pendingMandate) {
      console.error('Pending mandate not found:', pendingError);
      return res.status(404).json({ error: 'Pending mandate not found' });
    }

    // Check if payment was successful
    if (payment.status === 'paid') {
      console.log('🔒 Payment successful, creating SEPA mandate');
      
      // Create SEPA mandate in Mollie
      const mandate = await mollieClient.customers_mandates.create({
        customerId: payment.customerId,
        method: 'directdebit',
        consumerName: pendingMandate.account_name,
        consumerAccount: pendingMandate.iban,
        consumerBic: pendingMandate.bic_code,
        signatureDate: new Date().toISOString().split('T')[0],
        mandateReference: pendingMandate.mandate_reference
      });

      console.log('🔒 Created SEPA mandate:', mandate.id);

      // Save mandate in database
      const { data: mandateRecord, error: mandateError } = await supabaseAdmin
        .from('payment_methods')
        .insert({
          user_id: pendingMandate.user_id,
          type: 'sepa',
          provider: 'mollie',
          provider_method: 'directdebit',
          provider_payment_method_id: mandate.id,
          account_name: pendingMandate.account_name,
          iban: pendingMandate.iban,
          bank: pendingMandate.bank,
          is_default: true,
          created_at: new Date().toISOString()
        })
        .select();

      if (mandateError) {
        console.error('Error saving mandate:', mandateError);
        throw mandateError;
      }

      // Update profile
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          has_payment_method: true,
          payment_method: 'sepa',
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingMandate.user_id);

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError);
      }

      // Log activity for admin tracking
      try {
        await ActivityService.logActivity({
          userId: pendingMandate.user_id,
          type: 'payment_method_added',
          severity: 'medium',
          title: 'SEPA betaalmethode toegevoegd via iDEAL verificatie',
          description: `Gebruiker heeft een SEPA automatische incasso betaalmethode toegevoegd via iDEAL verificatie. Mollie mandate ID: ${mandate.id}`,
          metadata: {
            payment_method_type: 'sepa',
            mollie_mandate_id: mandate.id,
            verification_method: 'ideal',
            account_name: pendingMandate.account_name
          }
        });
      } catch (logError) {
        console.error('Error logging payment method addition:', logError);
        // Don't throw error, payment method was saved successfully
      }

      // Update pending mandate status
      await supabaseAdmin
        .from('pending_mandates')
        .update({ 
          status: 'completed',
          mollie_mandate_id: mandate.id,
          completed_at: new Date().toISOString()
        })
        .eq('id', pendingMandate.id);

      console.log('🔒 Mandate verification completed successfully');
      
    } else {
      console.log('🔒 Payment failed, updating pending mandate status');
      
      // Update pending mandate status to failed
      await supabaseAdmin
        .from('pending_mandates')
        .update({ 
          status: 'failed',
          failed_at: new Date().toISOString()
        })
        .eq('id', pendingMandate.id);
    }

    res.status(200).json({ status: 'processed' });

  } catch (error) {
    console.error('Error processing mandate webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set default payment method endpoint
router.post('/payments/methods/:id/set-default', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const methodId = req.params.id;

    // First, unset all default methods for this user
    const { error: unsetError } = await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('user_id', userId);

    if (unsetError) throw unsetError;

    // Then set the new default method
    const { data: method, error } = await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', methodId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      method
    });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het instellen van je standaard betaalmethode'
    });
  }
});

// Delete payment method endpoint
router.delete('/payments/methods/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const methodId = req.params.id;

    // Delete the payment method
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', methodId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Betaalmethode succesvol verwijderd'
    });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het verwijderen van je betaalmethode'
    });
  }
});

// Get user's payment methods
router.get('/user/payment-methods', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const supabase = createRequestClient(req);
    
    const { data: paymentMethods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching payment methods:', error);
      return res.status(500).json({
        success: false,
        error: 'database_error',
        message: 'Fout bij het ophalen van betaalmethoden'
      });
    }
    
    res.json({
      success: true,
      data: paymentMethods || []
    });
  } catch (error) {
    console.error('Error in get payment methods endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Er is een interne fout opgetreden'
    });
  }
});

// Admin Activity Tracking Endpoints
// GET /api/admin/activities - Get activities for admin dashboard
router.get('/admin/activities', requireAuth, isAdmin, async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      type,
      severity,
      userId,
      startDate,
      endDate
    } = req.query;

    const activities = await ActivityService.getActivities({
      limit: parseInt(limit),
      offset: parseInt(offset),
      type,
      severity,
      userId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });

    res.json({
      success: true,
      ...activities
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities',
      message: error.message
    });
  }
});

// GET /api/admin/activities/stats - Get activity statistics
router.get('/admin/activities/stats', requireAuth, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const stats = await ActivityService.getActivityStats(
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity statistics',
      message: error.message
    });
  }
});

// POST /api/admin/activities - Log custom admin activity
router.post('/admin/activities', requireAuth, isAdmin, async (req, res) => {
  try {
    const {
      userId,
      type,
      severity = 'medium',
      title,
      description,
      metadata = {}
    } = req.body;

    if (!type || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Type and title are required'
      });
    }

    const requestInfo = ActivityService.getRequestInfo(req);
    const activityId = await ActivityService.logActivity({
      userId,
      adminId: req.user.id,
      type,
      severity,
      title,
      description,
      metadata,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent
    });

    res.json({
      success: true,
      activityId,
      message: 'Activity logged successfully'
    });
  } catch (error) {
    console.error('Error logging admin activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log activity',
      message: error.message
    });
  }
});

// Industries API routes - Admin version with pricing
router.get("/admin/industries", requireAuth, isAdmin, async (req, res) => {
  try {
    // Try the new function first, fallback to basic query if it doesn't exist
    let industries;
    let error;
    
    try {
      const { data, error: funcError } = await supabase
        .rpc('get_industries_with_pricing');
      
      if (funcError) throw funcError;
      industries = data;
    } catch (funcError) {
      console.log('Function not found, using fallback query...');
      
      // Fallback: get industries data with new columns
      const { data: basicData, error: basicError } = await supabase
        .from('industries')
        .select('id, name, price_per_lead, description, is_active, created_at')
        .order('name');
      
      if (basicError) throw basicError;
      
      // Use the data as-is, with fallback values for null fields
      industries = basicData.map(industry => ({
        ...industry,
        price_per_lead: industry.price_per_lead || 10.00,
        description: industry.description || '',
        is_active: industry.is_active !== null ? industry.is_active : true
      }));
    }

    res.json({
      success: true,
      data: industries || []
    });
  } catch (err) {
    console.error("Error fetching industries:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het ophalen van de branches" 
    });
  }
});

router.post("/admin/industries", requireAuth, isAdmin, async (req, res) => {
  try {
    const { name, price_per_lead, description, is_active = true } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Naam is verplicht"
      });
    }

    // Validate price_per_lead
    const price = parseFloat(price_per_lead);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        error: "Prijs per lead moet een geldig positief getal zijn"
      });
    }

    // Try to insert with new columns first, fallback to basic insert
    let industry;
    let error;
    
    try {
      const { data, error: insertError } = await supabaseAdmin
        .from('industries')
        .insert([{
          name: name.trim(),
          price_per_lead: price,
          description: description?.trim() || null,
          is_active: is_active
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      industry = data;
    } catch (insertError) {
      console.log('New columns not available, using basic insert...');
      
      // Fallback: insert with basic columns only
      const { data, error: basicError } = await supabaseAdmin
        .from('industries')
        .insert([{
          name: name.trim()
        }])
        .select()
        .single();
      
      if (basicError) throw basicError;
      
      // Add default values for missing columns
      industry = {
        ...data,
        price_per_lead: price,
        description: description?.trim() || '',
        is_active: is_active
      };
    }

    res.json({
      success: true,
      data: industry,
      message: "Branche succesvol toegevoegd"
    });
  } catch (err) {
    console.error("Error creating industry:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het toevoegen van de branche" 
    });
  }
});

router.put("/admin/industries/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const industryId = req.params.id;
    const { name, price_per_lead, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Naam is verplicht"
      });
    }

    // Validate price_per_lead
    const price = parseFloat(price_per_lead);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        error: "Prijs per lead moet een geldig positief getal zijn"
      });
    }

    // Update industry with all fields
    const { data: industry, error: updateError } = await supabaseAdmin
      .from('industries')
      .update({
        name: name.trim(),
        price_per_lead: price,
        description: description?.trim() || null
      })
      .eq('id', industryId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      data: industry,
      message: "Branche succesvol bijgewerkt"
    });
  } catch (err) {
    console.error("Error updating industry:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het bijwerken van de branche" 
    });
  }
});

// =====================================================
// CUSTOMER BRANCHES API ENDPOINTS
// =====================================================
// These endpoints are for customer branch classification (internal CRM)
// Separate from industries which are for leads/requests
// =====================================================

// Get all customer branches
router.get("/admin/customer-branches", requireAuth, isAdmin, async (req, res) => {
  try {
    const { data: branches, error } = await supabaseAdmin
      .from('customer_branches')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: branches || []
    });
  } catch (err) {
    console.error("Error fetching customer branches:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het ophalen van branches" 
    });
  }
});

// Create new customer branch
router.post("/admin/customer-branches", requireAuth, isAdmin, async (req, res) => {
  try {
    const { name, description, is_active = true } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Naam is verplicht"
      });
    }

    // Check if branch already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('customer_branches')
      .select('id')
      .eq('name', name.trim())
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Deze branche bestaat al"
      });
    }

    // Insert new branch
    const { data: branch, error: insertError } = await supabaseAdmin
      .from('customer_branches')
      .insert([{
        name: name.trim(),
        description: description?.trim() || null,
        is_active: is_active
      }])
      .select()
      .single();
    
    if (insertError) throw insertError;

    res.json({
      success: true,
      data: branch,
      message: "Branche succesvol toegevoegd"
    });
  } catch (err) {
    console.error("Error creating customer branch:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het toevoegen van de branche" 
    });
  }
});

// =====================================================
// SERVICES API ENDPOINTS
// =====================================================

// Helper function to check if user is admin or manager
async function isAdminOrManager(user) {
  if (!user) return false;
  
  // Check is_admin flag
  if (user.is_admin === true || user.user_metadata?.is_admin === true) {
    return true;
  }
  
  // Check role for manager
  if (user.role_id) {
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('name')
      .eq('id', user.role_id)
      .maybeSingle();
    
    if (role?.name?.toLowerCase().includes('manager')) {
      return true;
    }
  }
  
  return false;
}

// Helper function to mask cost data for employees
function maskCostData(service, isAdminOrManager) {
  if (isAdminOrManager) {
    return service;
  }
  
  // For employees, mask cost and margin fields
  const masked = { ...service };
  masked.cost_cents = null;
  masked.margin_cents = null;
  masked.margin_percent = null;
  return masked;
}

// GET /api/admin/services - List services with filters
router.get("/admin/services", requireAuth, async (req, res) => {
  try {
    const { search, status, type, page = 1, pageSize = 20, sort = 'name' } = req.query;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    const userIsEmployee = !userIsAdminOrManager && req.user?.employee_status === 'active';
    
    if (!userIsAdminOrManager && !userIsEmployee) {
      return res.status(403).json({ 
        success: false, 
        error: 'Geen toegang tot diensten' 
      });
    }
    
    // Build query
    let query = supabaseAdmin
      .from('services')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else if (!userIsAdminOrManager) {
      // Employees can only see active/inactive, not archived
      query = query.in('status', ['active', 'inactive']);
    }
    
    if (type && type !== 'all') {
      query = query.eq('service_type', type);
    }
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(`name.ilike.${searchTerm},slug.ilike.${searchTerm},description.ilike.${searchTerm}`);
    }
    
    // Apply sorting
    const sortField = sort.split(':')[0] || 'name';
    const sortOrder = sort.includes(':desc') ? { ascending: false } : { ascending: true };
    query = query.order(sortField, sortOrder);
    
    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = Math.min(parseInt(pageSize) || 20, 100);
    const offset = (pageNum - 1) * pageSizeNum;
    query = query.range(offset, offset + pageSizeNum - 1);
    
    const { data: services, error, count } = await query;
    
    if (error) throw error;
    
    // Mask cost data for employees
    const maskedServices = services?.map(s => maskCostData(s, userIsAdminOrManager)) || [];
    
    res.json({
      success: true,
      data: maskedServices,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSizeNum)
      }
    });
  } catch (err) {
    console.error("Error fetching services:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het ophalen van diensten" 
    });
  }
});

// GET /api/admin/services/kpis - Get KPI data
router.get("/admin/services/kpis", requireAuth, async (req, res) => {
  try {
    const period = req.query.period || '30d';
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    const userIsEmployee = !userIsAdminOrManager && req.user?.employee_status === 'active';
    
    if (!userIsAdminOrManager && !userIsEmployee) {
      return res.status(403).json({ 
        success: false, 
        error: 'Geen toegang tot KPI data' 
      });
    }
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '30d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '365d':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
    }
    
    // Get sales data for period using the unified view
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('service_sales_view')
      .select('revenue_cents, cost_cents, service_id')
      .gte('sold_at', startDate.toISOString());
    
    if (salesError) throw salesError;
    
    // Calculate KPIs
    const totalRevenueCents = (sales || []).reduce((sum, s) => sum + (s.revenue_cents || 0), 0);
    const totalCostCents = (sales || []).reduce((sum, s) => sum + (s.cost_cents || 0), 0);
    const totalProfitCents = totalRevenueCents - totalCostCents;
    const weightedMarginPercent = totalRevenueCents > 0 
      ? (totalProfitCents / totalRevenueCents) * 100 
      : 0;
    
    // Get top service by revenue
    const serviceRevenueMap = {};
    (sales || []).forEach(sale => {
      if (!serviceRevenueMap[sale.service_id]) {
        serviceRevenueMap[sale.service_id] = 0;
      }
      serviceRevenueMap[sale.service_id] += sale.revenue_cents || 0;
    });
    
    let topService = null;
    if (Object.keys(serviceRevenueMap).length > 0) {
      const topServiceId = Object.entries(serviceRevenueMap)
        .sort(([, a], [, b]) => b - a)[0][0];
      
      const { data: service } = await supabaseAdmin
        .from('services')
        .select('id, name')
        .eq('id', topServiceId)
        .single();
      
      if (service) {
        topService = {
          id: service.id,
          name: service.name,
          revenue_cents: serviceRevenueMap[topServiceId]
        };
      }
    }
    
    // Get last sold date per service using the unified view
    const { data: lastSales, error: lastSalesError } = await supabaseAdmin
      .from('service_sales_view')
      .select('service_id, sold_at')
      .order('sold_at', { ascending: false });
    
    const lastSoldMap = {};
    (lastSales || []).forEach(sale => {
      if (!lastSoldMap[sale.service_id]) {
        lastSoldMap[sale.service_id] = sale.sold_at;
      }
    });
    
    const response = {
      success: true,
      data: {
        total_revenue_cents: userIsAdminOrManager ? totalRevenueCents : null,
        total_profit_cents: userIsAdminOrManager ? totalProfitCents : null,
        weighted_margin_percent: userIsAdminOrManager ? weightedMarginPercent : null,
        top_service: topService
      },
      period: period
    };
    
    res.json(response);
  } catch (err) {
    console.error("Error fetching service KPIs:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het ophalen van KPI data" 
    });
  }
});

// GET /api/admin/services/analytics - Get analytics breakdown per service
router.get("/admin/services/analytics", requireAuth, async (req, res) => {
  try {
    const period = req.query.period || '30d';
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    const userIsEmployee = !userIsAdminOrManager && req.user?.employee_status === 'active';
    
    if (!userIsAdminOrManager && !userIsEmployee) {
      return res.status(403).json({ 
        success: false, 
        error: 'Geen toegang tot analytics data' 
      });
    }
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '30d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '365d':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
    }
    
    // Get all services
    const { data: services, error: servicesError } = await supabaseAdmin
      .from('services')
      .select('id, name, slug, price_cents, cost_cents')
      .in('status', ['active', 'inactive']);
    
    if (servicesError) throw servicesError;
    
    // Get sales data for period using the unified view
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('service_sales_view')
      .select('service_id, revenue_cents, cost_cents, sold_at, quantity')
      .gte('sold_at', startDate.toISOString());
    
    if (salesError) throw salesError;
    
    // Aggregate sales per service
    const serviceMetrics = {};
    
    (services || []).forEach(service => {
      serviceMetrics[service.id] = {
        service_id: service.id,
        service_name: service.name,
        service_slug: service.slug,
        revenue_cents: 0,
        profit_cents: 0,
        margin_percent: null,
        sales_count: 0,
        avg_order_value_cents: null,
        last_sold_at: null
      };
    });
    
    // Process sales
    (sales || []).forEach(sale => {
      if (serviceMetrics[sale.service_id]) {
        const metrics = serviceMetrics[sale.service_id];
        metrics.revenue_cents += sale.revenue_cents || 0;
        metrics.profit_cents += (sale.revenue_cents || 0) - (sale.cost_cents || 0);
        metrics.sales_count += sale.quantity || 1;
        
        // Update last sold date
        if (!metrics.last_sold_at || new Date(sale.sold_at) > new Date(metrics.last_sold_at)) {
          metrics.last_sold_at = sale.sold_at;
        }
      }
    });
    
    // Calculate margin and avg order value
    Object.values(serviceMetrics).forEach(metrics => {
      if (metrics.revenue_cents > 0) {
        metrics.margin_percent = (metrics.profit_cents / metrics.revenue_cents) * 100;
        metrics.avg_order_value_cents = metrics.revenue_cents / metrics.sales_count;
      }
    });
    
    // Convert to array and sort by revenue (descending)
    let breakdown = Object.values(serviceMetrics)
      .sort((a, b) => b.revenue_cents - a.revenue_cents);
    
    // Mask cost/profit/margin for employees
    if (!userIsAdminOrManager) {
      breakdown = breakdown.map(metrics => ({
        ...metrics,
        profit_cents: null,
        margin_percent: null
      }));
    }
    
    res.json({
      success: true,
      data: breakdown,
      period: period
    });
  } catch (err) {
    console.error("Error fetching service analytics:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het ophalen van analytics data" 
    });
  }
});

// POST /api/admin/services - Create new service
router.post("/admin/services", requireAuth, async (req, res) => {
  try {
    // Check permissions - only admin/manager can create
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen diensten aanmaken' 
      });
    }
    
    const { 
      name, 
      slug, 
      description, 
      service_type, 
      status = 'active',
      price_cents,
      cost_cents,
      unit_label,
      sort_order = 0
    } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Naam is verplicht"
      });
    }
    
    if (!slug || !slug.trim()) {
      return res.status(400).json({
        success: false,
        error: "Slug is verplicht"
      });
    }
    
    if (!service_type || !['one_time', 'recurring', 'per_lead', 'hourly'].includes(service_type)) {
      return res.status(400).json({
        success: false,
        error: "Ongeldig service type"
      });
    }
    
    const price = parseFloat(price_cents);
    const cost = parseFloat(cost_cents);
    
    if (isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        error: "Verkoopprijs moet een geldig positief getal zijn"
      });
    }
    
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({
        success: false,
        error: "Inkoopkost moet een geldig positief getal zijn"
      });
    }
    
    // Check if slug already exists
    const { data: existing } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('slug', slug.trim())
      .maybeSingle();
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Deze slug bestaat al"
      });
    }
    
    // Map service_type to pricing_model
    const pricingModelMap = {
      'one_time': 'fixed',
      'recurring': 'recurring',
      'per_lead': 'per_unit',
      'hourly': 'hourly'
    };
    
    // Insert service
    const { data: service, error: insertError } = await supabaseAdmin
      .from('services')
      .insert([{
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        service_type: service_type,
        pricing_model: pricingModelMap[service_type] || 'fixed',
        status: status,
        price_cents: Math.round(price * 100), // Convert to cents
        cost_cents: Math.round(cost * 100), // Convert to cents
        unit_label: unit_label?.trim() || null,
        sort_order: parseInt(sort_order) || 0,
        created_by: req.user.id
      }])
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    res.json({
      success: true,
      data: service,
      message: "Dienst succesvol aangemaakt"
    });
  } catch (err) {
    console.error("Error creating service:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het aanmaken van de dienst" 
    });
  }
});

// PATCH /api/admin/services/:id - Update service
router.patch("/admin/services/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions - only admin/manager can update
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen diensten bewerken' 
      });
    }
    
    const updates = {};
    const { 
      name, 
      slug, 
      description, 
      service_type, 
      status,
      price_cents,
      cost_cents,
      unit_label,
      sort_order
    } = req.body;
    
    if (name !== undefined) updates.name = name.trim();
    if (slug !== undefined) {
      updates.slug = slug.trim();
      
      // Check if slug already exists (excluding current service)
      const { data: existing } = await supabaseAdmin
        .from('services')
        .select('id')
        .eq('slug', slug.trim())
        .neq('id', id)
        .maybeSingle();
      
      if (existing) {
        return res.status(400).json({
          success: false,
          error: "Deze slug bestaat al"
        });
      }
    }
    if (description !== undefined) updates.description = description?.trim() || null;
    if (service_type !== undefined) {
      if (!['one_time', 'recurring', 'per_lead', 'hourly'].includes(service_type)) {
        return res.status(400).json({
          success: false,
          error: "Ongeldig service type"
        });
      }
      updates.service_type = service_type;
      
      // Update pricing_model based on service_type
      const pricingModelMap = {
        'one_time': 'fixed',
        'recurring': 'recurring',
        'per_lead': 'per_unit',
        'hourly': 'hourly'
      };
      updates.pricing_model = pricingModelMap[service_type] || 'fixed';
    }
    if (status !== undefined) {
      if (!['active', 'inactive', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Ongeldige status"
        });
      }
      updates.status = status;
    }
    if (price_cents !== undefined) {
      const price = parseFloat(price_cents);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          error: "Verkoopprijs moet een geldig positief getal zijn"
        });
      }
      updates.price_cents = Math.round(price * 100);
    }
    if (cost_cents !== undefined) {
      const cost = parseFloat(cost_cents);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({
          success: false,
          error: "Inkoopkost moet een geldig positief getal zijn"
        });
      }
      updates.cost_cents = Math.round(cost * 100);
    }
    if (unit_label !== undefined) updates.unit_label = unit_label?.trim() || null;
    if (sort_order !== undefined) updates.sort_order = parseInt(sort_order) || 0;
    
    // Get old service for audit
    const { data: oldService } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', id)
      .single();
    
    const { data: service, error: updateError } = await supabaseAdmin
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: "Dienst niet gevonden"
      });
    }
    
    // Log audit (check if price changed)
    const priceChanged = oldService && (oldService.price_cents !== service.price_cents || oldService.cost_cents !== service.cost_cents);
    const action = priceChanged ? 'price_changed' : 'updated';
    await logServiceAudit(id, req.user.id, action, { changes: updates });
    
    res.json({
      success: true,
      data: service,
      message: "Dienst succesvol bijgewerkt"
    });
  } catch (err) {
    console.error("Error updating service:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het bijwerken van de dienst" 
    });
  }
});

// PATCH /api/admin/services/:id/pricing - Update service pricing (billing cycle + packages)
router.patch("/admin/services/:id/pricing", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions - only admin/manager can update pricing
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen prijzen bewerken' 
      });
    }
    
    const { billing_cycle, packages } = req.body;
    
    // Validate billing_cycle
    if (!billing_cycle || !['one_time', 'monthly', 'yearly'].includes(billing_cycle)) {
      return res.status(400).json({
        success: false,
        error: "Ongeldige factureringscyclus. Moet 'one_time', 'monthly' of 'yearly' zijn"
      });
    }
    
    // Validate packages
    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Elke dienst moet minimaal 1 pakket hebben"
      });
    }
    
    // Validate each package
    const activePackages = packages.filter(p => p.is_active !== false);
    if (activePackages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Er moet minimaal 1 actief pakket zijn"
      });
    }
    
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      
      if (!pkg.name || typeof pkg.name !== 'string' || pkg.name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: `Pakket ${i + 1}: naam is verplicht`
        });
      }
      
      if (pkg.price_cents === undefined || pkg.price_cents === null) {
        return res.status(400).json({
          success: false,
          error: `Pakket "${pkg.name}": prijs is verplicht`
        });
      }
      
      const priceCents = typeof pkg.price_cents === 'number' 
        ? Math.round(pkg.price_cents) 
        : Math.round(parseFloat(pkg.price_cents) * 100);
      
      if (isNaN(priceCents) || priceCents < 0) {
        return res.status(400).json({
          success: false,
          error: `Pakket "${pkg.name}": prijs moet een geldig positief getal zijn`
        });
      }
      
      // Validate cost_cents if provided
      if (pkg.cost_cents !== undefined && pkg.cost_cents !== null) {
        const costCents = typeof pkg.cost_cents === 'number'
          ? Math.round(pkg.cost_cents)
          : Math.round(parseFloat(pkg.cost_cents) * 100);
        
        if (isNaN(costCents) || costCents < 0) {
          return res.status(400).json({
            success: false,
            error: `Pakket "${pkg.name}": kost moet een geldig positief getal zijn`
          });
        }
      }
    }
    
    // Check if service exists
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id, billing_model')
      .eq('id', id)
      .single();
    
    if (serviceError || !service) {
      return res.status(404).json({
        success: false,
        error: "Dienst niet gevonden"
      });
    }
    
    // Get current packages for audit
    const { data: currentPackages } = await supabaseAdmin
      .from('service_price_tiers')
      .select('*')
      .eq('service_id', id)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });
    
    // Update service billing_model
    const { error: updateServiceError } = await supabaseAdmin
      .from('services')
      .update({ billing_model: billing_cycle })
      .eq('id', id);
    
    if (updateServiceError) throw updateServiceError;
    
    // Process packages: upsert (create/update) and archive removed ones
    const packageIds = packages
      .map(p => p.id)
      .filter(id => id !== undefined && id !== null);
    
    // Archive packages that are not in the new list
    if (currentPackages && currentPackages.length > 0) {
      const packagesToArchive = currentPackages.filter(
        cp => !packageIds.includes(cp.id)
      );
      
      if (packagesToArchive.length > 0) {
        const archiveIds = packagesToArchive.map(p => p.id);
        await supabaseAdmin
          .from('service_price_tiers')
          .update({ archived_at: new Date().toISOString() })
          .in('id', archiveIds);
      }
    }
    
    // Upsert packages
    const upsertPromises = packages.map(async (pkg, index) => {
      const priceCents = typeof pkg.price_cents === 'number'
        ? Math.round(pkg.price_cents)
        : Math.round(parseFloat(pkg.price_cents) * 100);
      
      const costCents = pkg.cost_cents !== undefined && pkg.cost_cents !== null
        ? (typeof pkg.cost_cents === 'number'
            ? Math.round(pkg.cost_cents)
            : Math.round(parseFloat(pkg.cost_cents) * 100))
        : null;
      
      const packageData = {
        service_id: id,
        name: pkg.name.trim(),
        description: pkg.description?.trim() || null,
        billing_model: billing_cycle,
        price_cents: priceCents,
        cost_cents: costCents !== null ? costCents : 0, // Default to 0 if not provided
        unit_label: pkg.unit_label?.trim() || null,
        is_active: pkg.is_active !== false, // Default to true
        sort_order: pkg.sort_order !== undefined ? parseInt(pkg.sort_order) : index,
        archived_at: null // Ensure not archived
      };
      
      if (pkg.id) {
        // Update existing
        const { data, error } = await supabaseAdmin
          .from('service_price_tiers')
          .update(packageData)
          .eq('id', pkg.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabaseAdmin
          .from('service_price_tiers')
          .insert([packageData])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    });
    
    const updatedPackages = await Promise.all(upsertPromises);
    
    // Verify at least one active package exists
    const { data: activePackagesCheck } = await supabaseAdmin
      .from('service_price_tiers')
      .select('id')
      .eq('service_id', id)
      .eq('is_active', true)
      .is('archived_at', null);
    
    if (!activePackagesCheck || activePackagesCheck.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Er moet minimaal 1 actief pakket zijn"
      });
    }
    
    // Log pricing audit
    try {
      await supabaseAdmin
        .from('service_pricing_audit')
        .insert([{
          service_id: id,
          actor_user_id: req.user.id,
          action: 'pricing_updated',
          before_state: {
            billing_model: service.billing_model,
            packages: currentPackages || []
          },
          after_state: {
            billing_model: billing_cycle,
            packages: updatedPackages
          }
        }]);
    } catch (auditError) {
      console.error("Error logging pricing audit:", auditError);
      // Don't fail the request if audit logging fails
    }
    
    // Also log to service_audit_log for consistency
    await logServiceAudit(id, req.user.id, 'pricing_updated', {
      billing_cycle: billing_cycle,
      packages_count: updatedPackages.length
    });
    
    // Fetch updated service with packages
    const { data: updatedService } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', id)
      .single();
    
    const { data: allPackages } = await supabaseAdmin
      .from('service_price_tiers')
      .select('*')
      .eq('service_id', id)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });
    
    res.json({
      success: true,
      data: {
        service: updatedService,
        packages: allPackages || []
      },
      message: "Prijzen succesvol bijgewerkt"
    });
  } catch (err) {
    console.error("Error updating service pricing:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het bijwerken van de prijzen" 
    });
  }
});

// POST /api/admin/services/:id/archive - Archive service
router.post("/admin/services/:id/archive", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions - only admin/manager can archive
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen diensten archiveren' 
      });
    }
    
    const { data: service, error } = await supabaseAdmin
      .from('services')
      .update({ status: 'archived' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: "Dienst niet gevonden"
      });
    }
    
    res.json({
      success: true,
      data: service,
      message: "Dienst succesvol gearchiveerd"
    });
  } catch (err) {
    console.error("Error archiving service:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het archiveren van de dienst" 
    });
  }
});

// =====================================================
// SERVICE DETAIL API ENDPOINTS
// =====================================================

// Helper function to log audit entry
async function logServiceAudit(serviceId, userId, action, diff = {}) {
  try {
    await supabaseAdmin
      .from('service_audit_log')
      .insert([{
        service_id: serviceId,
        actor_user_id: userId,
        action: action,
        diff: diff
      }]);
  } catch (err) {
    console.error("Error logging service audit:", err);
    // Don't throw - audit logging failure shouldn't break the request
  }
}

// GET /api/admin/services/:id - Get service detail with all related data
router.get("/admin/services/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    const userIsEmployee = !userIsAdminOrManager && req.user?.employee_status === 'active';
    
    if (!userIsAdminOrManager && !userIsEmployee) {
      return res.status(403).json({ 
        success: false, 
        error: 'Geen toegang tot dienst details' 
      });
    }
    
    // Get service
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', id)
      .single();
    
    if (serviceError) throw serviceError;
    if (!service) {
      return res.status(404).json({
        success: false,
        error: "Dienst niet gevonden"
      });
    }
    
    // Check if employee can view (not archived)
    if (!userIsAdminOrManager && service.status === 'archived') {
      return res.status(403).json({
        success: false,
        error: "Geen toegang tot gearchiveerde diensten"
      });
    }
    
    // Get related data in parallel
    const [tiersResult, addonsResult, rulesResult, templatesResult, auditLogResult, summaryResult] = await Promise.all([
      // Tiers
      supabaseAdmin
        .from('service_price_tiers')
        .select('*')
        .eq('service_id', id)
        .order('sort_order', { ascending: true }),
      
      // Addons
      supabaseAdmin
        .from('service_addons')
        .select('*')
        .eq('service_id', id)
        .order('sort_order', { ascending: true }),
      
      // Discount rules
      supabaseAdmin
        .from('service_discount_rules')
        .select('*')
        .eq('service_id', id)
        .order('created_at', { ascending: false }),
      
      // Delivery templates
      supabaseAdmin
        .from('service_delivery_templates')
        .select('*')
        .eq('service_id', id)
        .order('created_at', { ascending: false }),
      
      // Audit log (last 20 entries)
      supabaseAdmin
        .from('service_audit_log')
        .select('*')
        .eq('service_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      
      // Summary stats (using service_line_items or service_sales)
      supabaseAdmin
        .from('service_line_items')
        .select('revenue_cents, cost_cents, quantity, occurred_at')
        .eq('service_id', id)
        .order('occurred_at', { ascending: false })
        .limit(1)
    ]);
    
    if (tiersResult.error) throw tiersResult.error;
    if (addonsResult.error) throw addonsResult.error;
    if (rulesResult.error) throw rulesResult.error;
    if (templatesResult.error) throw templatesResult.error;
    if (auditLogResult.error) throw auditLogResult.error;
    
    // Calculate summary stats
    const { data: allLineItems } = await supabaseAdmin
      .from('service_line_items')
      .select('revenue_cents, cost_cents, quantity, occurred_at')
      .eq('service_id', id);
    
    const totalRevenue = (allLineItems || []).reduce((sum, item) => sum + (item.revenue_cents || 0), 0);
    const totalCost = (allLineItems || []).reduce((sum, item) => sum + (item.cost_cents || 0), 0);
    const totalSales = (allLineItems || []).length;
    const lastSoldAt = allLineItems && allLineItems.length > 0
      ? allLineItems.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))[0].occurred_at
      : null;
    
    const summary = {
      total_revenue_cents: userIsAdminOrManager ? totalRevenue : null,
      total_profit_cents: userIsAdminOrManager ? (totalRevenue - totalCost) : null,
      total_sales: totalSales,
      last_sold_at: lastSoldAt,
      active_tiers_count: (tiersResult.data || []).filter(t => t.is_active).length,
      active_addons_count: (addonsResult.data || []).filter(a => a.is_active).length,
      active_rules_count: (rulesResult.data || []).filter(r => r.is_active).length,
      templates_count: (templatesResult.data || []).length
    };
    
    // Mask cost data for employees
    const maskedService = maskCostData(service, userIsAdminOrManager);
    
    res.json({
      success: true,
      data: {
        service: maskedService,
        tiers: tiersResult.data || [],
        addons: addonsResult.data || [],
        discount_rules: rulesResult.data || [],
        delivery_templates: templatesResult.data || [],
        audit_log: auditLogResult.data || [],
        summary: summary
      }
    });
  } catch (err) {
    console.error("Error fetching service detail:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het ophalen van dienst details" 
    });
  }
});

// POST /api/admin/services/:id/tiers - Create price tier
router.post("/admin/services/:id/tiers", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen prijsschalen beheren' 
      });
    }
    
    const { name, description, billing_model, price_cents, cost_cents, unit_label, included_units, overage_price_cents, sort_order } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Naam is verplicht" });
    }
    
    const price = parseFloat(price_cents);
    const cost = parseFloat(cost_cents);
    
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, error: "Prijs moet een geldig positief getal zijn" });
    }
    
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({ success: false, error: "Kost moet een geldig positief getal zijn" });
    }
    
    // Insert tier
    const { data: tier, error } = await supabaseAdmin
      .from('service_price_tiers')
      .insert([{
        service_id: id,
        name: name.trim(),
        description: description?.trim() || null,
        billing_model: billing_model || 'monthly',
        price_cents: Math.round(price * 100),
        cost_cents: Math.round(cost * 100),
        unit_label: unit_label?.trim() || null,
        included_units: included_units ? parseFloat(included_units) : null,
        overage_price_cents: overage_price_cents ? Math.round(parseFloat(overage_price_cents) * 100) : null,
        sort_order: parseInt(sort_order) || 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'tier_added', { tier_id: tier.id, tier_name: tier.name });
    
    res.json({
      success: true,
      data: tier,
      message: "Prijsschaal succesvol toegevoegd"
    });
  } catch (err) {
    console.error("Error creating tier:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het aanmaken van de prijsschaal" 
    });
  }
});

// PATCH /api/admin/services/:id/tiers/:tierId - Update tier
router.patch("/admin/services/:id/tiers/:tierId", requireAuth, async (req, res) => {
  try {
    const { id, tierId } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen prijsschalen beheren' 
      });
    }
    
    const updates = {};
    const { name, description, billing_model, price_cents, cost_cents, unit_label, included_units, overage_price_cents, is_active, sort_order } = req.body;
    
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (billing_model !== undefined) updates.billing_model = billing_model;
    if (price_cents !== undefined) {
      const price = parseFloat(price_cents);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, error: "Prijs moet een geldig positief getal zijn" });
      }
      updates.price_cents = Math.round(price * 100);
    }
    if (cost_cents !== undefined) {
      const cost = parseFloat(cost_cents);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({ success: false, error: "Kost moet een geldig positief getal zijn" });
      }
      updates.cost_cents = Math.round(cost * 100);
    }
    if (unit_label !== undefined) updates.unit_label = unit_label?.trim() || null;
    if (included_units !== undefined) updates.included_units = included_units ? parseFloat(included_units) : null;
    if (overage_price_cents !== undefined) updates.overage_price_cents = overage_price_cents ? Math.round(parseFloat(overage_price_cents) * 100) : null;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = parseInt(sort_order) || 0;
    
    // Get old tier for audit
    const { data: oldTier } = await supabaseAdmin
      .from('service_price_tiers')
      .select('*')
      .eq('id', tierId)
      .single();
    
    const { data: tier, error } = await supabaseAdmin
      .from('service_price_tiers')
      .update(updates)
      .eq('id', tierId)
      .eq('service_id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (!tier) {
      return res.status(404).json({ success: false, error: "Prijsschaal niet gevonden" });
    }
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'tier_updated', { tier_id: tier.id, changes: updates });
    
    res.json({
      success: true,
      data: tier,
      message: "Prijsschaal succesvol bijgewerkt"
    });
  } catch (err) {
    console.error("Error updating tier:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het bijwerken van de prijsschaal" 
    });
  }
});

// POST /api/admin/services/:id/tiers/:tierId/archive - Archive tier
router.post("/admin/services/:id/tiers/:tierId/archive", requireAuth, async (req, res) => {
  try {
    const { id, tierId } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen prijsschalen beheren' 
      });
    }
    
    const { data: tier, error } = await supabaseAdmin
      .from('service_price_tiers')
      .update({ is_active: false })
      .eq('id', tierId)
      .eq('service_id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (!tier) {
      return res.status(404).json({ success: false, error: "Prijsschaal niet gevonden" });
    }
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'tier_removed', { tier_id: tier.id });
    
    res.json({
      success: true,
      data: tier,
      message: "Prijsschaal succesvol gearchiveerd"
    });
  } catch (err) {
    console.error("Error archiving tier:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het archiveren van de prijsschaal" 
    });
  }
});

// POST /api/admin/services/:id/addons - Create addon
router.post("/admin/services/:id/addons", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen add-ons beheren' 
      });
    }
    
    const { name, description, billing_model, price_cents, cost_cents, unit_label, tier_id, sort_order } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Naam is verplicht" });
    }
    
    const price = parseFloat(price_cents);
    const cost = parseFloat(cost_cents);
    
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, error: "Prijs moet een geldig positief getal zijn" });
    }
    
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({ success: false, error: "Kost moet een geldig positief getal zijn" });
    }
    
    // Insert addon
    const { data: addon, error } = await supabaseAdmin
      .from('service_addons')
      .insert([{
        service_id: id,
        tier_id: tier_id || null,
        name: name.trim(),
        description: description?.trim() || null,
        billing_model: billing_model || 'one_time',
        price_cents: Math.round(price * 100),
        cost_cents: Math.round(cost * 100),
        unit_label: unit_label?.trim() || null,
        sort_order: parseInt(sort_order) || 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'addon_added', { addon_id: addon.id, addon_name: addon.name });
    
    res.json({
      success: true,
      data: addon,
      message: "Add-on succesvol toegevoegd"
    });
  } catch (err) {
    console.error("Error creating addon:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het aanmaken van de add-on" 
    });
  }
});

// PATCH /api/admin/services/:id/addons/:addonId - Update addon
router.patch("/admin/services/:id/addons/:addonId", requireAuth, async (req, res) => {
  try {
    const { id, addonId } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen add-ons beheren' 
      });
    }
    
    const updates = {};
    const { name, description, billing_model, price_cents, cost_cents, unit_label, tier_id, is_active, sort_order } = req.body;
    
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (billing_model !== undefined) updates.billing_model = billing_model;
    if (price_cents !== undefined) {
      const price = parseFloat(price_cents);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, error: "Prijs moet een geldig positief getal zijn" });
      }
      updates.price_cents = Math.round(price * 100);
    }
    if (cost_cents !== undefined) {
      const cost = parseFloat(cost_cents);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({ success: false, error: "Kost moet een geldig positief getal zijn" });
      }
      updates.cost_cents = Math.round(cost * 100);
    }
    if (unit_label !== undefined) updates.unit_label = unit_label?.trim() || null;
    if (tier_id !== undefined) updates.tier_id = tier_id || null;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = parseInt(sort_order) || 0;
    
    const { data: addon, error } = await supabaseAdmin
      .from('service_addons')
      .update(updates)
      .eq('id', addonId)
      .eq('service_id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (!addon) {
      return res.status(404).json({ success: false, error: "Add-on niet gevonden" });
    }
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'addon_updated', { addon_id: addon.id, changes: updates });
    
    res.json({
      success: true,
      data: addon,
      message: "Add-on succesvol bijgewerkt"
    });
  } catch (err) {
    console.error("Error updating addon:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het bijwerken van de add-on" 
    });
  }
});

// POST /api/admin/services/:id/addons/:addonId/archive - Archive addon
router.post("/admin/services/:id/addons/:addonId/archive", requireAuth, async (req, res) => {
  try {
    const { id, addonId } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen add-ons beheren' 
      });
    }
    
    const { data: addon, error } = await supabaseAdmin
      .from('service_addons')
      .update({ is_active: false })
      .eq('id', addonId)
      .eq('service_id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (!addon) {
      return res.status(404).json({ success: false, error: "Add-on niet gevonden" });
    }
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'addon_removed', { addon_id: addon.id });
    
    res.json({
      success: true,
      data: addon,
      message: "Add-on succesvol gearchiveerd"
    });
  } catch (err) {
    console.error("Error archiving addon:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het archiveren van de add-on" 
    });
  }
});

// POST /api/admin/services/:id/discount-rules - Create discount rule
router.post("/admin/services/:id/discount-rules", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen kortingsregels beheren' 
      });
    }
    
    const { name, rule_type, applies_to, target_tier_id, target_addon_id, value_numeric, min_qty, max_qty, starts_at, ends_at } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Naam is verplicht" });
    }
    
    if (!rule_type || !['percentage', 'fixed_amount', 'volume', 'coupon', 'bundle'].includes(rule_type)) {
      return res.status(400).json({ success: false, error: "Ongeldig regel type" });
    }
    
    if (!applies_to || !['base', 'tier', 'addon', 'total'].includes(applies_to)) {
      return res.status(400).json({ success: false, error: "Ongeldig 'applies_to' waarde" });
    }
    
    const value = parseFloat(value_numeric);
    if (isNaN(value) || value < 0) {
      return res.status(400).json({ success: false, error: "Waarde moet een geldig positief getal zijn" });
    }
    
    // Insert rule
    const { data: rule, error } = await supabaseAdmin
      .from('service_discount_rules')
      .insert([{
        service_id: id,
        name: name.trim(),
        rule_type: rule_type,
        applies_to: applies_to,
        target_tier_id: target_tier_id || null,
        target_addon_id: target_addon_id || null,
        value_numeric: value,
        min_qty: min_qty ? parseFloat(min_qty) : null,
        max_qty: max_qty ? parseFloat(max_qty) : null,
        starts_at: starts_at || null,
        ends_at: ends_at || null
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'rule_added', { rule_id: rule.id, rule_name: rule.name });
    
    res.json({
      success: true,
      data: rule,
      message: "Kortingsregel succesvol toegevoegd"
    });
  } catch (err) {
    console.error("Error creating discount rule:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het aanmaken van de kortingsregel" 
    });
  }
});

// PATCH /api/admin/services/:id/discount-rules/:ruleId - Update discount rule
router.patch("/admin/services/:id/discount-rules/:ruleId", requireAuth, async (req, res) => {
  try {
    const { id, ruleId } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen kortingsregels beheren' 
      });
    }
    
    const updates = {};
    const { name, rule_type, applies_to, target_tier_id, target_addon_id, value_numeric, min_qty, max_qty, starts_at, ends_at, is_active } = req.body;
    
    if (name !== undefined) updates.name = name.trim();
    if (rule_type !== undefined) {
      if (!['percentage', 'fixed_amount', 'volume', 'coupon', 'bundle'].includes(rule_type)) {
        return res.status(400).json({ success: false, error: "Ongeldig regel type" });
      }
      updates.rule_type = rule_type;
    }
    if (applies_to !== undefined) {
      if (!['base', 'tier', 'addon', 'total'].includes(applies_to)) {
        return res.status(400).json({ success: false, error: "Ongeldig 'applies_to' waarde" });
      }
      updates.applies_to = applies_to;
    }
    if (target_tier_id !== undefined) updates.target_tier_id = target_tier_id || null;
    if (target_addon_id !== undefined) updates.target_addon_id = target_addon_id || null;
    if (value_numeric !== undefined) {
      const value = parseFloat(value_numeric);
      if (isNaN(value) || value < 0) {
        return res.status(400).json({ success: false, error: "Waarde moet een geldig positief getal zijn" });
      }
      updates.value_numeric = value;
    }
    if (min_qty !== undefined) updates.min_qty = min_qty ? parseFloat(min_qty) : null;
    if (max_qty !== undefined) updates.max_qty = max_qty ? parseFloat(max_qty) : null;
    if (starts_at !== undefined) updates.starts_at = starts_at || null;
    if (ends_at !== undefined) updates.ends_at = ends_at || null;
    if (is_active !== undefined) updates.is_active = is_active;
    
    const { data: rule, error } = await supabaseAdmin
      .from('service_discount_rules')
      .update(updates)
      .eq('id', ruleId)
      .eq('service_id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (!rule) {
      return res.status(404).json({ success: false, error: "Kortingsregel niet gevonden" });
    }
    
    // Log audit
    const action = is_active === false ? 'rule_disabled' : (is_active === true ? 'rule_enabled' : 'rule_updated');
    await logServiceAudit(id, req.user.id, action, { rule_id: rule.id, changes: updates });
    
    res.json({
      success: true,
      data: rule,
      message: "Kortingsregel succesvol bijgewerkt"
    });
  } catch (err) {
    console.error("Error updating discount rule:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het bijwerken van de kortingsregel" 
    });
  }
});

// POST /api/admin/services/:id/discount-rules/:ruleId/archive - Archive discount rule
router.post("/admin/services/:id/discount-rules/:ruleId/archive", requireAuth, async (req, res) => {
  try {
    const { id, ruleId } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen kortingsregels beheren' 
      });
    }
    
    const { data: rule, error } = await supabaseAdmin
      .from('service_discount_rules')
      .update({ is_active: false })
      .eq('id', ruleId)
      .eq('service_id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (!rule) {
      return res.status(404).json({ success: false, error: "Kortingsregel niet gevonden" });
    }
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'rule_removed', { rule_id: rule.id });
    
    res.json({
      success: true,
      data: rule,
      message: "Kortingsregel succesvol gearchiveerd"
    });
  } catch (err) {
    console.error("Error archiving discount rule:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het archiveren van de kortingsregel" 
    });
  }
});

// POST /api/admin/services/:id/delivery-templates - Create delivery template
router.post("/admin/services/:id/delivery-templates", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen leveringssjablonen beheren' 
      });
    }
    
    const { name, description, template_type, config, auto_create_on_sale, default_assignee_role, approval_required } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Naam is verplicht" });
    }
    
    if (!template_type || !['task', 'checklist', 'workflow'].includes(template_type)) {
      return res.status(400).json({ success: false, error: "Ongeldig sjabloon type" });
    }
    
    // Insert template
    const { data: template, error } = await supabaseAdmin
      .from('service_delivery_templates')
      .insert([{
        service_id: id,
        name: name.trim(),
        description: description?.trim() || null,
        template_type: template_type,
        config: config || {},
        auto_create_on_sale: auto_create_on_sale || false,
        default_assignee_role: default_assignee_role || null,
        approval_required: approval_required !== undefined ? approval_required : true
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'template_added', { template_id: template.id, template_name: template.name });
    
    res.json({
      success: true,
      data: template,
      message: "Leveringssjabloon succesvol toegevoegd"
    });
  } catch (err) {
    console.error("Error creating delivery template:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het aanmaken van het leveringssjabloon" 
    });
  }
});

// PATCH /api/admin/services/:id/delivery-templates/:templateId - Update delivery template
router.patch("/admin/services/:id/delivery-templates/:templateId", requireAuth, async (req, res) => {
  try {
    const { id, templateId } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen leveringssjablonen beheren' 
      });
    }
    
    const updates = {};
    const { name, description, template_type, config, auto_create_on_sale, default_assignee_role, approval_required } = req.body;
    
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (template_type !== undefined) {
      if (!['task', 'checklist', 'workflow'].includes(template_type)) {
        return res.status(400).json({ success: false, error: "Ongeldig sjabloon type" });
      }
      updates.template_type = template_type;
    }
    if (config !== undefined) updates.config = config;
    if (auto_create_on_sale !== undefined) updates.auto_create_on_sale = auto_create_on_sale;
    if (default_assignee_role !== undefined) updates.default_assignee_role = default_assignee_role || null;
    if (approval_required !== undefined) updates.approval_required = approval_required;
    
    const { data: template, error } = await supabaseAdmin
      .from('service_delivery_templates')
      .update(updates)
      .eq('id', templateId)
      .eq('service_id', id)
      .select()
      .single();
    
    if (error) throw error;
    if (!template) {
      return res.status(404).json({ success: false, error: "Leveringssjabloon niet gevonden" });
    }
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'template_updated', { template_id: template.id, changes: updates });
    
    res.json({
      success: true,
      data: template,
      message: "Leveringssjabloon succesvol bijgewerkt"
    });
  } catch (err) {
    console.error("Error updating delivery template:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het bijwerken van het leveringssjabloon" 
    });
  }
});

// POST /api/admin/services/:id/delivery-templates/:templateId/archive - Archive delivery template
router.post("/admin/services/:id/delivery-templates/:templateId/archive", requireAuth, async (req, res) => {
  try {
    const { id, templateId } = req.params;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    if (!userIsAdminOrManager) {
      return res.status(403).json({ 
        success: false, 
        error: 'Alleen managers en admins kunnen leveringssjablonen beheren' 
      });
    }
    
    // Delete template (or set inactive flag if we add one)
    const { error } = await supabaseAdmin
      .from('service_delivery_templates')
      .delete()
      .eq('id', templateId)
      .eq('service_id', id);
    
    if (error) throw error;
    
    // Log audit
    await logServiceAudit(id, req.user.id, 'template_removed', { template_id: templateId });
    
    res.json({
      success: true,
      message: "Leveringssjabloon succesvol verwijderd"
    });
  } catch (err) {
    console.error("Error archiving delivery template:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het verwijderen van het leveringssjabloon" 
    });
  }
});

// GET /api/admin/services/:id/analytics - Get analytics for single service
router.get("/admin/services/:id/analytics", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d', granularity = 'day' } = req.query;
    
    // Check permissions
    const userIsAdminOrManager = await isAdminOrManager(req.user);
    const userIsEmployee = !userIsAdminOrManager && req.user?.employee_status === 'active';
    
    if (!userIsAdminOrManager && !userIsEmployee) {
      return res.status(403).json({ 
        success: false, 
        error: 'Geen toegang tot analytics data' 
      });
    }
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '30d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '365d':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
    }
    
    // Get line items for this service
    const { data: lineItems, error: itemsError } = await supabaseAdmin
      .from('service_line_items')
      .select('revenue_cents, cost_cents, quantity, occurred_at, source, customer_id, tier_id, addon_id')
      .eq('service_id', id)
      .gte('occurred_at', startDate.toISOString())
      .order('occurred_at', { ascending: true });
    
    if (itemsError) throw itemsError;
    
    // Calculate KPIs
    const totalRevenue = (lineItems || []).reduce((sum, item) => sum + (item.revenue_cents || 0), 0);
    const totalCost = (lineItems || []).reduce((sum, item) => sum + (item.cost_cents || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const salesCount = (lineItems || []).length;
    const avgOrderValue = salesCount > 0 ? totalRevenue / salesCount : 0;
    
    // Breakdown by tier/addon
    const tierBreakdown = {};
    const addonBreakdown = {};
    const sourceBreakdown = {};
    
    (lineItems || []).forEach(item => {
      // Tier breakdown
      if (item.tier_id) {
        if (!tierBreakdown[item.tier_id]) {
          tierBreakdown[item.tier_id] = { revenue_cents: 0, count: 0 };
        }
        tierBreakdown[item.tier_id].revenue_cents += item.revenue_cents || 0;
        tierBreakdown[item.tier_id].count += 1;
      }
      
      // Addon breakdown
      if (item.addon_id) {
        if (!addonBreakdown[item.addon_id]) {
          addonBreakdown[item.addon_id] = { revenue_cents: 0, count: 0 };
        }
        addonBreakdown[item.addon_id].revenue_cents += item.revenue_cents || 0;
        addonBreakdown[item.addon_id].count += 1;
      }
      
      // Source breakdown
      const source = item.source || 'unknown';
      if (!sourceBreakdown[source]) {
        sourceBreakdown[source] = { revenue_cents: 0, count: 0 };
      }
      sourceBreakdown[source].revenue_cents += item.revenue_cents || 0;
      sourceBreakdown[source].count += 1;
    });
    
    // Get tier/addon names
    const tierIds = Object.keys(tierBreakdown);
    const addonIds = Object.keys(addonBreakdown);
    
    const [tiersResult, addonsResult] = await Promise.all([
      tierIds.length > 0 ? supabaseAdmin
        .from('service_price_tiers')
        .select('id, name')
        .in('id', tierIds) : Promise.resolve({ data: [] }),
      addonIds.length > 0 ? supabaseAdmin
        .from('service_addons')
        .select('id, name')
        .in('id', addonIds) : Promise.resolve({ data: [] })
    ]);
    
    const tierMap = {};
    (tiersResult.data || []).forEach(tier => {
      tierMap[tier.id] = tier.name;
    });
    
    const addonMap = {};
    (addonsResult.data || []).forEach(addon => {
      addonMap[addon.id] = addon.name;
    });
    
    // Format breakdowns
    const tierBreakdownFormatted = Object.entries(tierBreakdown).map(([tierId, data]) => ({
      tier_id: tierId,
      tier_name: tierMap[tierId] || 'Unknown',
      revenue_cents: userIsAdminOrManager ? data.revenue_cents : null,
      count: data.count
    }));
    
    const addonBreakdownFormatted = Object.entries(addonBreakdown).map(([addonId, data]) => ({
      addon_id: addonId,
      addon_name: addonMap[addonId] || 'Unknown',
      revenue_cents: userIsAdminOrManager ? data.revenue_cents : null,
      count: data.count
    }));
    
    const sourceBreakdownFormatted = Object.entries(sourceBreakdown).map(([source, data]) => ({
      source: source,
      revenue_cents: userIsAdminOrManager ? data.revenue_cents : null,
      count: data.count
    }));
    
    // Get recent line items (last 10)
    const recentItems = (lineItems || [])
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice(0, 10)
      .map(item => ({
        ...item,
        revenue_cents: userIsAdminOrManager ? item.revenue_cents : null,
        cost_cents: userIsAdminOrManager ? item.cost_cents : null
      }));
    
    res.json({
      success: true,
      data: {
        kpis: {
          total_revenue_cents: userIsAdminOrManager ? totalRevenue : null,
          total_profit_cents: userIsAdminOrManager ? totalProfit : null,
          margin_percent: userIsAdminOrManager ? marginPercent : null,
          sales_count: salesCount,
          avg_order_value_cents: userIsAdminOrManager ? avgOrderValue : null
        },
        breakdown: {
          by_tier: tierBreakdownFormatted,
          by_addon: addonBreakdownFormatted,
          by_source: sourceBreakdownFormatted
        },
        recent_items: recentItems
      },
      period: period,
      granularity: granularity
    });
  } catch (err) {
    console.error("Error fetching service analytics:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Er is een fout opgetreden bij het ophalen van analytics data" 
    });
  }
});

router.delete("/admin/industries/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const industryId = req.params.id;

    // Check if industry is in use
    const { data: leadsCount, error: countError } = await supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('industry_id', industryId);

    if (countError) throw countError;

    if (leadsCount && leadsCount.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Deze branche kan niet worden verwijderd omdat er leads aan gekoppeld zijn"
      });
    }

    const { error } = await supabaseAdmin
      .from('industries')
      .delete()
      .eq('id', industryId);

    if (error) throw error;

    res.json({
      success: true,
      message: "Branche succesvol verwijderd"
    });
  } catch (err) {
    console.error("Error deleting industry:", err);
    res.status(500).json({ 
      success: false, 
      error: "Er is een fout opgetreden bij het verwijderen van de branche" 
    });
  }
});

// Admin Billing API routes
router.get("/admin/billing/snapshot/:userId", requireAuth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase.rpc('get_billing_snapshot', {
      p_user: userId
    });
    
    if (error) {
      console.error('Billing snapshot error:', error);
      return res.status(500).json({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to get billing snapshot' 
        } 
      });
    }
    
    res.json({ snapshot: data });
  } catch (error) {
    console.error('Billing snapshot error:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to get billing snapshot' 
      } 
    });
  }
});

router.put("/admin/subscription/quota/:userId", requireAuth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { leadsPerMonth } = req.body;
    
    // Validate input
    if (typeof leadsPerMonth !== 'number' || leadsPerMonth < 0 || leadsPerMonth > 100000) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Invalid leadsPerMonth value' 
        } 
      });
    }
    
    // Check if user has an active subscription
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('id, leads_per_month')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (fetchError) {
      console.error('Error fetching subscription:', fetchError);
      return res.status(500).json({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch subscription' 
        } 
      });
    }
    
    if (existingSubscription) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ leads_per_month: leadsPerMonth })
        .eq('id', existingSubscription.id);
      
      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return res.status(500).json({ 
          error: { 
            code: 'INTERNAL_ERROR', 
            message: 'Failed to update subscription' 
          } 
        });
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          leads_per_month: leadsPerMonth,
          status: 'active'
        });
      
      if (insertError) {
        console.error('Error creating subscription:', insertError);
        return res.status(500).json({ 
          error: { 
            code: 'INTERNAL_ERROR', 
            message: 'Failed to create subscription' 
          } 
        });
      }
    }
    
    res.json({ ok: true, leadsPerMonth });
  } catch (error) {
    console.error('Quota update error:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to update quota' 
      } 
    });
  }
});

router.post("/admin/leads/allocate-check/:userId", requireAuth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { price } = req.body;
    
    // Validate input
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Invalid price value' 
        } 
      });
    }
    
    const { data, error } = await supabase.rpc('can_allocate_lead', {
      p_user: userId,
      p_price: price
    });
    
    if (error) {
      console.error('Allocation check error:', error);
      return res.status(500).json({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to check allocation' 
        } 
      });
    }
    
    res.json({ result: data });
  } catch (error) {
    console.error('Allocation check error:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to check allocation' 
      } 
    });
  }
});

// Get user permissions
router.get("/permissions", requireAuth, getUserPermissions);

// Original billing routes (for user self-service)

router.use('/subscriptions', subscriptionsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/webhooks', webhooksRoutes);

// Get current user industry preferences
router.get("/users/current/industry-preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Use supabaseAdmin to bypass RLS and ensure it works even if profile doesn't exist yet
    const { data: preferences, error } = await supabaseAdmin
      .from('user_industry_preferences')
      .select(`
        industry_id,
        is_enabled,
        industries (
          id,
          name,
          is_active
        )
      `)
      .eq('user_id', userId);
    
    // If error, just log it and continue with empty preferences
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user industry preferences:', error);
    }
    
    // Also get all available industries
    const { data: allIndustries, error: industriesError } = await supabaseAdmin
      .from('industries')
      .select('id, name, description, price_per_lead, is_active')
      .eq('is_active', true)
      .order('name');
    
    if (industriesError) {
      console.error('Error fetching industries:', industriesError);
      return res.status(500).json({ error: 'Failed to get industries' });
    }
    
    // Create a map of user preferences (handle null/undefined preferences)
    const preferenceMap = {};
    if (preferences && Array.isArray(preferences)) {
      preferences.forEach(pref => {
        preferenceMap[pref.industry_id] = pref.is_enabled;
      });
    }
    
    // Combine with all industries
    const result = (allIndustries || []).map(industry => ({
      industry_id: industry.id,
      industry_name: industry.name,
      industry_description: industry.description,
      industry_price: industry.price_per_lead,
      is_enabled: preferenceMap[industry.id] || false
    }));
    
    res.json(result);
    
  } catch (error) {
    console.error('Error getting current user industry preferences:', error);
    res.status(500).json({ error: 'Failed to get user industry preferences' });
  }
});

// Update current user industry preferences
router.post("/users/current/industry-preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;
    
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Preferences must be an array' });
    }
    
    // Upsert all preferences so disabled rows remain and updated_at is tracked
    const preferencesToUpsert = preferences.map(pref => ({
      user_id: userId,
      industry_id: pref.industry_id,
      is_enabled: !!pref.is_enabled
    }));
    
    const { error: upsertError } = await supabase
      .from('user_industry_preferences')
      .upsert(preferencesToUpsert, { onConflict: 'user_id,industry_id' });
    
    if (upsertError) throw upsertError;
    
    // Sync segments for this user (async, don't block response)
    try {
      const SegmentSyncService = require('../services/segmentSyncService');
      SegmentSyncService.syncSegmentsForUser(userId).catch(err => {
        console.error('Error syncing segments after industry preference update:', err);
      });
    } catch (syncError) {
      console.error('Error triggering segment sync:', syncError);
      // Don't fail the request if sync fails
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error updating current user industry preferences:', error);
    res.status(500).json({ error: 'Failed to update user industry preferences' });
  }
});

// Get all industries - User version (simplified)
router.get("/industries", requireAuth, async (req, res) => {
  try {
    const { data: industries, error } = await supabase
      .from('industries')
      .select('id, name, description, price_per_lead, is_active')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: industries || []
    });
    
  } catch (error) {
    console.error('Error getting industries:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get industries' 
    });
  }
});

// Get user quota information
router.get("/users/:userId/quota", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's subscription info
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('leads_per_month, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (subError && subError.code !== 'PGRST116') {
      throw subError;
    }
    
    const quota = subscription ? subscription.leads_per_month : 0;
    
    // Get current month usage from v_monthly_lead_usage view (same source as /assignable)
    const { data: usage, error: usageError } = await supabase
      .from('v_monthly_lead_usage')
      .select('approved_count')
      .eq('user_id', userId)
      .single();
    
    if (usageError && usageError.code !== 'PGRST116') {
      throw usageError;
    }
    
    const used = usage ? usage.approved_count : 0;
    const remaining = Math.max(0, quota - used);
    const canReceiveMore = used < quota;
    
    res.json({
      success: true,
      data: {
        quota,
        used,
        remaining,
        canReceiveMore
      }
    });
    
  } catch (error) {
    console.error('Error getting user quota:', error);
    res.status(500).json({ success: false, error: 'Failed to get user quota' });
  }
});

// Get user industry preferences
router.get("/users/:userId/industry-preferences", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: preferences, error } = await supabase
      .from('user_industry_preferences')
      .select(`
        industry_id,
        is_enabled,
        industries (
          id,
          name,
          is_active
        )
      `)
      .eq('user_id', userId);
    
    if (error) throw error;
    
    // Also get all available industries
    const { data: allIndustries, error: industriesError } = await supabase
      .from('industries')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name');
    
    if (industriesError) throw industriesError;
    
    // Create a map of user preferences
    const preferenceMap = {};
    preferences.forEach(pref => {
      preferenceMap[pref.industry_id] = pref.is_enabled;
    });
    
    // Combine with all industries
    const result = allIndustries.map(industry => ({
      industry_id: industry.id,
      industry_name: industry.name,
      is_enabled: preferenceMap[industry.id] || false
    }));
    
    res.json(result);
    
  } catch (error) {
    console.error('Error getting user industry preferences:', error);
    res.status(500).json({ error: 'Failed to get user industry preferences' });
  }
});

// Update user industry preferences
router.post("/users/:userId/industry-preferences", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences } = req.body;
    
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Preferences must be an array' });
    }
    
    // Upsert all preferences so disabled rows remain and updated_at is tracked
    const preferencesToUpsert = preferences.map(pref => ({
      user_id: userId,
      industry_id: pref.industry_id,
      is_enabled: !!pref.is_enabled
    }));
    
    const { error: upsertError } = await supabase
      .from('user_industry_preferences')
      .upsert(preferencesToUpsert, { onConflict: 'user_id,industry_id' });
    
    if (upsertError) throw upsertError;
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error updating user industry preferences:', error);
    res.status(500).json({ error: 'Failed to update user industry preferences' });
  }
});

// Get current user location preferences
router.get("/users/current/location-preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Define available Dutch provinces/regions
    const availableLocations = [
      { code: 'noord-holland', name: 'Noord-Holland', icon: 'fas fa-map-marker-alt' },
      { code: 'zuid-holland', name: 'Zuid-Holland', icon: 'fas fa-map-marker-alt' },
      { code: 'noord-brabant', name: 'Noord-Brabant', icon: 'fas fa-map-marker-alt' },
      { code: 'gelderland', name: 'Gelderland', icon: 'fas fa-map-marker-alt' },
      { code: 'utrecht', name: 'Utrecht', icon: 'fas fa-map-marker-alt' },
      { code: 'friesland', name: 'Friesland', icon: 'fas fa-map-marker-alt' },
      { code: 'overijssel', name: 'Overijssel', icon: 'fas fa-map-marker-alt' },
      { code: 'groningen', name: 'Groningen', icon: 'fas fa-map-marker-alt' },
      { code: 'drenthe', name: 'Drenthe', icon: 'fas fa-map-marker-alt' },
      { code: 'flevoland', name: 'Flevoland', icon: 'fas fa-map-marker-alt' },
      { code: 'limburg', name: 'Limburg', icon: 'fas fa-map-marker-alt' },
      { code: 'zeeland', name: 'Zeeland', icon: 'fas fa-map-marker-alt' }
    ];
    
    // Get user preferences from user_location_preferences table
    // Use supabaseAdmin to bypass RLS and ensure it works even if profile doesn't exist yet
    const { data: preferences, error: prefError } = await supabaseAdmin
      .from('user_location_preferences')
      .select('location_code, location_name, is_enabled')
      .eq('user_id', userId);
    
    // If table doesn't exist or error, fallback to profiles.lead_locations (backwards compatibility)
    if (prefError && prefError.code === '42P01') {
      // Table doesn't exist yet, use profiles.lead_locations as fallback
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('lead_locations')
        .eq('id', userId)
        .maybeSingle();
      
      // If profile doesn't exist, return all locations as disabled
      if (profileError && profileError.code === 'PGRST116') {
        const result = availableLocations.map(location => ({
          location_code: location.code,
          location_name: location.name,
          location_icon: location.icon,
          is_enabled: false
        }));
        return res.json(result);
      }
      
      if (profileError) throw profileError;
      
      const currentLocations = profile?.lead_locations || [];
      
      // Map to include enabled status
      const result = availableLocations.map(location => ({
        location_code: location.code,
        location_name: location.name,
        location_icon: location.icon,
        is_enabled: currentLocations.includes(location.code) || currentLocations.includes(location.name)
      }));
      
      return res.json(result);
    }
    
    // If other error, log but don't fail - return empty preferences
    if (prefError) {
      console.error('Error fetching location preferences:', prefError);
      // Return all locations as disabled
      const result = availableLocations.map(location => ({
        location_code: location.code,
        location_name: location.name,
        location_icon: location.icon,
        is_enabled: false
      }));
      return res.json(result);
    }
    
    // Create a map of user preferences
    const preferenceMap = {};
    if (preferences) {
      preferences.forEach(pref => {
        preferenceMap[pref.location_code] = pref.is_enabled;
      });
    }
    
    // Combine with all available locations
    const result = availableLocations.map(location => ({
      location_code: location.code,
      location_name: location.name,
      location_icon: location.icon,
      is_enabled: preferenceMap[location.code] || false
    }));
    
    res.json(result);
    
  } catch (error) {
    console.error('Error getting current user location preferences:', error);
    res.status(500).json({ error: 'Failed to get user location preferences' });
  }
});

// Update current user location preferences
router.post("/users/current/location-preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;
    
    console.log('📍 Location preferences update request:', {
      userId,
      preferencesCount: preferences?.length,
      preferences: preferences
    });
    
    if (!Array.isArray(preferences)) {
      console.error('❌ Invalid preferences format:', typeof preferences);
      return res.status(400).json({ error: 'Preferences must be an array' });
    }
    
    // Define available locations for validation
    const availableLocations = [
      { code: 'noord-holland', name: 'Noord-Holland' },
      { code: 'zuid-holland', name: 'Zuid-Holland' },
      { code: 'noord-brabant', name: 'Noord-Brabant' },
      { code: 'gelderland', name: 'Gelderland' },
      { code: 'utrecht', name: 'Utrecht' },
      { code: 'friesland', name: 'Friesland' },
      { code: 'overijssel', name: 'Overijssel' },
      { code: 'groningen', name: 'Groningen' },
      { code: 'drenthe', name: 'Drenthe' },
      { code: 'flevoland', name: 'Flevoland' },
      { code: 'limburg', name: 'Limburg' },
      { code: 'zeeland', name: 'Zeeland' }
    ];
    
    // Create location map for name lookup
    const locationMap = {};
    availableLocations.forEach(loc => {
      locationMap[loc.code] = loc.name;
      locationMap[loc.name.toLowerCase()] = loc.name;
    });
    
    // Prepare preferences to upsert
    const preferencesToUpsert = preferences.map(pref => {
      const locationCode = pref.location_code || pref.location_name?.toLowerCase().replace(/\s+/g, '-');
      const locationName = pref.location_name || locationMap[locationCode] || locationCode;
      
      return {
        user_id: userId,
        location_code: locationCode,
        location_name: locationName,
        is_enabled: !!pref.is_enabled
      };
    });
    
    // Try to upsert in user_location_preferences table
    // Use supabaseAdmin to ensure it works (user is already authenticated via requireAuth middleware)
    const { error: upsertError } = await supabaseAdmin
      .from('user_location_preferences')
      .upsert(preferencesToUpsert, { 
        onConflict: 'user_id,location_code'
      });
    
    // If table doesn't exist, fallback to profiles.lead_locations (backwards compatibility)
    if (upsertError && upsertError.code === '42P01') {
      // Table doesn't exist yet, use profiles.lead_locations as fallback
      const enabledLocations = preferences
        .filter(pref => pref.is_enabled === true || pref.is_enabled === 'true')
        .map(pref => pref.location_code || pref.location_name?.toLowerCase().replace(/\s+/g, '-'));
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          lead_locations: enabledLocations,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error('Error updating profiles.lead_locations:', updateError);
        throw updateError;
      }
      
      return res.json({ success: true, data: { locations: enabledLocations } });
    }
    
    if (upsertError) {
      console.error('❌ Error upserting user_location_preferences:');
      console.error('   Message:', upsertError.message);
      console.error('   Code:', upsertError.code);
      console.error('   Details:', upsertError.details);
      console.error('   Hint:', upsertError.hint);
      console.error('   Preferences to upsert:', JSON.stringify(preferencesToUpsert, null, 2));
      
      // Return detailed error for debugging
      return res.status(500).json({ 
        error: 'Failed to update user location preferences',
        details: upsertError.message,
        code: upsertError.code
      });
    }
    
    console.log('✅ Location preferences updated successfully');
    
    // Sync segments for this user (async, don't block response)
    try {
      const SegmentSyncService = require('../services/segmentSyncService');
      SegmentSyncService.syncSegmentsForUser(userId).catch(err => {
        console.error('Error syncing segments after location preference update:', err);
      });
    } catch (syncError) {
      console.error('Error triggering segment sync:', syncError);
      // Don't fail the request if sync fails
    }
    
    // Trigger will automatically sync profiles.lead_locations
    res.json({ success: true, data: { message: 'Location preferences updated' } });
    
  } catch (error) {
    console.error('❌ Fatal error updating current user location preferences:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to update user location preferences',
      details: error.message
    });
  }
});

// Get active pauses (admin only)
router.get("/admin/active-pauses", requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: "Admin toegang vereist" })
    }

    const PauseExpiryService = require('../services/pauseExpiryService')
    const activePauses = await PauseExpiryService.getActivePausesWithExpiry()

    res.json({
      success: true,
      data: activePauses,
      count: activePauses.length
    })
  } catch (err) {
    console.error("Error fetching active pauses:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van actieve pauses" })
  }
})

// Manually check and resume expired pauses (admin only)
router.post("/admin/check-expired-pauses", requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: "Admin toegang vereist" })
    }

    const PauseExpiryService = require('../services/pauseExpiryService')
    const resumedPauses = await PauseExpiryService.checkAndResumeExpiredPauses()

    res.json({
      success: true,
      data: resumedPauses,
      count: resumedPauses.length,
      message: `${resumedPauses.length} verlopen pauses zijn automatisch opgeheven`
    })
  } catch (err) {
    console.error("Error checking expired pauses:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het controleren van verlopen pauses" })
  }
})

// POST /api/subscriptions - Create Mollie subscription
router.post('/subscriptions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, interval = '1 month', description } = req.body;
    
    console.log('Creating subscription for user:', userId);

    // Validate required fields
    if (!amount || !amount.currency || !amount.value) {
      return res.status(400).json({
        success: false,
        error: 'Amount with currency and value is required'
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, mollie_customer_id, company_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return res.status(404).json({
        success: false,
        error: 'Gebruiker niet gevonden'
      });
    }

    // Check if user has valid SEPA mandate
    const { data: mandates, error: mandateError } = await supabaseAdmin
      .from('payment_methods')
      .select('provider_payment_method_id, type')
      .eq('user_id', userId)
      .eq('type', 'sepa')
      .eq('provider', 'mollie')
      .single();
      
    if (mandateError || !mandates) {
      return res.status(400).json({
        success: false,
        error: 'Geen geldige SEPA mandate gevonden. Voeg eerst een SEPA mandate toe.'
      });
    }

    const mandateId = mandates.provider_payment_method_id;
    const { mollieClient } = require('../lib/mollie');

    // Verify mandate is still valid in Mollie
    try {
      const mandate = await mollieClient.customers_mandates.get({
        customerId: profile.mollie_customer_id,
        mandateId: mandateId
      });
      
      if (mandate.status !== 'valid') {
        return res.status(400).json({
          success: false,
          error: `SEPA mandate is niet geldig (status: ${mandate.status})`
        });
      }
    } catch (mandateCheckError) {
      return res.status(400).json({
        success: false,
        error: `SEPA mandate verificatie mislukt: ${mandateCheckError.message}`
      });
    }

    // Create Mollie subscription
    const idempotencyKey = `subscription_${userId}_${Date.now()}`;
    
    const mollieSubscription = await mollieClient.customers_subscriptions.create({
      customerId: profile.mollie_customer_id,
      amount: {
        currency: amount.currency,
        value: amount.value
      },
      interval: interval,
      description: description || `GrowSocial Leads - ${profile.company_name}`,
      mandateId: mandateId,
      metadata: {
        user_id: userId,
        company_name: profile.company_name
      },
      idempotencyKey: idempotencyKey
    });

    console.log('Created Mollie subscription:', mollieSubscription.id);

    // Store subscription in database
    const { data: subscriptionRecord, error: dbError } = await supabaseAdmin
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        subscription_id: null, // We'll need to create a subscription record first
        mollie_subscription_id: mollieSubscription.id,
        status: 'active',
        amount: parseFloat(amount.value),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error storing subscription:', dbError);
      throw dbError;
    }

    res.json({
      success: true,
      subscription: {
        id: mollieSubscription.id,
        status: mollieSubscription.status,
        amount: mollieSubscription.amount,
        interval: mollieSubscription.interval,
        description: mollieSubscription.description,
        customerId: profile.mollie_customer_id,
        mandateId: mandateId
      },
      databaseRecord: subscriptionRecord
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    
    // Check if it's a SEPA activation error
    if (error.message && error.message.includes('not activated')) {
      return res.status(400).json({
        success: false,
        error: 'SEPA Direct Debit is niet geactiveerd in je Mollie account. Activeer SEPA Direct Debit in je Mollie Dashboard → Settings → Payment methods.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het aanmaken van de subscription'
    });
  }
});

// POST /api/billing/charge - Create recurring payment (ad-hoc)
router.post('/billing/charge', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, description } = req.body;
    
    console.log('Creating recurring charge for user:', userId);

    // Validate required fields
    if (!amount || !amount.currency || !amount.value) {
      return res.status(400).json({
        success: false,
        error: 'Amount with currency and value is required'
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, mollie_customer_id, company_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return res.status(404).json({
        success: false,
        error: 'Gebruiker niet gevonden'
      });
    }

    // Check if user has valid SEPA mandate
    const { data: mandates, error: mandateError } = await supabaseAdmin
      .from('payment_methods')
      .select('provider_payment_method_id, type')
      .eq('user_id', userId)
      .eq('type', 'sepa')
      .eq('provider', 'mollie')
      .single();
      
    if (mandateError || !mandates) {
      return res.status(400).json({
        success: false,
        error: 'Geen geldige SEPA mandate gevonden. Voeg eerst een SEPA mandate toe.'
      });
    }

    const mandateId = mandates.provider_payment_method_id;
    const { mollieClient } = require('../lib/mollie');

    // Verify mandate is still valid in Mollie
    try {
      const mandate = await mollieClient.customers_mandates.get({
        customerId: profile.mollie_customer_id,
        mandateId: mandateId
      });
      
      if (mandate.status !== 'valid') {
        return res.status(400).json({
          success: false,
          error: `SEPA mandate is niet geldig (status: ${mandate.status})`
        });
      }
    } catch (mandateCheckError) {
      return res.status(400).json({
        success: false,
        error: `SEPA mandate verificatie mislukt: ${mandateCheckError.message}`
      });
    }

    // Create recurring payment with proper sequenceType
    const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'https://growsocialmedia.nl';
    const redirectUrl = `${baseUrl}/dashboard/payments?billing_success=true&recurring=true`;
    
    const idempotencyKey = `payment_${userId}_${Date.now()}`;
    
    const payment = await mollieClient.payments.create({
      amount: {
        currency: amount.currency,
        value: amount.value
      },
      description: description || `GrowSocial Leads - ${profile.company_name}`,
      customerId: profile.mollie_customer_id,
      mandateId: mandateId,
      sequenceType: 'recurring', // CRITICAL: This makes it recurring
      redirectUrl: redirectUrl,
      webhookUrl: `${baseUrl}/api/webhooks/mollie`,
      metadata: {
        user_id: userId,
        company_name: profile.company_name,
        billing_type: 'manual_recurring_charge',
        billing_date: new Date().toISOString().split('T')[0]
      },
      idempotencyKey: idempotencyKey
    });

    console.log('Created recurring payment:', payment.id);

    res.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        description: payment.description,
        customerId: profile.mollie_customer_id,
        mandateId: mandateId,
        sequenceType: 'recurring'
      }
    });

  } catch (error) {
    console.error('Error creating recurring charge:', error);
    
    // Check if it's a SEPA activation error
    if (error.message && error.message.includes('not activated')) {
      return res.status(400).json({
        success: false,
        error: 'SEPA Direct Debit is niet geactiveerd in je Mollie account. Activeer SEPA Direct Debit in je Mollie Dashboard → Settings → Payment methods.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het aanmaken van de recurring charge'
    });
  }
});

// Health check endpoint for Mollie configuration
router.get('/health/mollie', async (req, res) => {
  try {
    const { mollieClient } = require('../lib/mollie');
    
    // Get current profile
    const profile = await mollieClient.profiles.getCurrent();
    
    // Get available payment methods
    const methods = await mollieClient.methods.list();
    const sepaAvailable = methods.some(method => method.id === 'directdebit');
    
    // Test mandate creation (dry run)
    let mandateTest = { success: false, error: null };
    try {
      // This will fail if SEPA is not activated, but won't create anything
      await mollieClient.methods.get('directdebit');
      mandateTest.success = true;
    } catch (error) {
      mandateTest.error = error.message;
    }
    
    // Get webhook URL
    const webhookUrl = process.env.MOLLIE_WEBHOOK_URL || `${process.env.APP_URL}/api/webhooks/mollie`;
    
    res.json({
      success: true,
      mollie: {
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          mode: profile.mode
        },
        paymentMethods: {
          sepaAvailable: sepaAvailable,
          availableMethods: methods.map(m => ({ id: m.id, description: m.description })),
          mandateTest: mandateTest
        },
        configuration: {
          apiKeyPrefix: process.env.MOLLIE_API_KEY ? process.env.MOLLIE_API_KEY.substring(0, 8) + '...' : 'Not set',
          profileId: process.env.MOLLIE_PROFILE_ID || 'Not set',
          webhookUrl: webhookUrl,
          environment: process.env.NODE_ENV
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// ONBOARDING ENDPOINTS
// =====================================================

// Bootstrap endpoint for dashboard - returns all common data in one request
router.get("/dashboard/bootstrap", requireAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const userId = req.user.id;
    
    // Fetch all data in parallel
    const [
      unreadCountResult,
      onboardingStatusResult,
      settingsResult
    ] = await Promise.all([
      // Unread messages count
      supabase
        .from('leads')
        .select('id')
        .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
        .then(async ({ data: userLeads, error: leadsError }) => {
          if (leadsError || !userLeads || userLeads.length === 0) {
            return { success: true, count: 0 };
          }
          
          const leadIds = userLeads.map(l => l.id);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const { data: recentMessages, error: messagesError } = await supabase
            .from('lead_activities')
            .select('id, lead_id, created_by, created_at')
            .eq('type', 'message')
            .in('lead_id', leadIds)
            .neq('created_by', userId)
            .gte('created_at', sevenDaysAgo.toISOString());
          
          if (messagesError) {
            return { success: true, count: 0 };
          }
          
          const leadsWithUnread = new Set(recentMessages?.map(m => m.lead_id) || []);
          return { success: true, count: leadsWithUnread.size };
        })
        .catch(err => {
          console.error('Error fetching unread count in bootstrap:', err);
          return { success: true, count: 0 };
        }),
      // Onboarding status
      supabase
        .rpc('get_onboarding_status', { p_user_id: userId })
        .then(({ data, error }) => {
          if (error) throw error;
          return { success: true, data: data };
        })
        .catch(err => {
          console.error('Error fetching onboarding status in bootstrap:', err);
          return { success: false, data: null, error: err.message };
        }),
      // Settings
      supabaseAdmin
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single()
        .then(({ data: settings, error }) => {
          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
          }
          
          // Use getSettingsForUser logic for defaults
          let finalSettings = settings;
          if (!finalSettings) {
            finalSettings = { 
              lead_limit: 10, 
              notifications_enabled: 1, 
              paused: 0, 
              two_factor_enabled: 0, 
              new_lead_notification: 1, 
              payment_notification: 1, 
              account_notification: 1, 
              marketing_notification: 0,
              quota_warning_notification: 1,
              quota_reached_notification: 1,
              lead_assigned_notification: 1,
              lead_status_changed_notification: 0,
              subscription_expiring_notification: 1,
              subscription_expired_notification: 1,
              login_from_new_device_notification: 1,
              whatsapp_notification_enabled: 0
            };
          }
          
          // Normalize two_factor_enabled
          if (finalSettings.two_factor_enabled === true || finalSettings.two_factor_enabled === 'true' || finalSettings.two_factor_enabled === '1' || finalSettings.two_factor_enabled === 1) {
            finalSettings.two_factor_enabled = 1;
          } else {
            finalSettings.two_factor_enabled = 0;
          }
          
          // Ensure all fields exist
          if (!finalSettings.new_lead_notification) finalSettings.new_lead_notification = 0;
          if (!finalSettings.payment_notification) finalSettings.payment_notification = 0;
          if (finalSettings.account_notification === undefined || finalSettings.account_notification === null) finalSettings.account_notification = 1;
          if (finalSettings.marketing_notification === undefined || finalSettings.marketing_notification === null) finalSettings.marketing_notification = 0;
          if (finalSettings.quota_warning_notification === undefined || finalSettings.quota_warning_notification === null) finalSettings.quota_warning_notification = 1;
          if (finalSettings.quota_reached_notification === undefined || finalSettings.quota_reached_notification === null) finalSettings.quota_reached_notification = 1;
          if (finalSettings.lead_assigned_notification === undefined || finalSettings.lead_assigned_notification === null) finalSettings.lead_assigned_notification = 1;
          if (finalSettings.lead_status_changed_notification === undefined || finalSettings.lead_status_changed_notification === null) finalSettings.lead_status_changed_notification = 0;
          if (finalSettings.subscription_expiring_notification === undefined || finalSettings.subscription_expiring_notification === null) finalSettings.subscription_expiring_notification = 1;
          if (finalSettings.subscription_expired_notification === undefined || finalSettings.subscription_expired_notification === null) finalSettings.subscription_expired_notification = 1;
          if (finalSettings.login_from_new_device_notification === undefined || finalSettings.login_from_new_device_notification === null) finalSettings.login_from_new_device_notification = 1;
          if (finalSettings.whatsapp_notification_enabled === undefined || finalSettings.whatsapp_notification_enabled === null) finalSettings.whatsapp_notification_enabled = 0;
          
          return { success: true, settings: finalSettings };
        })
        .catch(err => {
          console.error('Error fetching settings in bootstrap:', err);
          return {
            success: false,
            settings: {
              lead_limit: 10,
              notifications_enabled: 1,
              paused: 0,
              two_factor_enabled: 0
            },
            error: err.message
          };
        })
    ]);

    const loadTime = Date.now() - startTime;
    console.log(`✅ /dashboard/bootstrap loaded in ${loadTime}ms`);

    res.json({
      success: true,
      unreadCount: unreadCountResult.count || 0,
      onboardingStatus: onboardingStatusResult.success ? onboardingStatusResult.data : null,
      settings: settingsResult.success ? settingsResult.settings : {
        lead_limit: 10,
        notifications_enabled: 1,
        paused: 0,
        two_factor_enabled: 0
      },
      loadTime: loadTime
    });
  } catch (err) {
    console.error('Dashboard bootstrap error:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het ophalen van bootstrap data'
    });
  }
});

// Get onboarding status
router.get("/onboarding/status", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Use the database function to get onboarding status
    const { data, error } = await supabase
      .rpc('get_onboarding_status', { p_user_id: userId });

    if (error) {
      console.error('Error getting onboarding status:', error);
      throw error;
    }

    res.json({
      success: true,
      data: data
    });
  } catch (err) {
    console.error('Error in /onboarding/status:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het ophalen van de onboarding status'
    });
  }
});

// Update onboarding step
router.post("/onboarding/step", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { step, data } = req.body;

    if (typeof step !== 'number' || step < 0 || step > 99) {
      return res.status(400).json({
        success: false,
        error: 'Ongeldige stap waarde'
      });
    }

    // Use the database function to update onboarding step
    const { data: result, error } = await supabase
      .rpc('update_onboarding_step', {
        p_user_id: userId,
        p_step: step,
        p_data: data || null
      });

    if (error) {
      console.error('Error updating onboarding step:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'Onboarding stap bijgewerkt',
      data: { step }
    });
  } catch (err) {
    console.error('Error in /onboarding/step:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het bijwerken van de onboarding stap'
    });
  }
});

// Save onboarding data
router.post("/onboarding", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      companyName,
      phone,
      referralSource,
      referralNote,
      industries,
      locations,
      leadTypes,
      budgetMin,
      budgetMax,
      notifications,
      kvkNumber,
      street,
      postalCode,
      city,
      country
    } = req.body;

    // Prepare update data
    const updateData = {};

    if (firstName !== undefined) updateData.first_name = firstName || null;
    if (lastName !== undefined) updateData.last_name = lastName || null;
    if (companyName !== undefined) updateData.company_name = companyName || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (referralSource !== undefined) updateData.referral_source = referralSource || null;
    if (referralNote !== undefined) updateData.referral_note = referralNote || null;
    if (industries !== undefined) updateData.lead_industries = Array.isArray(industries) ? industries : [];
    if (locations !== undefined) updateData.lead_locations = Array.isArray(locations) ? locations : [];
    if (leadTypes !== undefined) updateData.lead_types = Array.isArray(leadTypes) ? leadTypes : [];
    if (budgetMin !== undefined) updateData.lead_budget_min = budgetMin ? parseFloat(budgetMin) : null;
    if (budgetMax !== undefined) updateData.lead_budget_max = budgetMax ? parseFloat(budgetMax) : null;
    if (notifications !== undefined) updateData.notify_channels = Array.isArray(notifications) ? notifications : ['inapp'];
    if (kvkNumber !== undefined) updateData.coc_number = kvkNumber || null;
    if (street !== undefined) updateData.street = street || null;
    if (postalCode !== undefined) updateData.postal_code = postalCode || null;
    if (city !== undefined) updateData.city = city || null;
    if (country !== undefined) updateData.country = country || null;

    // KVK Verification (if KVK number is provided and KVK API is available)
    let kvkVerificationResult = null;
    let kvkVerificationErrors = [];
    
    if (kvkNumber && kvkNumber.trim() && KvkApiService.isAvailable()) {
      try {
        console.log(`🔍 Verifying KVK number for user ${userId}: ${kvkNumber}`);
        
        // Verify KVK number
        const verification = await KvkApiService.verifyKvkNumber(kvkNumber.trim());
        
        if (verification.valid && verification.exists && verification.profile) {
          // KVK number is valid and company exists
          const kvkProfile = verification.profile;
          
          // Prepare user data for comparison
          const userData = {
            company_name: companyName || '',
            postal_code: postalCode || '',
            city: city || '',
            street: street || ''
          };
          
          // Compare user data with KVK data
          const comparison = KvkApiService.compareWithKvkData(userData, kvkProfile);
          
          // Store KVK verification data
          updateData.kvk_verified = true;
          updateData.kvk_verified_at = new Date().toISOString();
          updateData.kvk_company_name = kvkProfile.companyName || null;
          updateData.kvk_founding_date = kvkProfile.foundingDate || null;
          updateData.kvk_status = kvkProfile.status || null;
          updateData.kvk_data = kvkProfile.rawData || null;
          
          // Check for mismatches
          updateData.kvk_name_mismatch = !!comparison.mismatches.companyName;
          updateData.kvk_address_mismatch = !!(comparison.mismatches.postalCode || comparison.mismatches.city);
          
          kvkVerificationResult = {
            verified: true,
            exists: true,
            matches: comparison.matches,
            mismatches: comparison.mismatches,
            score: comparison.score,
            profile: {
              companyName: kvkProfile.companyName,
              status: kvkProfile.status,
              foundingDate: kvkProfile.foundingDate
            }
          };
          
          console.log(`✅ KVK verification successful for user ${userId}:`, {
            verified: true,
            companyName: kvkProfile.companyName,
            status: kvkProfile.status,
            nameMatch: !comparison.mismatches.companyName,
            addressMatch: !comparison.mismatches.postalCode && !comparison.mismatches.city
          });
          
          // Log warnings for mismatches
          if (comparison.mismatches.companyName) {
            console.warn(`⚠️ KVK name mismatch for user ${userId}:`, {
              user: userData.company_name,
              kvk: kvkProfile.companyName
            });
            kvkVerificationErrors.push({
              type: 'name_mismatch',
              message: 'Bedrijfsnaam komt niet overeen met KVK gegevens',
              userValue: userData.company_name,
              kvkValue: kvkProfile.companyName
            });
          }
          
          if (comparison.mismatches.postalCode || comparison.mismatches.city) {
            console.warn(`⚠️ KVK address mismatch for user ${userId}:`, {
              user: { postalCode: userData.postal_code, city: userData.city },
              kvk: { postalCode: kvkProfile.address?.postalCode, city: kvkProfile.address?.city }
            });
            kvkVerificationErrors.push({
              type: 'address_mismatch',
              message: 'Adres komt niet overeen met KVK gegevens',
              userValue: { postalCode: userData.postal_code, city: userData.city },
              kvkValue: { postalCode: kvkProfile.address?.postalCode, city: kvkProfile.address?.city }
            });
          }
          
        } else if (verification.valid && !verification.exists) {
          // KVK number format is valid but company doesn't exist
          console.warn(`⚠️ KVK number not found in KVK database for user ${userId}: ${kvkNumber}`);
          updateData.kvk_verified = false;
          updateData.kvk_verified_at = new Date().toISOString();
          kvkVerificationResult = {
            verified: false,
            exists: false,
            error: verification.error || 'KVK nummer niet gevonden in KVK database'
          };
          kvkVerificationErrors.push({
            type: 'not_found',
            message: 'KVK nummer niet gevonden in KVK database'
          });
        } else {
          // Invalid KVK number format
          console.warn(`⚠️ Invalid KVK number format for user ${userId}: ${kvkNumber}`);
          updateData.kvk_verified = false;
          kvkVerificationResult = {
            verified: false,
            exists: false,
            error: verification.error || 'Ongeldig KVK nummer formaat'
          };
          kvkVerificationErrors.push({
            type: 'invalid_format',
            message: verification.error || 'Ongeldig KVK nummer formaat'
          });
        }
      } catch (error) {
        // KVK API error - don't block signup, but log the error
        console.error(`❌ KVK API error for user ${userId}:`, error.message);
        updateData.kvk_verified = false;
        kvkVerificationResult = {
          verified: false,
          exists: false,
          error: error.message || 'KVK API fout'
        };
        kvkVerificationErrors.push({
          type: 'api_error',
          message: 'KVK verificatie kon niet worden uitgevoerd. Probeer het later opnieuw.'
        });
        // Don't throw - allow signup to continue
      }
    } else if (kvkNumber && kvkNumber.trim() && !KvkApiService.isAvailable()) {
      // KVK number provided but API not configured
      console.warn(`⚠️ KVK number provided but KVK API not configured for user ${userId}`);
      updateData.kvk_verified = false;
      kvkVerificationResult = {
        verified: false,
        exists: false,
        error: 'KVK API niet geconfigureerd'
      };
    }

    // Get old profile data BEFORE update for risk re-evaluation
    const { data: oldProfile } = await supabaseAdmin
      .from('profiles')
      .select('company_name, coc_number, vat_number, email, street, postal_code, city, country, phone')
      .eq('id', userId)
      .single();

    // Update profile using supabaseAdmin to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error saving onboarding data:', error);
      throw error;
    }

    // Trigger risk assessment if relevant fields changed (async, don't block response)
    if (data && oldProfile && UserRiskAssessmentService.shouldReevaluate(oldProfile, data)) {
      console.log(`🔄 Onboarding data changed, triggering risk assessment for user ${userId}`);
      UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, data)
        .then(result => {
          if (result.success) {
            console.log(`✅ Risk assessment completed for user ${userId}: score=${result.score}, requires_review=${result.requires_manual_review}`);
          } else {
            console.warn(`⚠️ Risk assessment failed for user ${userId}:`, result.error);
          }
        })
        .catch(err => {
          console.error(`❌ Error in async risk assessment for user ${userId}:`, err);
        });
    } else if (data && (!oldProfile || !oldProfile.company_name) && data.company_name) {
      // First time company_name is set during onboarding - trigger assessment
      console.log(`🔄 Company name set during onboarding, triggering risk assessment for user ${userId}`);
      UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, data)
        .then(result => {
          if (result.success) {
            console.log(`✅ Risk assessment completed for user ${userId}: score=${result.score}, requires_review=${result.requires_manual_review}`);
          } else {
            console.warn(`⚠️ Risk assessment failed for user ${userId}:`, result.error);
          }
        })
        .catch(err => {
          console.error(`❌ Error in async risk assessment for user ${userId}:`, err);
        });
    }

    // Prepare response with KVK verification info
    const response = {
      success: true,
      message: 'Onboarding data opgeslagen',
      data: data
    };
    
    // Include KVK verification result if available
    if (kvkVerificationResult) {
      response.kvkVerification = {
        ...kvkVerificationResult,
        errors: kvkVerificationErrors.length > 0 ? kvkVerificationErrors : undefined
      };
    }
    
    res.json(response);
  } catch (err) {
    console.error('Error in /onboarding:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het opslaan van de onboarding data'
    });
  }
});

// Complete onboarding
router.post("/onboarding/complete", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Use the database function to complete onboarding
    const { data, error } = await supabase
      .rpc('complete_onboarding', { p_user_id: userId });

    if (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }

    // Get updated profile to trigger risk assessment
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profileError && updatedProfile) {
      // Trigger risk assessment when onboarding is completed (async, don't block response)
      if (updatedProfile.company_name || updatedProfile.email) {
        console.log(`🔄 Onboarding completed, triggering risk assessment for user ${userId}`);
        UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, updatedProfile)
          .then(result => {
            if (result.success) {
              console.log(`✅ Risk assessment completed for user ${userId}: score=${result.score}, requires_review=${result.requires_manual_review}`);
            } else {
              console.warn(`⚠️ Risk assessment failed for user ${userId}:`, result.error);
            }
          })
          .catch(err => {
            console.error(`❌ Error in async risk assessment for user ${userId}:`, err);
          });
      }
    }

    res.json({
      success: true,
      message: 'Onboarding voltooid',
      data: { completed: true }
    });
  } catch (err) {
    console.error('Error in /onboarding/complete:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het voltooien van de onboarding'
    });
  }
});

// =====================================================
// LEAD ROUTING / AUTO-ASSIGNMENT API ENDPOINTS
// =====================================================

// Auto-assign a lead to the best matching partner
router.post("/admin/leads/:id/auto-assign", requireAuth, isAdmin, async (req, res) => {
  try {
    const leadId = req.params.id;
    const assignedBy = req.body.assigned_by || 'auto';
    const partnerId = req.body.partner_id || null; // Optional: specific partner to assign to

    const result = await LeadAssignmentService.assignLead(leadId, assignedBy, partnerId);

    res.json({
      success: true,
      message: 'Lead succesvol toegewezen',
      data: result
    });
  } catch (error) {
    console.error('Error in auto-assign:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het automatisch toewijzen van het lead'
    });
  }
});

// Get recommendations for a lead (top 5 candidates without assigning)
router.get("/admin/leads/:id/recommendations", requireAuth, isAdmin, async (req, res) => {
  try {
    const leadId = req.params.id;

    const result = await LeadAssignmentService.getRecommendations(leadId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van aanbevelingen'
    });
  }
});

// Bulk auto-assign multiple leads
router.post("/admin/leads/bulk/auto-assign", requireAuth, isAdmin, async (req, res) => {
  try {
    const { lead_ids, assigned_by } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'lead_ids is verplicht en moet een array zijn'
      });
    }

    const result = await LeadAssignmentService.bulkAssignLeads(lead_ids, assigned_by || 'auto');

    res.json({
      success: true,
      message: `${result.success.length} leads toegewezen, ${result.failed.length} gefaald`,
      data: result
    });
  } catch (error) {
    console.error('Error in bulk auto-assign:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het bulk toewijzen van leads'
    });
  }
});

// Get partner performance statistics
router.get("/admin/partners/:id/stats", requireAuth, isAdmin, async (req, res) => {
  try {
    const partnerId = req.params.id;

    // Get stats from materialized view
    const { data: stats, error } = await supabaseAdmin
      .from('partner_performance_stats')
      .select('*')
      .eq('partner_id', partnerId)
      .single();

    if (error) {
      throw error;
    }

    // Also get partner profile info
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, company_name, primary_branch, regions, max_open_leads, is_active_for_routing')
      .eq('id', partnerId)
      .single();

    if (partnerError) {
      throw partnerError;
    }

    res.json({
      success: true,
      data: {
        partner: partner,
        stats: stats || {
          leads_assigned_30d: 0,
          leads_accepted_30d: 0,
          leads_rejected_30d: 0,
          conversion_rate_30d: 0,
          avg_response_time_minutes: null,
          open_leads_count: 0,
          last_lead_assigned_at: null
        }
      }
    });
  } catch (error) {
    console.error('Error getting partner stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van partner statistieken'
    });
  }
});

// =====================================================
// AI ROUTER SETTINGS ENDPOINTS
// =====================================================

// Get AI Router settings
router.get("/admin/ai-router/settings", requireAuth, isAdmin, async (req, res) => {
  try {
    // Fetch settings from database
    const { data: settings, error } = await supabaseAdmin
      .from('ai_router_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['region_weight', 'performance_weight', 'fairness_weight', 'auto_assign_enabled', 'auto_assign_threshold']);

    if (error) {
      throw error;
    }

    // Convert to object with defaults
    const settingsMap = {};
    if (settings) {
      settings.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
    }

    res.json({
      success: true,
      data: {
        regionWeight: parseInt(settingsMap.region_weight || '50', 10),
        performanceWeight: parseInt(settingsMap.performance_weight || '50', 10),
        fairnessWeight: parseInt(settingsMap.fairness_weight || '50', 10),
        autoAssign: settingsMap.auto_assign_enabled !== 'false',
        autoAssignThreshold: parseInt(settingsMap.auto_assign_threshold || '70', 10)
      }
    });
  } catch (error) {
    console.error('Error getting AI router settings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van instellingen'
    });
  }
});

// Save AI Router settings
router.post("/admin/ai-router/settings", requireAuth, isAdmin, async (req, res) => {
  try {
    const { regionWeight, performanceWeight, fairnessWeight, autoAssign, autoAssignThreshold } = req.body;
    const userId = req.user.id;

    // Validate values
    const regionW = Math.max(0, Math.min(100, parseInt(regionWeight || 50, 10)));
    const performanceW = Math.max(0, Math.min(100, parseInt(performanceWeight || 50, 10)));
    const fairnessW = Math.max(0, Math.min(100, parseInt(fairnessWeight || 50, 10)));
    const threshold = Math.max(0, Math.min(100, parseInt(autoAssignThreshold || 70, 10)));
    const enabled = autoAssign !== false;

    // Upsert settings
    const settingsToUpdate = [
      {
        setting_key: 'region_weight',
        setting_value: regionW.toString(),
        description: 'Belang van regio matching (0-100)',
        updated_by: userId
      },
      {
        setting_key: 'performance_weight',
        setting_value: performanceW.toString(),
        description: 'Belang van prestaties/conversieratio (0-100)',
        updated_by: userId
      },
      {
        setting_key: 'fairness_weight',
        setting_value: fairnessW.toString(),
        description: 'Belang van eerlijke verdeling (0-100)',
        updated_by: userId
      },
      {
        setting_key: 'auto_assign_enabled',
        setting_value: enabled.toString(),
        description: 'Automatisch toewijzen van nieuwe leads',
        updated_by: userId
      },
      {
        setting_key: 'auto_assign_threshold',
        setting_value: threshold.toString(),
        description: 'Minimum score voor automatische toewijzing (0-100)',
        updated_by: userId
      }
    ];

    // Use upsert for each setting
    for (const setting of settingsToUpdate) {
      const { error: upsertError } = await supabaseAdmin
        .from('ai_router_settings')
        .upsert({
          setting_key: setting.setting_key,
          setting_value: setting.setting_value,
          description: setting.description,
          updated_by: setting.updated_by,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (upsertError) {
        throw new Error(`Error updating ${setting.setting_key}: ${upsertError.message}`);
      }
    }
    
    res.json({
      success: true,
      message: 'Instellingen opgeslagen',
      data: {
        regionWeight: regionW,
        performanceWeight: performanceW,
        fairnessWeight: fairnessW,
        autoAssign: enabled,
        autoAssignThreshold: threshold
      }
    });
  } catch (error) {
    console.error('Error saving AI router settings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het opslaan van instellingen'
    });
  }
});

// =====================================================
// AI TASK ROUTER SETTINGS ENDPOINTS
// =====================================================

// Get AI Task Router settings
router.get("/admin/task-router/settings", requireAuth, isAdmin, async (req, res) => {
  try {
    // Fetch settings from database
    const { data: settings, error } = await supabaseAdmin
      .from('ai_router_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['task_auto_assign_enabled', 'task_skills_weight', 'task_workload_weight', 'task_completion_weight', 'task_auto_assign_threshold']);

    if (error) {
      throw error;
    }

    // Convert to object with defaults
    const settingsMap = {};
    if (settings) {
      settings.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
    }

    res.json({
      success: true,
      data: {
        autoAssign: settingsMap.task_auto_assign_enabled !== 'false',
        skillsWeight: parseInt(settingsMap.task_skills_weight || '50', 10),
        workloadWeight: parseInt(settingsMap.task_workload_weight || '30', 10),
        completionWeight: parseInt(settingsMap.task_completion_weight || '20', 10),
        autoAssignThreshold: parseInt(settingsMap.task_auto_assign_threshold || '60', 10)
      }
    });
  } catch (error) {
    console.error('Error getting AI Task Router settings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van instellingen'
    });
  }
});

// Save AI Task Router settings
router.post("/admin/task-router/settings", requireAuth, isAdmin, async (req, res) => {
  try {
    const { autoAssign, skillsWeight, workloadWeight, completionWeight, autoAssignThreshold } = req.body;
    const userId = req.user.id;

    // Validate values
    const skillsW = Math.max(0, Math.min(100, parseInt(skillsWeight || 50, 10)));
    const workloadW = Math.max(0, Math.min(100, parseInt(workloadWeight || 30, 10)));
    const completionW = Math.max(0, Math.min(100, parseInt(completionWeight || 20, 10)));
    const threshold = Math.max(0, Math.min(100, parseInt(autoAssignThreshold || 60, 10)));
    const enabled = autoAssign !== false;

    // Upsert settings
    const settingsToUpdate = [
      {
        setting_key: 'task_auto_assign_enabled',
        setting_value: enabled.toString(),
        description: 'Automatisch toewijzen van nieuwe taken',
        updated_by: userId
      },
      {
        setting_key: 'task_skills_weight',
        setting_value: skillsW.toString(),
        description: 'Belang van skills matching (0-100)',
        updated_by: userId
      },
      {
        setting_key: 'task_workload_weight',
        setting_value: workloadW.toString(),
        description: 'Belang van workload/ beschikbaarheid (0-100)',
        updated_by: userId
      },
      {
        setting_key: 'task_completion_weight',
        setting_value: completionW.toString(),
        description: 'Belang van completion rate (0-100)',
        updated_by: userId
      },
      {
        setting_key: 'task_auto_assign_threshold',
        setting_value: threshold.toString(),
        description: 'Minimum score voor automatische toewijzing (0-100)',
        updated_by: userId
      }
    ];

    // Use upsert for each setting
    for (const setting of settingsToUpdate) {
      const { error: upsertError } = await supabaseAdmin
        .from('ai_router_settings')
        .upsert({
          setting_key: setting.setting_key,
          setting_value: setting.setting_value,
          description: setting.description,
          updated_by: setting.updated_by,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (upsertError) {
        throw new Error(`Error updating ${setting.setting_key}: ${upsertError.message}`);
      }
    }
    
    res.json({
      success: true,
      message: 'Instellingen opgeslagen',
      data: {
        autoAssign: enabled,
        skillsWeight: skillsW,
        workloadWeight: workloadW,
        completionWeight: completionW,
        autoAssignThreshold: threshold
      }
    });
  } catch (error) {
    console.error('Error saving AI Task Router settings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het opslaan van instellingen'
    });
  }
});

// =====================================================
// AI ROUTER PERFORMANCE DEBUG ENDPOINT
// =====================================================

// Debug endpoint voor performance metrics per partner
router.get("/admin/ai-router/performance-debug", requireAuth, isAdmin, async (req, res) => {
  try {
    const { partner_id } = req.query;

    if (!partner_id) {
      return res.status(400).json({
        success: false,
        error: 'partner_id query parameter is verplicht'
      });
    }

    // Fetch partner profile
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_name, first_name, last_name, primary_branch, regions, max_open_leads, is_active_for_routing, ai_risk_score')
      .eq('id', partner_id)
      .eq('is_admin', false)
      .single();

    if (partnerError || !partner) {
      return res.status(404).json({
        success: false,
        error: 'Partner niet gevonden'
      });
    }

    // Fetch performance stats
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('partner_performance_stats')
      .select('*')
      .eq('partner_id', partner_id)
      .single();

    if (statsError) {
      console.error('Error fetching stats:', statsError);
      // Don't fail, just return empty stats
    }

    // Calculate performance score
    const LeadAssignmentService = require('../services/leadAssignmentService');
    const performanceScore = LeadAssignmentService.calculatePerformanceScore(stats || {});

    // Fetch AI router settings
    const { data: settings } = await supabaseAdmin
      .from('ai_router_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['region_weight', 'performance_weight', 'fairness_weight']);

    const routerSettings = {};
    if (settings) {
      settings.forEach(s => {
        if (s.setting_key === 'region_weight') {
          routerSettings.regionWeight = parseInt(s.setting_value || '50', 10);
        } else if (s.setting_key === 'performance_weight') {
          routerSettings.performanceWeight = parseInt(s.setting_value || '50', 10);
        } else if (s.setting_key === 'fairness_weight') {
          routerSettings.fairnessWeight = parseInt(s.setting_value || '50', 10);
        }
      });
    }

    res.json({
      success: true,
      data: {
        partner: {
          id: partner.id,
          company_name: partner.company_name,
          name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
          primary_branch: partner.primary_branch,
          regions: partner.regions,
          max_open_leads: partner.max_open_leads,
          is_active_for_routing: partner.is_active_for_routing,
          ai_risk_score: partner.ai_risk_score
        },
        stats: stats || {},
        performanceScore: {
          totalScore: performanceScore.totalScore,
          breakdown: performanceScore.breakdown,
          factors: performanceScore.factors
        },
        routerSettings: routerSettings,
        metrics: {
          // Reactiesnelheid
          responseSpeed: {
            avg_first_response_time_minutes_7d: stats?.avg_first_response_time_minutes_7d || null,
            avg_first_response_time_minutes_30d: stats?.avg_first_response_time_minutes_30d || null,
            pct_contacted_within_1h_30d: stats?.pct_contacted_within_1h_30d || 0,
            pct_contacted_within_24h_30d: stats?.pct_contacted_within_24h_30d || 0,
            score: performanceScore.breakdown.responseSpeed
          },
          // AI Trust
          aiTrust: {
            ai_trust_score: stats?.ai_trust_score || null,
            score: performanceScore.breakdown.aiTrust
          },
          // Deal Rate
          dealRate: {
            deal_rate_7d: stats?.deal_rate_7d || null,
            deal_rate_30d: stats?.deal_rate_30d || null,
            won_leads_30d: stats?.won_leads_30d || 0,
            lost_leads_30d: stats?.lost_leads_30d || 0,
            leads_with_decision_30d: stats?.leads_with_decision_30d || 0,
            score: performanceScore.breakdown.dealRate
          },
          // Follow-up
          followUp: {
            avg_contact_attempts_per_lead_30d: stats?.avg_contact_attempts_per_lead_30d || 0,
            pct_leads_min_2_attempts_30d: stats?.pct_leads_min_2_attempts_30d || 0,
            score: performanceScore.breakdown.followUp
          },
          // Feedback
          feedback: {
            avg_customer_rating_30d: stats?.avg_customer_rating_30d || null,
            num_ratings_30d: stats?.num_ratings_30d || 0,
            score: performanceScore.breakdown.feedback
          },
          // Klachten
          complaints: {
            complaints_30d: stats?.complaints_30d || 0,
            complaint_rate_30d: stats?.complaint_rate_30d || 0,
            score: performanceScore.breakdown.complaints
          },
          // Dealwaarde
          dealValue: {
            avg_deal_value_30d: stats?.avg_deal_value_30d || null,
            median_deal_value_30d: stats?.median_deal_value_30d || null,
            score: performanceScore.breakdown.dealValue
          },
          // Consistentie
          consistency: {
            consistency_score: stats?.consistency_score || null,
            score: performanceScore.breakdown.consistency
          }
        }
      }
    });
  } catch (error) {
    console.error('Error in performance debug endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van performance data'
    });
  }
});

// =====================================================
// LEAD FLOW INTELLIGENCE - Segment Management API
// =====================================================

// Get all active segments
router.get("/lead-segments", requireAuth, async (req, res) => {
  try {
    const LeadSegmentService = require('../services/leadSegmentService');
    const segments = await LeadSegmentService.getAllActiveSegments();
    
    res.json({
      success: true,
      data: segments
    });
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van segmenten'
    });
  }
});

// Get segment by ID
router.get("/lead-segments/:id", requireAuth, async (req, res) => {
  try {
    const LeadSegmentService = require('../services/leadSegmentService');
    const segment = await LeadSegmentService.getSegmentById(req.params.id);
    
    // Haal capaciteit op
    const capacity = await LeadSegmentService.getSegmentCapacity(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...segment,
        capacity
      }
    });
  } catch (error) {
    console.error('Error fetching segment:', error);
    res.status(404).json({
      success: false,
      error: error.message || 'Segment niet gevonden'
      });
    }
});

// Create new segment (admin only)
router.post("/lead-segments", requireAuth, isAdmin, async (req, res) => {
  try {
    const { branch, region, country, description, postal_prefixes } = req.body;
    
    if (!branch || !region) {
      return res.status(400).json({
        success: false,
        error: 'Branche en regio zijn verplicht'
      });
    }
    
    const LeadSegmentService = require('../services/leadSegmentService');
    const segment = await LeadSegmentService.findOrCreateSegment(
      branch,
      region,
      country || 'NL'
    );
    
    // Update description en postal_prefixes als opgegeven
    if (description || postal_prefixes) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('lead_segments')
        .update({
          description: description || null,
          postal_prefixes: postal_prefixes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', segment.id)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Error updating segment: ${updateError.message}`);
      }
      
      return res.json({
        success: true,
        data: updated
      });
    }
    
    res.json({
      success: true,
      data: segment
    });
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het aanmaken van het segment'
    });
      }
});

// Get stats for a segment
router.get("/lead-segments/:id/stats", requireAuth, async (req, res) => {
  try {
    const segmentId = req.params.id;
    const { start_date, end_date } = req.query;
    
    let query = supabaseAdmin
      .from('lead_generation_stats')
      .select('*')
      .eq('segment_id', segmentId)
      .order('date', { ascending: false })
      .limit(30); // Default: laatste 30 dagen
    
    if (start_date) {
      query = query.gte('date', start_date);
    }
    if (end_date) {
      query = query.lte('date', end_date);
      }

    const { data: stats, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching stats: ${error.message}`);
    }
    
    res.json({
      success: true,
      data: stats || []
    });
  } catch (error) {
    console.error('Error fetching segment stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van statistieken'
        });
  }
    });

// Get plans for a segment
router.get("/lead-segments/:id/plans", requireAuth, async (req, res) => {
  try {
    const segmentId = req.params.id;
    const { start_date, end_date } = req.query;
    
    let query = supabaseAdmin
      .from('lead_segment_plans')
      .select('*')
      .eq('segment_id', segmentId)
      .order('date', { ascending: false })
      .limit(30); // Default: laatste 30 dagen
    
    if (start_date) {
      query = query.gte('date', start_date);
    }
    if (end_date) {
      query = query.lte('date', end_date);
    }
    
    const { data: plans, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching plans: ${error.message}`);
    }
    
    res.json({
      success: true,
      data: plans || []
        });
  } catch (error) {
    console.error('Error fetching segment plans:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van plannen'
        });
      }
    });

// Get orchestration status
router.get("/orchestration/status", requireAuth, isAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const dateStr = date || new Date().toISOString().split('T')[0];
    
    // Haal alle plannen op met orchestration status
    const { data: plans, error: plansError } = await supabaseAdmin
      .from('lead_segment_plans')
      .select(`
        *,
        lead_segments (
          id,
          code,
          branch,
          region
        )
      `)
      .eq('date', dateStr)
      .not('orchestration_status', 'is', null)
      .order('last_orchestration_at', { ascending: false });

    if (plansError) {
      throw new Error(`Error fetching orchestration status: ${plansError.message}`);
    }
    
    // Haal recente orchestration logs op
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('channel_orchestration_log')
      .select('*')
      .eq('date', dateStr)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (logsError) {
      console.warn('Error fetching orchestration logs:', logsError);
    }

    res.json({
      success: true,
      data: {
        date: dateStr,
        plans: plans || [],
        recent_logs: logs || []
      }
    });
  } catch (error) {
    console.error('Error fetching orchestration status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van orchestration status'
    });
  }
});

// =====================================================
// GOOGLE ADS API ENDPOINTS (Admin Only)
// =====================================================

// Sync Google Ads campaigns to database
router.post("/admin/google-ads/sync-campaigns", requireAuth, isAdmin, async (req, res) => {
  try {
    const GoogleAdsClient = require('../integrations/googleAdsClient')
    const { customer_id } = req.body
    
    const result = await GoogleAdsClient.syncCampaignsToDatabase(customer_id)
    
    res.json({
      success: result.success,
      data: result,
      message: result.message || 'Campaigns synced successfully'
    })
  } catch (error) {
    console.error('Error syncing Google Ads campaigns:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het synchroniseren van campagnes'
    })
  }
})

// Verify Google Ads connection and campaign linking
router.get("/admin/google-ads/verify", requireAuth, isAdmin, async (req, res) => {
  try {
    const GoogleAdsClient = require('../integrations/googleAdsClient')
    const { customer_id } = req.query
    
    // Test API connection
    const campaigns = await GoogleAdsClient.getActiveCampaigns(customer_id)
    
    // Get segments with campaign mapping
    const { data: segments, error: segmentsError } = await supabaseAdmin
      .from('lead_segments')
      .select('id, code, branch, region, google_ads_campaign_id, google_ads_campaign_name, google_ads_customer_id, google_ads_last_synced_at')
      .eq('is_active', true)
    
    if (segmentsError) {
      throw new Error(`Error fetching segments: ${segmentsError.message}`)
    }
    
    // Verify which campaigns are actually linked
    const linkedSegments = segments.filter(s => s.google_ads_campaign_id)
    const verifiedLinks = []
    const brokenLinks = []
    
    for (const segment of linkedSegments) {
      // Check if campaign still exists in Google Ads
      const campaignExists = campaigns.some(c => c.id.toString() === segment.google_ads_campaign_id)
      
      if (campaignExists) {
        const campaign = campaigns.find(c => c.id.toString() === segment.google_ads_campaign_id)
        verifiedLinks.push({
          segmentId: segment.id,
          segmentCode: segment.code,
          campaignId: segment.google_ads_campaign_id,
          campaignName: segment.google_ads_campaign_name || campaign.name,
          lastSynced: segment.google_ads_last_synced_at,
          status: 'verified'
        })
      } else {
        brokenLinks.push({
          segmentId: segment.id,
          segmentCode: segment.code,
          campaignId: segment.google_ads_campaign_id,
          campaignName: segment.google_ads_campaign_name,
          reason: 'Campaign not found in Google Ads (may have been deleted)',
          status: 'broken'
        })
      }
    }
    
    res.json({
      success: true,
      data: {
        apiConnected: campaigns.length >= 0, // If we got a response, API is connected
        totalCampaignsInGoogleAds: campaigns.length,
        totalSegments: segments.length,
        linkedSegments: linkedSegments.length,
        verifiedLinks: verifiedLinks.length,
        brokenLinks: brokenLinks.length,
        verifiedLinks,
        brokenLinks,
        unlinkedCampaigns: campaigns.filter(c => 
          !linkedSegments.some(s => s.google_ads_campaign_id === c.id.toString())
        ).map(c => ({
          campaignId: c.id,
          campaignName: c.name,
          reason: 'Not linked to any segment'
        }))
      }
    })
  } catch (error) {
    console.error('Error verifying Google Ads connection:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het verifiëren van de Google Ads connectie'
    })
  }
})

// Get all active Google Ads campaigns
router.get("/admin/google-ads/campaigns", requireAuth, isAdmin, async (req, res) => {
  try {
    const GoogleAdsClient = require('../integrations/googleAdsClient')
    
    const campaigns = await GoogleAdsClient.getActiveCampaigns()
    
    res.json({
      success: true,
      data: campaigns,
      count: campaigns.length
    })
  } catch (error) {
    console.error('Error fetching Google Ads campaigns:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van campagnes'
    })
  }
})

// Get Google Ads campaign stats for a segment
router.get("/admin/google-ads/segments/:segmentId/stats", requireAuth, isAdmin, async (req, res) => {
  try {
    const { segmentId } = req.params
    const { date } = req.query
    
    const GoogleAdsClient = require('../integrations/googleAdsClient')
    const LeadSegmentService = require('../services/leadSegmentService')
    
    const segment = await LeadSegmentService.getSegmentById(segmentId)
    const targetDate = date ? new Date(date) : new Date()
    
    const stats = await GoogleAdsClient.getCampaignStats(segment.code, targetDate)
    
    res.json({
      success: true,
      data: {
        segment: {
          id: segment.id,
          code: segment.code,
          branch: segment.branch,
          region: segment.region
        },
        date: targetDate.toISOString().split('T')[0],
        stats
      }
    })
  } catch (error) {
    console.error('Error fetching Google Ads stats:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van statistieken'
    })
  }
})

// Manually update campaign budget for a segment
router.post("/admin/google-ads/segments/:segmentId/budget", requireAuth, isAdmin, async (req, res) => {
  try {
    const { segmentId } = req.params
    const { dailyBudget } = req.body
    
    if (!dailyBudget || dailyBudget < 5 || dailyBudget > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Dagelijks budget moet tussen €5 en €1000 zijn'
      })
    }
    
    const GoogleAdsClient = require('../integrations/googleAdsClient')
    const LeadSegmentService = require('../services/leadSegmentService')
    
    const segment = await LeadSegmentService.getSegmentById(segmentId)
    
    const result = await GoogleAdsClient.updateCampaignBudget(segmentId, dailyBudget, segment.code)
    
    if (result.success) {
      // Update database
      await supabaseAdmin
        .from('lead_segments')
        .update({
          google_ads_last_synced_at: new Date().toISOString()
        })
        .eq('id', segmentId)
    }
    
    res.json({
      success: result.success,
      data: result,
      message: result.message || (result.success ? 'Budget updated successfully' : 'Failed to update budget')
    })
  } catch (error) {
    console.error('Error updating Google Ads budget:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het bijwerken van het budget'
    })
  }
})

// Get segments with Google Ads campaign mapping
router.get("/admin/google-ads/segments", requireAuth, isAdmin, async (req, res) => {
  try {
    const { data: segments, error } = await supabaseAdmin
      .from('lead_segments')
      .select('id, code, branch, region, google_ads_campaign_id, google_ads_campaign_name, google_ads_last_synced_at')
      .eq('is_active', true)
      .order('branch', { ascending: true })
      .order('region', { ascending: true })
    
    if (error) {
      throw new Error(`Error fetching segments: ${error.message}`)
    }
    
    res.json({
      success: true,
      data: segments,
      count: segments.length,
      mapped: segments.filter(s => s.google_ads_campaign_id).length
    })
  } catch (error) {
    console.error('Error fetching segments:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van segmenten'
    })
  }
})

// Test Google Ads API connection
router.get("/admin/google-ads/test", requireAuth, isAdmin, async (req, res) => {
  try {
    const GoogleAdsClient = require('../integrations/googleAdsClient')
    
    const customer = await GoogleAdsClient.initialize()
    
    if (!customer) {
      return res.json({
        success: false,
        configured: false,
        message: 'Google Ads API not configured. Please check your .env file.'
      })
    }
    
    // Try to get campaigns
    const campaigns = await GoogleAdsClient.getActiveCampaigns()
    
    res.json({
      success: true,
      configured: true,
      message: 'Google Ads API connection successful',
      campaignsCount: campaigns.length
    })
  } catch (error) {
    console.error('Error testing Google Ads API:', error)
    res.status(500).json({
      success: false,
      configured: true,
      error: error.message || 'Er is een fout opgetreden bij het testen van de API verbinding'
    })
  }
})

// Get all Google Ads accounts
router.get("/admin/google-ads/accounts", requireAuth, isAdmin, async (req, res) => {
  try {
    const { data: accounts, error } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`Error fetching accounts: ${error.message}`)
    }
    
    res.json({
      success: true,
      data: accounts || [],
      count: accounts?.length || 0
    })
  } catch (error) {
    console.error('Error fetching Google Ads accounts:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van accounts'
    })
  }
})

// Add Google Ads account
router.post("/admin/google-ads/accounts", requireAuth, isAdmin, async (req, res) => {
  try {
    const { account_name, customer_id, is_manager_account } = req.body
    
    if (!account_name || !customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Account naam en Customer ID zijn verplicht'
      })
    }
    
    // Remove dashes from customer ID
    const cleanCustomerId = customer_id.replace(/-/g, '')
    
    // Check if account already exists
    const { data: existing } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('id')
      .eq('customer_id', cleanCustomerId)
      .single()
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Dit account bestaat al'
      })
    }
    
    // Insert new account
    const { data: account, error } = await supabaseAdmin
      .from('google_ads_accounts')
      .insert({
        account_name,
        customer_id: cleanCustomerId,
        is_manager_account: is_manager_account || false,
        is_active: true
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Error creating account: ${error.message}`)
    }
    
    res.json({
      success: true,
      data: account,
      message: 'Account succesvol toegevoegd'
    })
  } catch (error) {
    console.error('Error adding Google Ads account:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het toevoegen van het account'
    })
  }
})

// Delete Google Ads account
router.delete("/admin/google-ads/accounts/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    const { error } = await supabaseAdmin
      .from('google_ads_accounts')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw new Error(`Error deleting account: ${error.message}`)
    }
    
    res.json({
      success: true,
      message: 'Account succesvol verwijderd'
    })
  } catch (error) {
    console.error('Error deleting Google Ads account:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het verwijderen van het account'
    })
  }
})

// Get campaigns with filters and segment mapping
router.get("/admin/google-ads/campaigns", requireAuth, isAdmin, async (req, res) => {
  try {
    const { account, segment, status } = req.query
    
    // Get campaigns from Google Ads API
    const GoogleAdsClient = require('../integrations/googleAdsClient')
    const campaigns = await GoogleAdsClient.getActiveCampaigns(account)
    
    // Get segments with campaign mapping
    let segmentQuery = supabaseAdmin
      .from('lead_segments')
      .select('id, code, branch, region, google_ads_campaign_id, google_ads_customer_id, google_ads_last_synced_at')
      .eq('is_active', true)
    
    if (segment) {
      segmentQuery = segmentQuery.eq('code', segment)
    }
    
    const { data: segments } = await segmentQuery
    
    // Map campaigns with segments
    const mappedCampaigns = campaigns.map(campaign => {
      const matchedSegment = segments?.find(s => 
        s.google_ads_campaign_id === campaign.id.toString() ||
        campaign.name.toLowerCase().includes(s.code.toLowerCase())
      )
      
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        account_id: account || process.env.GOOGLE_ADS_CUSTOMER_ID,
        segment_id: matchedSegment?.id || null,
        segment: matchedSegment ? {
          id: matchedSegment.id,
          code: matchedSegment.code,
          branch: matchedSegment.branch,
          region: matchedSegment.region
        } : null,
        daily_budget: 0, // Will be fetched separately if needed
        last_synced_at: matchedSegment?.google_ads_last_synced_at || null
      }
    })
    
    // Apply filters
    let filtered = mappedCampaigns
    if (account) {
      filtered = filtered.filter(c => c.account_id === account)
    }
    if (segment) {
      filtered = filtered.filter(c => c.segment?.code === segment)
    }
    if (status) {
      filtered = filtered.filter(c => c.status === status)
    }
    
    res.json({
      success: true,
      data: filtered,
      count: filtered.length
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van campagnes'
    })
  }
})

// Update campaign status (activate/pause)
// Optimize Google Ads campaign (performance monitoring & auto-optimization)
router.post("/api/admin/google-ads/campaigns/:campaignId/optimize", requireAuth, isAdmin, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { customer_id, start_date, end_date } = req.body;

    const GoogleAdsOptimizationService = require('../services/googleAdsOptimizationService');
    
    const startDate = start_date ? new Date(start_date) : null;
    const endDate = end_date ? new Date(end_date) : null;

    const result = await GoogleAdsOptimizationService.optimizeCampaign(
      campaignId,
      customer_id,
      startDate,
      endDate
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to optimize campaign'
      });
    }

    res.json({
      success: true,
      data: result,
      message: `Campaign optimization completed: ${result.optimizations?.pausedKeywords || 0} keywords paused, ${result.optimizations?.pausedAds || 0} ads paused, ${result.optimizations?.alerts || 0} alerts generated`
    });
  } catch (error) {
    console.error('Error optimizing campaign:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to optimize campaign'
    });
  }
});

// Optimize all Google Ads campaigns
router.post("/api/admin/google-ads/campaigns/optimize-all", requireAuth, isAdmin, async (req, res) => {
  try {
    const { customer_id } = req.body;

    const GoogleAdsOptimizationService = require('../services/googleAdsOptimizationService');
    
    const result = await GoogleAdsOptimizationService.optimizeAllCampaigns(customer_id);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to optimize campaigns'
      });
    }

    res.json({
      success: true,
      data: result,
      message: `Optimized ${result.campaignsOptimized}/${result.totalCampaigns} campaigns`
    });
  } catch (error) {
    console.error('Error optimizing all campaigns:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to optimize campaigns'
    });
  }
});

router.post("/admin/google-ads/campaigns/:campaignId/status", requireAuth, isAdmin, async (req, res) => {
  try {
    const { campaignId } = req.params
    const { status, customer_id } = req.body
    
    if (!status || !['PAUSED', 'ENABLED', 'REMOVED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be PAUSED, ENABLED, or REMOVED'
      })
    }
    
    const GoogleAdsClient = require('../integrations/googleAdsClient')
    const result = await GoogleAdsClient.updateCampaignStatus(campaignId, status, customer_id)
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to update campaign status'
      })
    }
    
    // Update database if segment is linked
    if (customer_id) {
      const { error: updateError } = await supabaseAdmin
        .from('lead_segments')
        .update({
          google_ads_last_synced_at: new Date().toISOString()
        })
        .eq('google_ads_campaign_id', campaignId)
        .eq('google_ads_customer_id', customer_id)
      
      if (updateError) {
        console.warn('Warning: Could not update segment sync timestamp:', updateError)
      }
    }
    
    res.json({
      success: true,
      data: result,
      message: `Campaign status updated to ${status}`
    })
  } catch (error) {
    console.error('Error updating campaign status:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het bijwerken van de campagne status'
    })
  }
})

// Get campaign performance stats
router.get("/admin/google-ads/performance-stats", requireAuth, isAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query
    
    // Get stats from lead_generation_stats
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))
    
    const { data: stats, error } = await supabaseAdmin
      .from('lead_generation_stats')
      .select('google_ads_spend, google_ads_clicks, google_ads_impressions, leads_generated')
      .gte('date', startDate.toISOString().split('T')[0])
    
    if (error) {
      throw new Error(`Error fetching stats: ${error.message}`)
    }
    
    const totals = (stats || []).reduce((acc, stat) => {
      acc.total_spend += parseFloat(stat.google_ads_spend || 0)
      acc.total_clicks += parseInt(stat.google_ads_clicks || 0)
      acc.total_impressions += parseInt(stat.google_ads_impressions || 0)
      acc.total_leads += parseInt(stat.leads_generated || 0)
      return acc
    }, {
      total_spend: 0,
      total_clicks: 0,
      total_impressions: 0,
      total_leads: 0
    })
    
    const avgCpl = totals.total_leads > 0 
      ? totals.total_spend / totals.total_leads 
      : 0
    
    res.json({
      success: true,
      data: {
        total_spend: totals.total_spend,
        total_clicks: totals.total_clicks,
        total_impressions: totals.total_impressions,
        total_leads: totals.total_leads,
        avg_cpl: avgCpl
      }
    })
  } catch (error) {
    console.error('Error fetching performance stats:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het ophalen van statistieken'
    })
  }
})

// =====================================================
// PARTNER MARKETING API ENDPOINTS
// =====================================================

const PartnerDemandService = require('../services/partnerDemandService');
const PartnerCampaignService = require('../services/partnerCampaignService');
const PartnerLandingPageService = require('../services/partnerLandingPageService');

// Get partner marketing profile
router.get("/partners/:partnerId/marketing-profile", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, marketing_mode, auto_marketing_enabled, monthly_marketing_budget, preferred_channels, brand_color, logo_url, tone_of_voice')
      .eq('id', partnerId)
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error getting marketing profile:', error);
    res.status(500).json({ error: 'Failed to get marketing profile' });
  }
});

// Update partner marketing profile
router.post("/partners/:partnerId/marketing-profile", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    const { marketing_mode, auto_marketing_enabled, monthly_marketing_budget, preferred_channels, brand_color, logo_url, tone_of_voice } = req.body;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const update = {};
    if (marketing_mode !== undefined) update.marketing_mode = marketing_mode;
    if (auto_marketing_enabled !== undefined) update.auto_marketing_enabled = auto_marketing_enabled;
    if (monthly_marketing_budget !== undefined) update.monthly_marketing_budget = monthly_marketing_budget;
    if (preferred_channels !== undefined) update.preferred_channels = preferred_channels;
    if (brand_color !== undefined) update.brand_color = brand_color;
    if (logo_url !== undefined) update.logo_url = logo_url;
    if (tone_of_voice !== undefined) update.tone_of_voice = tone_of_voice;
    
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(update)
      .eq('id', partnerId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating marketing profile:', error);
    res.status(500).json({ error: 'Failed to update marketing profile' });
  }
});

// Get partner segments
router.get("/partners/:partnerId/segments", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { data, error } = await supabaseAdmin
      .from('partner_segments')
      .select(`
        *,
        lead_segments (id, code, branch, region, country)
      `)
      .eq('partner_id', partnerId)
      .order('is_primary', { ascending: false })
      .order('priority', { ascending: true });
    
    if (error) throw error;
    
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error getting partner segments:', error);
    res.status(500).json({ error: 'Failed to get partner segments' });
  }
});

// Add partner segment
router.post("/partners/:partnerId/segments", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    const { segment_id, is_primary, priority, target_leads_per_week } = req.body;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { data, error } = await supabaseAdmin
      .from('partner_segments')
      .insert({
        partner_id: partnerId,
        segment_id,
        is_primary: is_primary || false,
        priority: priority || 100,
        target_leads_per_week: target_leads_per_week || null
      })
      .select(`
        *,
        lead_segments (id, code, branch, region)
      `)
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error adding partner segment:', error);
    res.status(500).json({ error: 'Failed to add partner segment' });
  }
});

// Get partner landing pages
router.get("/partners/:partnerId/landing-pages", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    const { segment_id, status } = req.query;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const landingPages = await PartnerLandingPageService.getPartnerLandingPages(partnerId, {
      segment_id,
      status
    });
    
    res.json({ success: true, data: landingPages });
  } catch (error) {
    console.error('Error getting landing pages:', error);
    res.status(500).json({ error: 'Failed to get landing pages' });
  }
});

// Create partner landing page
router.post("/partners/:partnerId/landing-pages", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    const { segment_id, path, title, subtitle, seo_title, seo_description, content_json, source } = req.body;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const landingPage = await PartnerLandingPageService.createLandingPage(partnerId, segment_id, {
      path,
      title,
      subtitle,
      seo_title,
      seo_description,
      content_json: content_json || {},
      source: source || 'manual'
    });
    
    res.json({ success: true, data: landingPage });
  } catch (error) {
    console.error('Error creating landing page:', error);
    res.status(500).json({ error: 'Failed to create landing page' });
  }
});

// Publish landing page
router.post("/landing-pages/:landingPageId/publish", requireAuth, async (req, res) => {
  try {
    const { landingPageId } = req.params;
    const userId = req.user.id;
    
    // Check ownership
    const landingPage = await PartnerLandingPageService.getLandingPage(landingPageId);
    if (!landingPage) {
      return res.status(404).json({ error: 'Landing page not found' });
    }
    
    if (landingPage.partner_id !== userId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const published = await PartnerLandingPageService.publishLandingPage(landingPageId);
    
    res.json({ success: true, data: published });
  } catch (error) {
    console.error('Error publishing landing page:', error);
    res.status(500).json({ error: 'Failed to publish landing page' });
  }
});

// Preview concept landing page from recommendation
router.get("/admin/landing-pages/preview/:recommendationId", requireAuth, isAdmin, async (req, res) => {
  console.log('Preview route hit!', req.params);
  try {
    const { recommendationId } = req.params;
    
    // Get recommendation
    const { data: rec, error: recError } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .select(`
        *,
        lead_segments (id, code, branch, region)
      `)
      .eq('id', recommendationId)
      .single();
    
    if (recError || !rec) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview niet gevonden</title>
          <style>body { font-family: sans-serif; padding: 40px; text-align: center; }</style>
        </head>
        <body>
          <h1>Preview niet gevonden</h1>
          <p>De aanbeveling kon niet worden gevonden.</p>
        </body>
        </html>
      `);
    }
    
    const actionDetails = rec.action_details || {};
    const { site_id, segment_id, page_type, suggested_path } = actionDetails;
    
    if (!site_id || !segment_id || !page_type || !suggested_path) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview niet mogelijk</title>
          <style>body { font-family: sans-serif; padding: 40px; text-align: center; }</style>
        </head>
        <body>
          <h1>Preview niet mogelijk</h1>
          <p>De aanbeveling mist vereiste gegevens voor een preview.</p>
        </body>
        </html>
      `);
    }
    
    // Get site and segment
    const SiteService = require('../services/siteService');
    const LeadSegmentService = require('../services/leadSegmentService');
    const PartnerLandingPageService = require('../services/partnerLandingPageService');
    
    const site = await SiteService.getSiteById(site_id);
    if (!site) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Site niet gevonden</title>
          <style>body { font-family: sans-serif; padding: 40px; text-align: center; }</style>
        </head>
        <body>
          <h1>Site niet gevonden</h1>
          <p>De site kon niet worden gevonden.</p>
        </body>
        </html>
      `);
    }
    
    const segment = await LeadSegmentService.getSegmentById(segment_id);
    if (!segment) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Segment niet gevonden</title>
          <style>body { font-family: sans-serif; padding: 40px; text-align: center; }</style>
        </head>
        <body>
          <h1>Segment niet gevonden</h1>
          <p>Het segment kon niet worden gevonden.</p>
        </body>
        </html>
      `);
    }
    
    // Generate AI content for preview (with timeout to prevent infinite loading)
    const contentPromise = PartnerLandingPageService.generateAIContentForPage({
      site,
      segment,
      pageType: page_type,
      intent: `${segment.branch} ${segment.region} ${page_type} preview`
    });
    
    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Content generation timeout')), 30000); // 30 second timeout
    });
    
    const content = await Promise.race([contentPromise, timeoutPromise]);
    
    // Create a temporary landing page object for preview
    const previewLandingPage = {
      id: `preview-${recommendationId}`,
      title: content.title,
      subtitle: content.subtitle,
      seo_title: content.seoTitle,
      seo_description: content.seoDescription,
      content_json: content.content_json,
      path: suggested_path,
      page_type: page_type,
      status: 'concept',
      site_id: site.id,
      segment_id: segment.id
    };
    
    // Get cluster for internal linking (empty for preview)
    const cluster = {
      main: null,
      cost: null,
      quote: null,
      spoed: null,
      others: []
    };
    
    // Get industry by segment branch for form template
    let industry = null;
    let formSlug = null;
    if (segment.branch) {
      const { data: industries } = await supabaseAdmin
        .from('industries')
        .select('id, name, slug')
        .eq('name', segment.branch)
        .eq('is_active', true)
        .limit(1)
        .single();
      
      if (industries) {
        industry = industries;
        formSlug = industries.slug;
      }
    }
    
    // Render preview
    res.render('public/landing-page', {
      site,
      landingPage: previewLandingPage,
      cluster,
      isPreview: true,
      recommendationId: recommendationId,
      industry: industry,
      formSlug: formSlug,
      segment: segment,
      // Tracking / gtag config (Consent Mode aware)
      googleAdsTagId: process.env.GOOGLE_ADS_TAG_ID || null,
      ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || null,
      googleAdsConversionId: process.env.GOOGLE_ADS_CONVERSION_ID || null,
      googleAdsConversionLabel: process.env.GOOGLE_ADS_CONVERSION_LABEL || null,
      layout: false
    });
    
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preview fout</title>
        <style>body { font-family: sans-serif; padding: 40px; text-align: center; }</style>
      </head>
      <body>
        <h1>Preview fout</h1>
        <p>Er is een fout opgetreden bij het genereren van de preview: ${error.message}</p>
      </body>
      </html>
    `);
  }
});

// Get test landing page (for visual testing)
router.get("/admin/landing-pages/test", requireAuth, isAdmin, async (req, res) => {
  try {
    // Haal de eerste live platform landing page op
    const { data: landingPages, error } = await supabaseAdmin
      .from('partner_landing_pages')
      .select(`
        id,
        path,
        title,
        status,
        site_id,
        sites (domain)
      `)
      .is('partner_id', null)  // Platform LPs only
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    if (!landingPages || landingPages.length === 0) {
      return res.json({
        success: false,
        error: 'No live landing pages found',
        message: 'Maak eerst een landing page aan en publiceer deze.'
      });
    }
    
    const landingPage = landingPages[0];
    
    res.json({
      success: true,
      data: {
        id: landingPage.id,
        path: landingPage.path,
        title: landingPage.title,
        domain: landingPage.sites?.domain || 'localhost:3000',
        fullUrl: `${req.protocol}://${landingPage.sites?.domain || 'localhost:3000'}${landingPage.path}`
      }
    });
    
  } catch (error) {
    console.error('Error fetching test landing page:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test landing page',
      message: error.message
    });
  }
});

// Create test landing page (for visual testing)
router.post("/admin/landing-pages/create-test", requireAuth, isAdmin, async (req, res) => {
  try {
    const SiteService = require('../services/siteService');
    const LeadSegmentService = require('../services/leadSegmentService');
    const PartnerLandingPageService = require('../services/partnerLandingPageService');
    
    // Get default site
    const site = await SiteService.getDefaultSite();
    if (!site) {
      return res.status(500).json({
        success: false,
        error: 'Default site not found'
      });
    }
    
    // Get first active segment (or create a test one)
    let segments = await LeadSegmentService.getAllActiveSegments();
    if (!segments || segments.length === 0) {
      // Create a test segment
      const { data: newSegment, error: segError } = await supabaseAdmin
        .from('lead_segments')
        .insert({
          code: 'test_schilder_test',
          branch: 'schilder',
          region: 'test',
          country: 'NL',
          is_active: true
        })
        .select()
        .single();
      
      if (segError) throw segError;
      segments = [newSegment];
    }
    
    const segment = segments[0];
    
    // Generate path
    const path = PartnerLandingPageService.generatePathFromSegment(segment, 'main');
    
    // Check if LP already exists
    const existing = await PartnerLandingPageService.getLandingPageByPath(site.id, path);
    if (existing) {
      // If exists but not live, publish it
      if (existing.status !== 'live') {
        const published = await PartnerLandingPageService.publishLandingPage(existing.id);
        return res.json({
          success: true,
          data: {
            id: published.id,
            path: published.path,
            title: published.title,
            domain: site.domain || 'localhost:3000',
            fullUrl: `${req.protocol}://${site.domain || 'localhost:3000'}${published.path}`
          }
        });
      }
      
      // Already live, return it
      return res.json({
        success: true,
        data: {
          id: existing.id,
          path: existing.path,
          title: existing.title,
          domain: site.domain || 'localhost:3000',
          fullUrl: `${req.protocol}://${site.domain || 'localhost:3000'}${existing.path}`
        }
      });
    }
    
    // Generate AI content
    const content = await PartnerLandingPageService.generateAIContentForPage({
      site,
      segment,
      pageType: 'main',
      intent: `${segment.branch} ${segment.region} test landing page`
    });
    
    // Create landing page
    const landingPage = await PartnerLandingPageService.createPlatformLandingPage({
      siteId: site.id,
      segmentId: segment.id,
      pageType: 'main',
      path: path,
      title: content.title,
      subtitle: content.subtitle,
      seoTitle: content.seoTitle,
      seoDescription: content.seoDescription,
      contentJson: content.content_json,
      sourceType: 'platform'
    });
    
    // Publish immediately for testing
    const published = await PartnerLandingPageService.publishLandingPage(landingPage.id);
    
    res.json({
      success: true,
      data: {
        id: published.id,
        path: published.path,
        title: published.title,
        domain: site.domain || 'localhost:3000',
        fullUrl: `${req.protocol}://${site.domain || 'localhost:3000'}${published.path}`
      }
    });
    
  } catch (error) {
    console.error('Error creating test landing page:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test landing page',
      message: error.message
    });
  }
});

// Get partner campaigns
router.get("/partners/:partnerId/campaigns", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    const { segment_id, channel, status } = req.query;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const campaigns = await PartnerCampaignService.getPartnerCampaigns(partnerId, {
      segment_id,
      channel,
      status
    });
    
    res.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Error getting campaigns:', error);
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
});

// Create partner campaign
router.post("/partners/:partnerId/campaigns", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    const { segment_id, channel, daily_budget, monthly_budget, cpl_target, external_campaign_id, ai_managed } = req.body;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const campaign = await PartnerCampaignService.createCampaign(partnerId, segment_id, channel, {
      daily_budget,
      monthly_budget,
      cpl_target,
      external_campaign_id,
      ai_managed: ai_managed !== undefined ? ai_managed : true,
      status: 'planned'
    });
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Activate campaign
router.post("/campaigns/:campaignId/activate", requireAuth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user.id;
    
    // Check ownership
    const campaign = await PartnerCampaignService.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (campaign.partner_id !== userId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const activated = await PartnerCampaignService.activateCampaign(campaignId);
    
    res.json({ success: true, data: activated });
  } catch (error) {
    console.error('Error activating campaign:', error);
    res.status(500).json({ error: 'Failed to activate campaign' });
  }
});

// Get partner lead gaps
router.get("/partners/:partnerId/lead-gaps", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    const { start, end } = req.query;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const gaps = await PartnerDemandService.getPartnerLeadGaps(partnerId, {
      start: start || null,
      end: end || null
    });
    
    res.json({ success: true, data: gaps });
  } catch (error) {
    console.error('Error getting lead gaps:', error);
    res.status(500).json({ error: 'Failed to get lead gaps' });
  }
});

// Get AI marketing recommendations
router.get("/partners/:partnerId/marketing-recommendations", requireAuth, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user.id;
    const { status } = req.query;
    
    // Check if user is admin or owns the profile
    if (userId !== partnerId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    let query = supabaseAdmin
      .from('ai_marketing_recommendations')
      .select(`
        *,
        lead_segments (id, code, branch, region)
      `)
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Approve recommendation
router.post("/marketing-recommendations/:recId/approve", requireAuth, async (req, res) => {
  try {
    const { recId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.user_metadata?.role === 'admin' || req.user.is_admin === true;
    
    // Get recommendation
    const { data: rec, error: recError } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .select('*')
      .eq('id', recId)
      .single();
    
    if (recError) throw recError;
    if (!rec) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    
    // Check authorization
    // Platform recommendations (partner_id IS NULL) require admin
    // Legacy recommendations (partner_id IS NOT NULL) can be approved by partner or admin
    if (rec.partner_id === null && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized: Platform recommendations require admin access' });
    }
    if (rec.partner_id !== null && rec.partner_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Check status
    if (rec.status !== 'pending') {
      return res.status(400).json({ error: `Recommendation is already ${rec.status}` });
    }
    
    // Execute action based on type
    const SiteService = require('../services/siteService');
    const LeadSegmentService = require('../services/leadSegmentService');
    const PartnerLandingPageService = require('../services/partnerLandingPageService');
    
    if (rec.action_type === 'create_landing_page' && rec.site_id && rec.segment_id) {
      // Platform landing page creation
      const actionDetails = rec.action_details || {};
      const { site_id, segment_id, page_type, suggested_path } = actionDetails;
      
      if (!site_id || !segment_id || !page_type || !suggested_path) {
        return res.status(400).json({ error: 'Missing required action details' });
      }
      
      // Get site and segment
      const site = await SiteService.getDefaultSite(); // Or get by site_id if needed
      if (!site) {
        return res.status(500).json({ error: 'Default site not found' });
      }
      
      const segment = await LeadSegmentService.getSegmentById(segment_id);
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }
      
      // Check if form template exists for this industry (Phase 3)
      // Segment.branch is a text field that matches industries.name
      // We need to find the industry_id by matching segment.branch to industries.name
      // Use case-insensitive matching (LOWER comparison)
      const { data: industries, error: industryError } = await supabaseAdmin
        .from('industries')
        .select('id, name')
        .eq('is_active', true);
      
      let industry = null;
      if (!industryError && industries) {
        // Find industry by case-insensitive name match
        industry = industries.find(i => 
          i.name.toLowerCase() === segment.branch.toLowerCase()
        );
      }
      
      if (industry) {
        // Check for active form template
        const { data: formTemplate, error: templateError } = await supabaseAdmin
          .from('lead_form_templates')
          .select('id')
          .eq('industry_id', industry.id)
          .eq('is_active', true)
          .limit(1)
          .single();
        
        if (templateError || !formTemplate) {
          // No active form template found - block landing page creation
          return res.status(400).json({
            error: 'NO_FORM_TEMPLATE_FOR_INDUSTRY',
            message: 'Er is nog geen aanvraagformulier ingesteld voor deze branche.',
            industry_id: industry.id,
            industry_name: segment.branch,
            form_builder_url: `/admin/settings/industries/${industry.id}/form`
          });
        }
      }
      // If industry lookup fails, we continue anyway (backwards compatibility)
      // This allows landing pages for segments without matching industries
      
      // Generate AI content
      const content = await PartnerLandingPageService.generateAIContentForPage({
        site,
        segment,
        pageType: page_type,
        intent: `${segment.branch} ${segment.region} ${page_type}`
      });
      
      // Create landing page
      const landingPage = await PartnerLandingPageService.createPlatformLandingPage({
        siteId: site_id,
        segmentId: segment_id,
        pageType: page_type,
        path: suggested_path,
        title: content.title,
        subtitle: content.subtitle,
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
        contentJson: content.content_json,
        sourceType: 'platform'
      });
      
      // Publish landing page immediately (set to 'live' status)
      let publishedLandingPage = landingPage;
      if (landingPage && landingPage.id) {
        publishedLandingPage = await PartnerLandingPageService.publishLandingPage(landingPage.id);
      }
      
      // Update recommendation
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('ai_marketing_recommendations')
        .update({
          status: 'executed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          executed_at: new Date().toISOString()
        })
        .eq('id', recId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      res.json({ 
        success: true, 
        data: updated,
        landingPage: publishedLandingPage
      });
      
    } else if (rec.action_type === 'publish_landing_page') {
      // Publish landing page
      const actionDetails = rec.action_details || {};
      const landingPageId = actionDetails.landing_page_id;
      
      if (!landingPageId) {
        return res.status(400).json({ error: 'Missing landing_page_id in action details' });
      }
      
      // Publish landing page
      const published = await PartnerLandingPageService.publishLandingPage(landingPageId);
      
      // Update recommendation
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('ai_marketing_recommendations')
        .update({
          status: 'executed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          executed_at: new Date().toISOString()
        })
        .eq('id', recId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      res.json({ 
        success: true, 
        data: updated,
        landingPage: published
      });
      
    } else if (rec.action_type === 'create_campaign') {
      // Create Google Ads campaign
      const actionDetails = rec.action_details || {};
      const { segment_id, campaign_name, daily_budget, advertising_channel_type, target_locations, landing_page_url } = actionDetails;
      
      if (!segment_id || !campaign_name || !daily_budget) {
        return res.status(400).json({ 
          error: 'Missing required fields: segment_id, campaign_name, and daily_budget are required' 
        });
      }

      // Get segment info
      const { data: segment, error: segmentError } = await supabaseAdmin
        .from('lead_segments')
        .select('id, code, branch, region, google_ads_customer_id')
        .eq('id', segment_id)
        .single();

      if (segmentError || !segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      // Check if campaign already exists
      if (segment.google_ads_campaign_id) {
        return res.status(400).json({ 
          error: 'Campaign already exists for this segment',
          campaign_id: segment.google_ads_campaign_id
        });
      }

      // Get customer ID (prefer segment -> active customer account -> env)
      const GoogleAdsClient = require('../integrations/googleAdsClient');
      let customerId = segment.google_ads_customer_id;
      if (!customerId) {
        try {
          customerId = await GoogleAdsClient.getActiveCustomerAccount();
          if (customerId) {
            console.log(`✅ Using active Google Ads customer from DB: ${customerId}`);
          }
        } catch (cidErr) {
          console.error('⚠️ Could not fetch active customer account from DB:', cidErr.message);
        }
      }
      if (!customerId) {
        customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
        console.log(`ℹ️ Fallback to env GOOGLE_ADS_CUSTOMER_ID as customer: ${customerId}`);
      }

      // Auto-create landing page if not available
      let finalLandingPageUrl = landing_page_url;
      if (!finalLandingPageUrl || finalLandingPageUrl === 'Nog niet beschikbaar') {
        try {
          const SiteService = require('../services/siteService');
          const PartnerLandingPageService = require('../services/partnerLandingPageService');
          
          // Get default site
          const site = await SiteService.getDefaultSite();
          if (!site) {
            console.warn('⚠️ No default site found, using fallback URL');
          } else {
            // Check if main landing page exists
            const path = PartnerLandingPageService.generatePathFromSegment(segment, 'main');
            let landingPage = await PartnerLandingPageService.getLandingPageByPath(site.id, path);
            
            if (!landingPage) {
              console.log(`📄 Creating landing page for segment ${segment.code}...`);
              
              // Generate AI content and create landing page
              const content = await PartnerLandingPageService.generateAIContentForPage({
                site,
                segment,
                pageType: 'main',
                intent: `${segment.branch} ${segment.region} offerte`
              });
              
              landingPage = await PartnerLandingPageService.createPlatformLandingPage({
                siteId: site.id,
                segmentId: segment_id,
                pageType: 'main',
                path: path,
                title: content.title,
                subtitle: content.subtitle,
                seoTitle: content.seoTitle,
                seoDescription: content.seoDescription,
                contentJson: content.content_json,
                sourceType: 'platform'
              });
              
              // Publish immediately
              landingPage = await PartnerLandingPageService.publishLandingPage(landingPage.id);
              console.log(`✅ Created and published landing page: ${landingPage.id}`);
            }
            
            // Build full URL
            const platformUrl = process.env.PLATFORM_URL || 'https://growsocialmedia.nl';
            finalLandingPageUrl = `${platformUrl}${landingPage.path}`;
            
            // Validate URL format
            try {
              new URL(finalLandingPageUrl);
              console.log(`✅ Constructed landing page URL: ${finalLandingPageUrl}`);
              console.log(`ℹ️ Note: URL accessibility will be checked before creating Google Ads campaign`);
            } catch (urlError) {
              console.error(`❌ Invalid landing page URL format: ${finalLandingPageUrl}`, urlError);
              finalLandingPageUrl = 'https://growsocialmedia.nl'; // Fallback
            }
          }
        } catch (lpError) {
          console.error('⚠️ Could not auto-create landing page:', lpError);
          console.error('⚠️ Error details:', {
            message: lpError.message,
            stack: lpError.stack,
            segmentId: segment_id
          });
          // Continue without landing page URL - campaign will still be created
          finalLandingPageUrl = finalLandingPageUrl || 'https://growsocialmedia.nl';
        }
      }

      // Use NEW next-level campaign builder service
      const GoogleAdsCampaignBuilderService = require('../services/googleAdsCampaignBuilderService');
      const CampaignProgressService = require('../services/campaignProgressService');
      
      // Initialize progress tracking
      CampaignProgressService.setProgress(recId, {
        step: 'initializing',
        message: 'Campagne initialiseren...',
        percentage: 0,
        status: 'in_progress'
      });
      
      // Progress callback to update progress store
      const progressCallback = (progress) => {
        // CRITICAL: Ensure step is always a string (handle objects, null, undefined)
        let step = progress.step;
        if (typeof step !== 'string') {
          if (step && typeof step === 'object') {
            step = step.step || step.name || step.type || 'extensions';
          } else {
            step = step || 'initializing';
          }
        }
        step = String(step);
        
        // Ensure status is set correctly
        const status = progress.status || (step === 'complete' ? 'complete' : step === 'error' ? 'error' : 'in_progress');
        
        // CRITICAL: Ensure message is always a string (handle objects, null, undefined)
        let message = progress.message;
        if (typeof message !== 'string') {
          if (message && typeof message === 'object') {
            message = message.message || message.text || message.title || JSON.stringify(message);
          } else {
            message = message || 'Bezig...';
          }
        }
        message = String(message);
        
        // Ensure percentage is a valid number
        let percentage = progress.percentage;
        if (typeof percentage !== 'number' || isNaN(percentage)) {
          percentage = 0;
        }
        percentage = Math.max(0, Math.min(100, percentage));
        
        const progressData = {
          step: step,
          message: message,
          percentage: percentage,
          status: status,
          timestamp: Date.now()
        };
        CampaignProgressService.setProgress(recId, progressData);
        // Log for debugging
        console.log(`📊 Progress update for ${recId}:`, progressData);
      };
      
      let campaignResult;
      try {
        campaignResult = await GoogleAdsCampaignBuilderService.createCompleteCampaign({
          campaignName: campaign_name,
          dailyBudget: daily_budget,
          customerId: customerId,
          branch: segment.branch,
          region: segment.region,
          landingPageUrl: finalLandingPageUrl || 'https://growsocialmedia.nl', // Fallback URL
          segmentId: segment_id
        }, progressCallback);

        if (!campaignResult.success) {
          console.error('Campaign creation failed:', campaignResult.error);
          console.error('Campaign creation error details:', campaignResult.details);
          
          // Check for specific error types and provide user-friendly messages
          let userFriendlyMessage = campaignResult.error;
          
          if (campaignResult.details?.type === 'PERMISSION_ERROR' && 
              campaignResult.details?.code === 'USER_PERMISSION_DENIED') {
            userFriendlyMessage = `Google Ads toestemming geweigerd. Er is een Manager Account (MCC) nodig om toegang te krijgen tot het customer account. Voeg een Manager Account toe via Admin → Google Ads → Accounts met is_manager_account=true.`;
          } else if (campaignResult.details?.type === 'POLICY_VIOLATION' && 
              campaignResult.details?.topic === 'DESTINATION_NOT_WORKING') {
            userFriendlyMessage = `De landing page URL is niet toegankelijk of wordt door Google Ads afgewezen. Controleer of de URL "${campaignResult.details.landingPageUrl}" publiekelijk toegankelijk is en een geldige HTTP 200 response geeft.`;
          } else if (campaignResult.error?.includes('USER_PERMISSION_DENIED') || 
                     campaignResult.error?.includes('login-customer-id')) {
            userFriendlyMessage = `Google Ads toestemming geweigerd. Er is een Manager Account (MCC) nodig. Voeg een Manager Account toe via Admin → Google Ads → Accounts.`;
          }
          
          CampaignProgressService.setProgress(recId, {
            step: 'error',
            message: `Fout: ${userFriendlyMessage}`,
            percentage: 0,
            status: 'error'
          });
          return res.status(500).json({ 
            error: userFriendlyMessage || 'Failed to create Google Ads campaign',
            details: campaignResult.details || null
          });
        }
        
        // Mark as complete
        CampaignProgressService.setProgress(recId, {
          step: 'complete',
          message: 'Campagne succesvol aangemaakt! ✅',
          percentage: 100,
          status: 'complete'
        });
      } catch (campaignError) {
        console.error('Error creating Google Ads campaign:', campaignError);
        CampaignProgressService.setProgress(recId, {
          step: 'error',
          message: `Fout: ${campaignError.message}`,
          percentage: 0,
          status: 'error'
        });
        return res.status(500).json({ 
          error: campaignError.message || 'Failed to create Google Ads campaign',
          details: campaignError.stack
        });
      }

      // Update segment with campaign info
      const { error: updateSegmentError } = await supabaseAdmin
        .from('lead_segments')
        .update({
          google_ads_campaign_id: campaignResult.campaignId,
          google_ads_campaign_name: campaign_name,
          google_ads_budget_id: campaignResult.budgetId,
          google_ads_customer_id: customerId,
          google_ads_last_synced_at: new Date().toISOString()
        })
        .eq('id', segment_id);

      if (updateSegmentError) {
        console.error('Error updating segment with campaign info:', updateSegmentError);
        // Campaign was created but segment update failed - log but don't fail
      }

      // Update recommendation
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('ai_marketing_recommendations')
        .update({
          status: 'executed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          executed_at: new Date().toISOString()
        })
        .eq('id', recId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      // Clear progress after successful completion (after a delay to allow frontend to read final status)
      // Increased delay to ensure frontend has time to poll and close modal
      setTimeout(() => {
        CampaignProgressService.clearProgress(recId);
      }, 10000); // 10 seconds instead of 5 to give frontend more time
      
      res.json({ 
        success: true, 
        data: updated,
        campaign: campaignResult,
        message: `Google Ads campaign "${campaign_name}" created successfully with keywords, ad groups, and RSA ads - ready to go!`
      });
      
    } else {
      // Other action types: just mark as approved (not executed yet)
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('ai_marketing_recommendations')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId
        })
        .eq('id', recId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      res.json({ success: true, data: updated });
    }
    
  } catch (error) {
    console.error('Error approving recommendation:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      recId: req.params.recId,
      userId: req.user?.id
    });
    
    // Clear progress on error
    const CampaignProgressService = require('../services/campaignProgressService');
    CampaignProgressService.setProgress(req.params.recId, {
      step: 'error',
      message: `Fout: ${error.message}`,
      percentage: 0,
      status: 'error'
    });
    
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to approve recommendation',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get progress for a recommendation (for polling)
router.get("/marketing-recommendations/:recId/progress", requireAuth, async (req, res) => {
  try {
    const { recId } = req.params;
    const CampaignProgressService = require('../services/campaignProgressService');
    const progress = CampaignProgressService.getProgress(recId);
    
    if (!progress) {
      return res.json({
        success: true,
        progress: null,
        message: 'No progress data available'
      });
    }
    
    // Ensure progress message is always a string before returning
    if (progress && progress.message && typeof progress.message !== 'string') {
      if (typeof progress.message === 'object') {
        progress.message = progress.message.message || progress.message.text || progress.message.title || JSON.stringify(progress.message);
      } else {
        progress.message = String(progress.message);
      }
    }
    
    return res.json({
      success: true,
      progress: progress
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get progress'
    });
  }
});

// =====================================================
// LEADSTROOM DASHBOARD API
// =====================================================

// Get dashboard overview data for Leadstroom page
router.get("/admin/leadstroom/overview", requireAuth, isAdmin, async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)
    const todayEndISO = todayEnd.toISOString()
    
    const todayDateStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 1. Get today's leads COUNT DIRECTLY from leads table (real-time)
    const { count: todayLeadsCount, error: todayLeadsError } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .lte('created_at', todayEndISO)

    // 1b. Get today's stats from aggregated table (for spend data)
    const { data: todayStats, error: todayError } = await supabaseAdmin
      .from('lead_generation_stats')
      .select('leads_generated, google_ads_spend')
      .eq('date', todayDateStr)

    // 2. Get last 7 days leads COUNT DIRECTLY from leads table (real-time)
    const { count: weekLeadsCount, error: weekLeadsError } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    // 2b. Get last 7 days stats from aggregated table (for spend data)
    const { data: weekStats, error: weekError } = await supabaseAdmin
      .from('lead_generation_stats')
      .select('leads_generated, google_ads_spend')
      .gte('date', sevenDaysAgoStr)
      .lte('date', todayDateStr)

    // 3. Get last 30 days stats for chart
    const { data: chartStats, error: chartError } = await supabaseAdmin
      .from('lead_generation_stats')
      .select('date, leads_generated, google_ads_spend')
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: true })

    // 3b. Get plans for last 30 days to calculate targets per day
    const { data: plansForChart, error: plansChartError } = await supabaseAdmin
      .from('lead_segment_plans')
      .select('date, target_leads_per_day')
      .gte('date', thirtyDaysAgo)
      .lte('date', todayDateStr)
      .order('date', { ascending: true })

    // 3c. Combine stats with targets per day
    // Group plans by date and sum targets
    const targetsByDate = {}
    if (plansForChart) {
      plansForChart.forEach(plan => {
        const dateStr = plan.date
        if (!targetsByDate[dateStr]) {
          targetsByDate[dateStr] = 0
        }
        targetsByDate[dateStr] += (plan.target_leads_per_day || 0)
      })
    }

    // Group stats by date and sum leads (multiple segments per day)
    const statsByDate = {}
    if (chartStats) {
      chartStats.forEach(stat => {
        const dateStr = stat.date
        if (!statsByDate[dateStr]) {
          statsByDate[dateStr] = {
            leads_generated: 0,
            google_ads_spend: 0
          }
        }
        statsByDate[dateStr].leads_generated += (stat.leads_generated || 0)
        statsByDate[dateStr].google_ads_spend += (parseFloat(stat.google_ads_spend) || 0)
      })
    }

    // Get real-time leads count for last 30 days (from leads table directly)
    // This ensures we count ALL leads, even if they don't have segment_id yet
    const { data: realTimeLeads, error: realTimeLeadsError } = await supabaseAdmin
      .from('leads')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo + 'T00:00:00')
      .lte('created_at', todayDateStr + 'T23:59:59')

    // Group real-time leads by date
    const realTimeLeadsByDate = {}
    if (realTimeLeads) {
      realTimeLeads.forEach(lead => {
        const dateStr = lead.created_at.split('T')[0]
        if (!realTimeLeadsByDate[dateStr]) {
          realTimeLeadsByDate[dateStr] = 0
        }
        realTimeLeadsByDate[dateStr]++
      })
    }

    // Generate all dates for the last 30 days
    const chartData = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      // Use real-time leads count if available, otherwise fallback to stats
      const realTimeCount = realTimeLeadsByDate[dateStr] || 0
      const statsCount = statsByDate[dateStr]?.leads_generated || 0
      // Prefer real-time count (includes leads without segment_id), but use stats if real-time is 0 and stats exists
      const leads_generated = realTimeCount > 0 ? realTimeCount : statsCount
      
      const stats = statsByDate[dateStr] || { google_ads_spend: 0 }
      const target = targetsByDate[dateStr] || 0
      
      chartData.push({
        date: dateStr,
        leads_generated: leads_generated,
        target_leads_per_day: target,
        google_ads_spend: stats.google_ads_spend
      })
    }

    // 4. Get all active segments
    const { data: allSegments, error: segmentsError } = await supabaseAdmin
      .from('lead_segments')
      .select('*')
      .eq('is_active', true)

    // 5. Get plans for today
    const { data: todayPlans, error: plansError } = await supabaseAdmin
      .from('lead_segment_plans')
      .select('*')
      .eq('date', todayDateStr)

    // 6. Get today's stats per segment (real-time from leads table)
    // Get all leads from today with segment_id
    const { data: todayLeadsData, error: todayLeadsDataError } = await supabaseAdmin
      .from('leads')
      .select('segment_id')
      .gte('created_at', todayStart)
      .lte('created_at', todayEndISO)
      .not('segment_id', 'is', null)

    // Count leads per segment (real-time)
    const segmentCounts = {}
    if (todayLeadsData) {
      todayLeadsData.forEach(lead => {
        if (lead.segment_id) {
          segmentCounts[lead.segment_id] = (segmentCounts[lead.segment_id] || 0) + 1
        }
      })
    }

    // 6b. Get today's stats per segment from aggregated table (fallback)
    const { data: todaySegmentStats, error: statsError } = await supabaseAdmin
      .from('lead_generation_stats')
      .select('segment_id, leads_generated')
      .eq('date', todayDateStr)

    // Combine segments with their plans and stats (use real-time counts)
    // Also calculate real-time targets if plan doesn't exist or is outdated
    const LeadDemandPlannerService = require('../services/leadDemandPlannerService');
    const segments = await Promise.all((allSegments || []).map(async (segment) => {
      const plan = (todayPlans || []).find(p => p.segment_id === segment.id)
      const realTimeCount = segmentCounts[segment.id] || 0
      const aggregatedStats = (todaySegmentStats || []).find(s => s.segment_id === segment.id)
      
      // Always calculate real-time target to reflect latest partner capacity changes
      // This ensures targets update immediately when max_open_leads changes
      let target = 0;
      try {
        target = await LeadDemandPlannerService.calculateTargetLeads(segment.id, today);
        // If plan exists but target differs, update it (async, don't block)
        if (plan && plan.target_leads_per_day !== target) {
          // Update plan in background (fire and forget)
          LeadDemandPlannerService.planSegment(segment.id, today).catch(err => {
            console.error(`Error updating plan for segment ${segment.id}:`, err);
          });
        }
      } catch (error) {
        console.error(`Error calculating real-time target for segment ${segment.id}:`, error);
        // Fallback to plan target if calculation fails
        target = plan?.target_leads_per_day || 0;
      }
      
      return {
        ...segment,
        lead_segment_plans: plan ? [plan] : [{
          target_leads_per_day: target,
          lead_gap: target - (realTimeCount > 0 ? realTimeCount : (aggregatedStats?.leads_generated || 0))
        }],
        leads_generated: realTimeCount > 0 ? realTimeCount : (aggregatedStats?.leads_generated || 0)
      }
    }))

    // Calculate KPIs (use real-time counts from leads table, fallback to stats if needed)
    const todayLeads = todayLeadsCount !== null ? todayLeadsCount : ((todayStats || []).reduce((sum, s) => sum + (s.leads_generated || 0), 0))
    const weekLeads = weekLeadsCount !== null ? weekLeadsCount : ((weekStats || []).reduce((sum, s) => sum + (s.leads_generated || 0), 0))
    const todaySpend = (todayStats || []).reduce((sum, s) => sum + (parseFloat(s.google_ads_spend) || 0), 0)
    const totalTarget = (segments || []).reduce((sum, s) => {
      const plan = s.lead_segment_plans?.[0]
      return sum + (plan?.target_leads_per_day || 0)
    }, 0)

    // Calculate average CPL
    const totalSpend = (weekStats || []).reduce((sum, s) => sum + (parseFloat(s.google_ads_spend) || 0), 0)
    const avgCpl = weekLeads > 0 ? totalSpend / weekLeads : 0

    res.json({
      success: true,
      data: {
        kpis: {
          leadsToday: todayLeads,
          leadsTarget: totalTarget,
          leadsWeek: weekLeads,
          spendToday: todaySpend,
          spendBudget: 2000, // TODO: Get from config
          avgCpl: Math.round(avgCpl * 100) / 100
        },
        chartData: chartData || [],
        segments: segments || []
      }
    })
  } catch (error) {
    console.error('Error fetching leadstroom overview:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch dashboard data'
    })
  }
})

// Recalculate targets for all segments (admin only)
router.post("/admin/leadstroom/recalculate-targets", requireAuth, isAdmin, async (req, res) => {
  try {
    const LeadDemandPlannerService = require('../services/leadDemandPlannerService');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await LeadDemandPlannerService.planAllSegments(today);
    
    res.json({
      success: true,
      message: `Targets recalculated for ${result.segmentsPlanned} segments`,
      data: result
    });
  } catch (error) {
    console.error('Error recalculating targets:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to recalculate targets'
    });
  }
})

// Generate AI recommendations manually (admin only)
// Sync segments from user preferences (admin only)
router.post("/admin/leadstroom/sync-segments", requireAuth, isAdmin, async (req, res) => {
  try {
    const SegmentSyncService = require('../services/segmentSyncService');
    const logger = require('../utils/logger');
    
    // Support both capacity-based (default) and legacy preference-based sync
    const { method = 'capacity' } = req.body;
    
    logger.info(`Manual segment sync triggered by admin (method: ${method})`);
    
    let result;
    if (method === 'preferences') {
      // Legacy method: sync based on user preferences
      result = await SegmentSyncService.syncSegmentsFromUserPreferences();
    } else {
      // Default: capacity-based sync (only segments with capacity > 0)
      result = await SegmentSyncService.syncSegmentsFromCapacity();
    }
    
    res.json({
      success: true,
      method: method,
      data: result
    });
  } catch (error) {
    logger.error('Error in manual segment sync:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error syncing segments'
    });
  }
});

router.post("/admin/leadstroom/generate-recommendations", requireAuth, isAdmin, async (req, res) => {
  try {
    const PartnerMarketingOrchestratorService = require('../services/partnerMarketingOrchestratorService');
    const logger = require('../utils/logger');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    logger.info('Manual AI recommendations generation triggered by admin');
    
    const actions = await PartnerMarketingOrchestratorService.generatePlatformMarketingActions(today);
    
    res.json({
      success: true,
      message: `Generated ${actions.length} AI recommendations`,
      data: {
        actionsGenerated: actions.length,
        actions: actions.map(a => ({
          action_type: a.action_type,
          segment_id: a.segment_id,
          site_id: a.site_id,
          priority: a.priority,
          reason: a.reason
        }))
      }
    });
  } catch (error) {
    console.error('Error generating AI recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate AI recommendations'
    });
  }
})

// Get segments with capacity data for segments & capacity tab
router.get("/admin/leadstroom/segments", requireAuth, isAdmin, async (req, res) => {
  try {
    const LeadSegmentService = require('../services/leadSegmentService');
    const LeadDemandPlannerService = require('../services/leadDemandPlannerService');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all active segments
    const segments = await LeadSegmentService.getAllActiveSegments();
    
    // Get today's plans for target data
    const { data: todayPlans } = await supabaseAdmin
      .from('lead_segment_plans')
      .select('*')
      .eq('date', today.toISOString().split('T')[0]);
    
    // Get lead counts for last 7 days per segment
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentLeads } = await supabaseAdmin
      .from('leads')
      .select('segment_id, created_at')
      .gte('created_at', sevenDaysAgo.toISOString());
    
    // Get partner performance stats for response time and conversion
    const { data: partnerStats } = await supabaseAdmin
      .from('partner_performance_stats')
      .select('*');
    
    // Build segments with capacity data
    const segmentsWithCapacity = await Promise.all(segments.map(async (segment) => {
      const capacity = await LeadSegmentService.getSegmentCapacity(segment.id);
      const plan = (todayPlans || []).find(p => p.segment_id === segment.id);
      const segmentLeads = (recentLeads || []).filter(l => l.segment_id === segment.id);
      
      // Calculate occupancy (actual / capacity)
      const capacityPerDay = capacity.capacity_total_leads / 30; // Convert monthly to daily
      const actualPerDay = segmentLeads.length / 7; // Average over 7 days
      const occupancy = capacityPerDay > 0 ? Math.min(100, Math.round((actualPerDay / capacityPerDay) * 100)) : 0;
      
      // Get average response time and conversion rate from partner stats
      // This is simplified - in production you'd aggregate from actual lead data
      const avgResponseTime = '2,5 uur'; // TODO: Calculate from actual data
      const conversionRate = 25; // TODO: Calculate from actual conversions
      
      return {
        id: segment.id,
        segmentLabel: `${segment.branch} • ${segment.region}`,
        branch: segment.branch,
        region: segment.region,
        partners: capacity.capacity_partners,
        capacityPerDay: Math.round(capacityPerDay),
        occupancy,
        avgResponseTime,
        conversionRate,
        target: plan?.target_leads_per_day || 0,
        actual: Math.round(actualPerDay),
        gap: (plan?.target_leads_per_day || 0) - Math.round(actualPerDay)
      };
    }));
    
    // Calculate KPIs
    const totalPartners = new Set(segmentsWithCapacity.flatMap(s => Array(s.partners).fill(s.id))).size;
    const activePartners = totalPartners; // TODO: Calculate from actual activity
    const avgCapacityPerDay = segmentsWithCapacity.length > 0 
      ? Math.round(segmentsWithCapacity.reduce((sum, s) => sum + s.capacityPerDay, 0) / segmentsWithCapacity.length)
      : 0;
    const avgOccupancy = segmentsWithCapacity.length > 0
      ? Math.round(segmentsWithCapacity.reduce((sum, s) => sum + s.occupancy, 0) / segmentsWithCapacity.length)
      : 0;
    
    // Get low capacity segments (occupancy > 80%)
    const lowCapacitySegments = segmentsWithCapacity
      .filter(s => s.occupancy > 80)
      .sort((a, b) => b.occupancy - a.occupancy)
      .slice(0, 5)
      .map(s => ({
        segment: s.segmentLabel,
        partners: s.partners,
        occupancy: s.occupancy
      }));
    
    // Get top performers (by conversion rate)
    const topPerformers = segmentsWithCapacity
      .filter(s => s.conversionRate > 0)
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 5)
      .map(s => ({
        segment: s.segmentLabel,
        leads: s.actual * 7, // Approximate weekly leads
        conversionRate: s.conversionRate
      }));
    
    res.json({
      success: true,
      data: {
        segments: segmentsWithCapacity,
        kpis: {
          totalPartners,
          activePartners,
          capacityPerDay: avgCapacityPerDay,
          occupancy: avgOccupancy
        },
        lowCapacitySegments,
        topPerformers
      }
    });
  } catch (error) {
    console.error('Error fetching segments data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch segments data'
    });
  }
})

// Get distribution summary for Distributie & Capaciteit tab
router.get("/admin/distribution/summary", requireAuth, isAdmin, async (req, res) => {
  try {
    const LeadSegmentService = require('../services/leadSegmentService');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get last 7 days
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Get all active segments
    const segments = await LeadSegmentService.getAllActiveSegments();
    
    // Get leads for last 7 days
    const { data: recentLeads } = await supabaseAdmin
      .from('leads')
      .select('segment_id, created_at')
      .gte('created_at', sevenDaysAgo.toISOString());
    
    // Get partner performance stats for wait time calculation
    const { data: partnerStats } = await supabaseAdmin
      .from('partner_performance_stats')
      .select('partner_id, last_lead_assigned_at')
      .not('last_lead_assigned_at', 'is', null);
    
    // Build distribution data per segment
    const distribution = await Promise.all(segments.map(async (segment) => {
      const capacity = await LeadSegmentService.getSegmentCapacity(segment.id);
      const segmentLeads = (recentLeads || []).filter(l => l.segment_id === segment.id);
      
      return {
        branch: segment.branch,
        region: segment.region,
        leads: segmentLeads.length,
        partners: capacity.capacity_partners || 0
      };
    }));
    
    // Calculate overcapacity (more partners than leads needed)
    // Ratio < 0.5 means overcapacity (few leads per partner)
    const overcapacity = distribution
      .filter(item => {
      const ratio = item.leads / Math.max(item.partners, 1);
        return ratio < 0.5 && item.partners > 0;
      })
      .sort((a, b) => {
        const ratioA = a.leads / Math.max(a.partners, 1);
        const ratioB = b.leads / Math.max(b.partners, 1);
        return ratioA - ratioB;
      })
      .slice(0, 10); // Top 10
    
    // Calculate shortages (more leads than partners can handle)
    // Ratio > 5 means shortage (many leads per partner)
    const shortages = distribution
      .filter(item => {
        const ratio = item.leads / Math.max(item.partners, 1);
        return ratio > 5 && item.leads > 0;
      })
      .sort((a, b) => {
        const ratioA = a.leads / Math.max(a.partners, 1);
        const ratioB = b.leads / Math.max(b.partners, 1);
        return ratioB - ratioA;
      })
      .slice(0, 10); // Top 10
    
    // Calculate fairness (average wait time since last lead per partner)
    let avgWaitHours = 0;
    let variance = 0;
    
    if (partnerStats && partnerStats.length > 0) {
      const now = new Date();
      const waitTimes = partnerStats
        .map(stat => {
          if (!stat.last_lead_assigned_at) return null;
          const lastLead = new Date(stat.last_lead_assigned_at);
          return (now - lastLead) / (1000 * 60 * 60); // Convert to hours
        })
        .filter(time => time !== null);
      
      if (waitTimes.length > 0) {
        avgWaitHours = waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;
        
        // Calculate variance
        const mean = avgWaitHours;
        const squaredDiffs = waitTimes.map(time => Math.pow(time - mean, 2));
        variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / waitTimes.length;
      }
    }
    
    res.json({
      success: true,
      data: {
        overcapacity: overcapacity.map(item => ({
          branch: item.branch,
          region: item.region,
          partners: item.partners,
          leads: item.leads
        })),
        shortages: shortages.map(item => ({
          branch: item.branch,
          region: item.region,
          partners: item.partners,
          leads: item.leads
        })),
        fairness: {
          avgWaitHours: Math.round(avgWaitHours * 10) / 10,
          variance: Math.round(variance * 10) / 10
        },
        distribution: distribution.sort((a, b) => {
          // Sort by branch, then region
          if (a.branch !== b.branch) {
            return a.branch.localeCompare(b.branch);
          }
          return a.region.localeCompare(b.region);
        })
      }
    });
  } catch (error) {
    console.error('Error fetching distribution summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch distribution summary'
        });
      }
    });

// Get single AI recommendation by ID
router.get("/admin/leadstroom/ai-actions/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: rec, error } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .select(`
        *,
        lead_segments (id, code, branch, region)
      `)
      .eq('id', id)
      .is('partner_id', null) // Platform recommendations only
      .single();
    
    if (error) throw error;
    if (!rec) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      });
    }
    
    const segment = rec.lead_segments;
    const actionDetails = rec.action_details || {};
    
    // Try to get CPL data from lead_generation_stats
    let currentCpl = null;
    let targetCpl = null;
    
    if (segment) {
      try {
        // Get recent stats for CPL calculation (last 30 days)
    const { data: stats } = await supabaseAdmin
          .from('lead_generation_stats')
          .select('avg_cpl, total_revenue, leads_generated')
          .eq('segment_id', segment.id)
          .order('date', { ascending: false })
          .limit(30);
        
        if (stats && stats.length > 0) {
          // Use avg_cpl from most recent stats, or calculate from revenue/leads
          const recentStats = stats.filter(s => s.leads_generated > 0);
          if (recentStats.length > 0) {
            // Try to use avg_cpl from stats first
            const statsWithCpl = recentStats.filter(s => s.avg_cpl && s.avg_cpl > 0);
            if (statsWithCpl.length > 0) {
              // Average of recent avg_cpl values
              currentCpl = statsWithCpl.reduce((sum, s) => sum + parseFloat(s.avg_cpl || 0), 0) / statsWithCpl.length;
            } else {
              // Calculate from total revenue / total leads
              const totalRevenue = recentStats.reduce((sum, s) => sum + parseFloat(s.total_revenue || 0), 0);
              const totalLeads = recentStats.reduce((sum, s) => sum + parseInt(s.leads_generated || 0), 0);
              if (totalLeads > 0) {
                currentCpl = totalRevenue / totalLeads;
              }
            }
          }
        }
        
        // Get target CPL from segment plan (if available)
        const { data: plan } = await supabaseAdmin
          .from('lead_segment_plans')
          .select('cpl_target')
          .eq('segment_id', segment.id)
          .order('date', { ascending: false })
          .limit(1)
          .single();
        
        if (plan?.cpl_target) {
          targetCpl = parseFloat(plan.cpl_target);
        }
      } catch (cplError) {
        // Ignore CPL errors, just use defaults
        console.warn('Error fetching CPL data:', cplError);
      }
    }
    
    // Add CPL to actionDetails if not already present
    if (!actionDetails.current_cpl && currentCpl !== null) {
      actionDetails.current_cpl = currentCpl;
    }
    if (!actionDetails.target_cpl && targetCpl !== null) {
      actionDetails.target_cpl = targetCpl;
    }
    
    res.json({
      success: true,
      data: {
        id: rec.id,
        segmentLabel: segment ? `${segment.branch} • ${segment.region}` : 'Onbekend segment',
        summary: rec.reasoning || '',
        fullSummary: rec.reasoning || '',
        impact: actionDetails.lead_gap > 10 ? 'Hoog' : actionDetails.lead_gap > 5 ? 'Medium' : 'Laag',
        status: rec.status,
        leadGap: actionDetails.lead_gap ? `${actionDetails.lead_gap}/dag` : '-',
        actionType: rec.action_type,
        actionDetails: actionDetails,
        segment: segment
      }
    });
  } catch (error) {
    console.error('Error fetching AI recommendation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch recommendation'
    });
  }
})

// Get AI recommendations for AI actions tab
router.get("/admin/leadstroom/ai-actions", requireAuth, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = supabaseAdmin
      .from('ai_marketing_recommendations')
      .select(`
        *,
        lead_segments (id, code, branch, region)
      `)
      .is('partner_id', null) // Platform recommendations only
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: recommendations, error } = await query;
    
    if (error) throw error;
    
    // Format recommendations for display
    const formatted = (recommendations || []).map(rec => {
      const segment = rec.lead_segments;
      const actionDetails = rec.action_details || {};
      
      // Determine impact based on lead gap
      let impact = 'Laag';
      if (actionDetails.lead_gap > 10) impact = 'Hoog';
      else if (actionDetails.lead_gap > 5) impact = 'Medium';
      
      // Format summary
      let summary = '';
      if (rec.action_type === 'create_landing_page') {
        summary = `Nieuwe landingspagina: ${actionDetails.page_type || 'main'}`;
      } else if (rec.action_type === 'publish_landing_page') {
        summary = 'Publiceer landingspagina';
      } else if (rec.action_type === 'create_campaign') {
        summary = `Nieuwe Google Ads campagne: ${actionDetails.campaign_name || 'Onbekend'}`;
      } else if (rec.action_type === 'increase_campaign_budget') {
        summary = 'Verhoog campagne budget';
      } else {
        summary = rec.reason || rec.action_type || 'Onbekende actie';
      }
      
      // Format last updated
      const lastUpdated = rec.updated_at || rec.created_at;
      const hoursAgo = Math.floor((new Date() - new Date(lastUpdated)) / (1000 * 60 * 60));
      const lastUpdatedText = hoursAgo < 1 ? 'Net' : hoursAgo === 1 ? '1 uur geleden' : `${hoursAgo} uur geleden`;
      
      return {
        id: rec.id,
        segmentLabel: segment ? `${segment.branch} • ${segment.region}` : 'Onbekend segment',
        summary,
        fullSummary: rec.reasoning || summary,
        impact,
        status: rec.status === 'pending' ? 'Wacht op review' : 
               rec.status === 'approved' ? 'Goedgekeurd' :
               rec.status === 'executed' ? 'Uitgevoerd' :
               rec.status === 'rejected' ? 'Afgewezen' : rec.status,
        lastUpdated: lastUpdatedText,
        leadGap: actionDetails.lead_gap ? `${actionDetails.lead_gap}/dag` : '-',
        actionType: rec.action_type,
        actionDetails: actionDetails
      };
    });
    
    // Calculate KPIs
    const activeCampaigns = formatted.filter(r => r.status === 'Uitgevoerd').length;
    const pendingRecommendations = formatted.filter(r => r.status === 'Wacht op review').length;

    res.json({
      success: true,
      data: {
        recommendations: formatted,
        kpis: {
          activeCampaigns,
          pendingRecommendations,
          impact: '+27%' // TODO: Calculate from actual data
        }
      }
    });
  } catch (error) {
    console.error('Error fetching AI actions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch AI actions'
    });
  }
})

// Get content backlog for content & campaigns tab
router.get("/admin/leadstroom/content-backlog", requireAuth, isAdmin, async (req, res) => {
  try {
    const { segment, type, status } = req.query;
    
    // Get landing pages
    let lpQuery = supabaseAdmin
      .from('partner_landing_pages')
      .select(`
        *,
        lead_segments (id, code, branch, region),
        sites (id, name, domain)
      `)
      .is('partner_id', null) // Platform landing pages only
      .order('updated_at', { ascending: false });
    
    if (status) {
      if (status === 'idea') lpQuery = lpQuery.eq('status', 'concept');
      else if (status === 'concept') lpQuery = lpQuery.eq('status', 'concept');
      else if (status === 'review') lpQuery = lpQuery.eq('status', 'review');
      else if (status === 'approved') lpQuery = lpQuery.eq('status', 'approved');
      else if (status === 'live') lpQuery = lpQuery.eq('status', 'live');
    }
    
    const { data: landingPages, error: lpError } = await lpQuery;
    
    if (lpError) throw lpError;
    
    // Get AI recommendations that are content-related
    let recQuery = supabaseAdmin
      .from('ai_marketing_recommendations')
      .select(`
        *,
        lead_segments (id, code, branch, region)
      `)
      .is('partner_id', null)
      .in('action_type', ['create_landing_page', 'publish_landing_page'])
      .order('created_at', { ascending: false });
    
    if (status) {
      recQuery = recQuery.eq('status', status === 'idea' ? 'pending' : status);
    }
    
    const { data: recommendations, error: recError } = await recQuery;
    
    if (recError) throw recError;
    
    // Combine and format
    const contentItems = [];
    
    // Add landing pages
    (landingPages || []).forEach(lp => {
      const seg = lp.lead_segments;
      // Filter by segment if provided
      if (segment && seg) {
        const filterParts = segment.split(' • ');
        if (filterParts.length === 2) {
          const filterBranch = filterParts[0].toLowerCase();
          const filterRegion = filterParts[1].toLowerCase();
          if (seg.branch?.toLowerCase() !== filterBranch || seg.region?.toLowerCase() !== filterRegion) {
            return;
          }
        }
      }
      if (type && type !== 'landingpage') return;
      
      const lastUpdated = lp.updated_at || lp.created_at;
      const hoursAgo = Math.floor((new Date() - new Date(lastUpdated)) / (1000 * 60 * 60));
      const lastUpdatedText = hoursAgo < 1 ? 'Net' : 
                            hoursAgo === 1 ? '1 uur geleden' : 
                            hoursAgo < 24 ? `${hoursAgo} uur geleden` :
                            Math.floor(hoursAgo / 24) === 1 ? '1 dag geleden' :
                            `${Math.floor(hoursAgo / 24)} dagen geleden`;
      
      contentItems.push({
        id: lp.id,
        type: 'Landingspagina',
        title: lp.title || lp.path,
        segment: seg ? `${seg.branch} • ${seg.region}` : 'Onbekend',
        channel: 'Website/SEO',
        status: lp.status === 'concept' ? 'Concept' :
               lp.status === 'review' ? 'Wacht op review' :
               lp.status === 'approved' ? 'Goedgekeurd' :
               lp.status === 'live' ? 'Live' : lp.status,
        lastUpdated: lastUpdatedText,
        path: lp.path,
        pageType: lp.page_type
      });
    });
    
    // Add recommendations as "ideas"
    (recommendations || []).forEach(rec => {
      const seg = rec.lead_segments;
      // Filter by segment if provided
      if (segment && seg) {
        const filterParts = segment.split(' • ');
        if (filterParts.length === 2) {
          const filterBranch = filterParts[0].toLowerCase();
          const filterRegion = filterParts[1].toLowerCase();
          if (seg.branch?.toLowerCase() !== filterBranch || seg.region?.toLowerCase() !== filterRegion) {
            return;
          }
        }
      }
      if (type && type !== 'landingpage') return;
      if (status && status !== 'idea') return;
      
      const actionDetails = rec.action_details || {};
      const lastUpdated = rec.updated_at || rec.created_at;
      const hoursAgo = Math.floor((new Date() - new Date(lastUpdated)) / (1000 * 60 * 60));
      const lastUpdatedText = hoursAgo < 1 ? 'Net' : 
                            hoursAgo === 1 ? '1 uur geleden' : 
                            hoursAgo < 24 ? `${hoursAgo} uur geleden` :
                            Math.floor(hoursAgo / 24) === 1 ? '1 dag geleden' :
                            `${Math.floor(hoursAgo / 24)} dagen geleden`;
      
      contentItems.push({
        id: rec.id,
        type: 'Landingspagina',
        title: actionDetails.suggested_path || `Nieuwe ${actionDetails.page_type || 'main'} pagina`,
        segment: seg ? `${seg.branch} • ${seg.region}` : 'Onbekend',
        channel: 'Website/SEO',
        status: 'Idee',
        lastUpdated: lastUpdatedText,
        recommendationId: rec.id,
        actionType: rec.action_type
      });
    });
    
    res.json({
      success: true,
      data: contentItems
    });
  } catch (error) {
    console.error('Error fetching content backlog:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch content backlog'
    });
  }
})

// Reject recommendation
router.post("/marketing-recommendations/:recId/reject", requireAuth, async (req, res) => {
  try {
    const { recId } = req.params;
    const userId = req.user.id;
    const { feedback } = req.body;
    
    // Get recommendation
    const { data: rec, error: recError } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .select('*')
      .eq('id', recId)
      .single();
    
    if (recError) throw recError;
    
    // Check ownership (admin can reject platform recommendations, partners can reject their own)
    const isAdmin = req.user.user_metadata?.role === 'admin';
    if (!isAdmin && rec.partner_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Update status and store feedback in action_details
    const updateData = {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId
    };
    
    // Store feedback in action_details if provided
    if (feedback) {
      const actionDetails = rec.action_details || {};
      actionDetails.feedback = feedback;
      updateData.action_details = actionDetails;
    }
    
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .update(updateData)
      .eq('id', recId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error rejecting recommendation:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to reject recommendation' 
    });
  }
});

// Update recommendation (for feedback, etc.)
router.patch("/marketing-recommendations/:recId", requireAuth, async (req, res) => {
  try {
    const { recId } = req.params;
    const userId = req.user.id;
    const { feedback } = req.body;
    
    // Get recommendation
    const { data: rec, error: recError } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .select('*')
      .eq('id', recId)
      .single();
    
    if (recError) throw recError;
    
    // Check ownership
    const isAdmin = req.user.user_metadata?.role === 'admin';
    if (!isAdmin && rec.partner_id !== userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Unauthorized' 
      });
    }
    
    // Update action_details with feedback
    if (feedback) {
      const actionDetails = rec.action_details || {};
      actionDetails.feedback = feedback;
      
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('ai_marketing_recommendations')
        .update({
          action_details: actionDetails,
          updated_at: new Date().toISOString()
        })
        .eq('id', recId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      res.json({ success: true, data: updated });
    } else {
      res.json({ success: true, data: rec });
    }
  } catch (error) {
    console.error('Error updating recommendation:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to update recommendation' 
    });
  }
});

// POST /api/admin/form-builder/suggestions
// Generate form template suggestions using AI
router.post("/admin/form-builder/suggestions", requireAuth, isAdmin, async (req, res) => {
  try {
    const { industryId, industryName, existingConfig } = req.body;

    if (!industryId || !industryName) {
      return res.status(400).json({
        success: false,
        error: 'industryId en industryName zijn verplicht'
      });
    }

    // Get OpenAI client
    const OpenAI = require('openai');
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key niet geconfigureerd'
      });
    }

    const openai = new OpenAI({ apiKey });

    // Build prompt with industry templates
    const industryNameLower = industryName.toLowerCase();
    
    const prompt = `You are the Form Question Suggestion Engine for a modern lead platform.

🔥 CRITICAL: MODERN FORM BUILDER FIXED 8-STEP STRUCTURE

Our form has a HARD-CODED 10-step structure that you CANNOT change:

1. step-job-type (STRUCTURE FIXED - but YOU MUST generate the options for this step!)
2. step-subcategory (STRUCTURE FIXED - but YOU MUST generate the options for this step!)
3. step-scope (STRUCTURE FIXED - but YOU MUST generate the options for this step!)
4. step-urgency (FIXED - standard options - DO NOT TOUCH)
5. step-description (STRUCTURE FIXED - but YOU MUST generate example sentences for this step!)
6. step-budget (FIXED - standard options - DO NOT TOUCH)
7. step-location (FIXED - postcode, city, street - DO NOT TOUCH)
8. step-contact-name (FIXED - first_name, last_name - DO NOT TOUCH)
9. step-contact-email (FIXED - email - SECOND TO LAST CONTACT STEP - DO NOT TOUCH)
10. step-contact-phone (FIXED - phone - ALWAYS LAST CONTACT STEP - DO NOT TOUCH)

🔥 YOU MUST CUSTOMIZE THESE 4 STEPS:
- Step 1 (job-type): Generate industry-specific main job type options for radio cards (REQUIRED!)
- Step 2 (subcategory): Generate industry-specific options for radio cards (REQUIRED!)
- Step 3 (scope): Generate industry-specific options for radio cards (REQUIRED!)
- Step 5 (description): Generate example sentences for the textarea (REQUIRED!)

YOU MUST NEVER:
- Change step order
- Add or remove steps
- Modify fixed steps (4, 6, 7, 8, 9, 10)
- Generate contact fields (name, email, phone)
- Generate location fields (postcode, city, street)
- Generate budget or urgency fields

MODERN FORM BUILDER FORMAT REQUIREMENTS:
- All options must be formatted as radio-cards (large, clickable cards)
- Use type: "radio-cards" (NOT "select" or "radio")
- Options must be consumer-friendly, clear, and concise
- Max 8 options per field
- Always include a fallback option like "Ik weet het niet precies" or "Anders"

OUTPUT FORMAT
Return JSON with ONLY the variable parts you customize:

{
  "step1_job_type": {
    "options": [
      "Main job type option 1",
      "Main job type option 2",
      "Main job type option 3",
      "Ik weet het niet precies"
    ]
  },
  "step2_subcategory": {
    "options": [
      "Option 1",
      "Option 2",
      "Option 3",
      "Ik weet het niet precies"
    ]
  },
  "step3_scope": {
    "options": [
      "Klein (1-2 ruimtes)",
      "Gemiddeld (3-5 ruimtes)",
      "Groot (complete woning)",
      "Ik weet het niet precies"
    ]
  },
  "step5_description": {
    "exampleSentences": [
      "Voorbeeldzin 1",
      "Voorbeeldzin 2",
      "Voorbeeldzin 3"
    ]
  }
}

STRICT ORDERING LOGIC
Your variable steps must follow this logical order:

1) Job / assignment type ("Waar heb je een [vakman] voor nodig?")
2) Scope / size / amount
3) Material / object type / current state
4) Access / location-in-house / reachability (if relevant)
5) Extra details (optional textarea)

Urgency, budget and contact are NOT your responsibility; those are fixed steps before/after your part.

INDUSTRY TEMPLATES (USE AS DEFAULTS)

You must use these as the canonical templates and only adapt wording to context.
Do NOT change the intent of the questions.

1) dakdekker / dakdekkers
- Step: job_type → options:
  ["Dakreparatie","Dakrenovatie (vervanging)","Plaatsing van nieuw dak",
   "Dakgoot reparatie of vervanging","Dakreiniging of -onderhoud",
   "Dakisolatie","Dakcoating aanbrengen","Andere dienst/klus"]
- Step: roof_size → options:
  ["Klein (tot 50 m²)","Gemiddeld (50–150 m²)",
   "Groot (meer dan 150 m²)","Ik weet het niet precies, maar ik denk: …"]
- Step: roof_material → options like:
  ["Plat dak – bitumen (dakleer)","Plat dak – kunststof (PVC / EPDM)",
   "Hellend dak – dakpannen","Hellend dak – leien",
   "Groendak / sedumdak","Anders, namelijk: …"]
- Step: accessibility (good / multi floor / difficult / unknown)
- Step: extra_details (textarea)

2) schilder / schilders
- Step: job_type: binnenschilderwerk, buitenschilderwerk, complete woning, kozijnen/deuren,
  muren/plafonds, trap, houtrot + schilderen, andere dienst.
- Step: surface_state: hout goed / hout slecht, muur netjes / met scheuren, metaal, anders.
- Step: scope: kleine klus (1–2 ruimtes), middelgroot (3–5), complete woning, alleen buiten, alleen kozijnen/deuren.
- Step: preparation: oude verf verwijderen, houtrot reparatie, scheuren vullen, niets / weet ik niet.
- Step: extra_details (textarea).

3) elektricien
- Step: job_type: stopcontact/lichtpunten, groepenkast, stroomstoring, extra groep (inductie),
  buitenverlichting, laadpaal/3-fasen, volledige installatie, anders.
- Step: property_type: appartement, tussenwoning, hoekwoning, 2-onder-1-kap, vrijstaand, bedrijfspand, anders.
- Step: accessibility: meterkast/bekabeling goed, meerdere verdiepingen, moeilijk, weet ik niet.
- Step: safety: nu storing, vermoed onveilig, geplande klus, weet ik niet.
- Step: extra_details (textarea).

4) loodgieter
- Step: job_type: lekkage, verstopping, CV/verwarming, kraan/leiding, badkamer/toilet, keuken, radiatoren, anders.
- Step: location_in_house: badkamer, toilet, keuken, woonkamer/slaapkamer, buiten, meerdere ruimtes.
- Step: severity: directe waterschade, werkt niet goed maar geen nood, geplande klus, weet ik niet.
- Step: accessibility: leidingen goed / deels / moeilijk / weet ik niet.
- Step: extra_details (textarea).

5) glaszetters
- Step: job_type: ruit vervangen, enkel → dubbel/HR++, nieuwe ramen/kozijnen, glas in deuren,
  glas in dakkapel/dakraam, ander glaswerk.
- Step: amount: 1, 2–3, 4–6, >6, weet ik niet.
- Step: floors: begane grond, 1e verdieping, 2e of hoger, meerdere verdiepingen.
- Step: frame_type: hout, kunststof, aluminium, weet ik niet.
- Step: extra_details (textarea).

6) hoveniers
- Step: job_type: tuinaanleg, tuinrenovatie, gazon, schutting, bestrating/terras, bomen snoeien/verwijderen,
  periodiek onderhoud, anders.
- Step: garden_size: klein / gemiddeld / groot / weet ik niet.
- Step: current_state: kale tuin, deels naar wens, volledig vernieuwen, vooral bestrating, vooral groen.
- Step: accessibility: achterom, alleen via woning, moeilijk, weet ik niet.
- Step: style_preferences: textarea.

7) timmerman
- Step: job_type: maatwerk kasten/meubels, traprenovatie/nieuwe trap, deuren/kozijnen, zolder/vliering,
  houtrot reparatie, schuur/overkapping, binnenwanden/plafonds, anders.
- Step: location_in_house: woonkamer, keuken, slaapkamer, zolder, buiten, meerdere ruimtes.
- Step: scope: klein (1 element), middelgroot, grote verbouwing, weet ik niet.
- Step: finish_level: functioneel, netjes, luxe maatwerk, weet ik niet.
- Step: extra_details.

8) installatiebedrijven
- Step: job_type: CV-ketel vervangen/plaatsen, warmtepomp, airco, ventilatie, vloerverwarming, complete installatie, anders.
- Step: property_type: appartement, tussenwoning, hoekwoning, 2-onder-1-kap, vrijstaand, bedrijfspand.
- Step: current_installation: bestaande installatie vervangen, deels uitbreiden, alles nieuw, weet ik niet.
- Step: insulation_level: goed, redelijk, nauwelijks, weet ik niet.
- Step: preferences: merk/type/wensen (textarea).

ADAPTATION RULES
- If the system passes you additional context (e.g. specific city, roof type, or landing page text),
  you may slightly adapt option wording, but not the core structure.
- Always keep the order: job_type → scope → material/state → accessibility/situation → extra_details.
- Keep Dutch language, clear and simple.
- Focus on maximising lead quality without scaring users away.

If the industry is unknown:
- Infer the closest template.
- Keep question count low (3–4 steps).
- Prioritise job_type, scope, material/state, extra_details.

Branche: ${industryName}
Industry ID: ${industryId}

🔥 CRITICAL: You MUST generate step1_job_type options! This is the FIRST question users see and it MUST have options.
If you don't generate step1_job_type options, the form will be broken.

${existingConfig ? 'Er bestaat al een formulier configuratie. Genereer ALLE variabele stappen (step1, step2, step3, step5).' : 'Genereer ALLE variabele stappen voor deze branche (step1, step2, step3, step5).'}

Geef ALLEEN het JSON object met ALLE variabele stappen terug (step1_job_type, step2_subcategory, step3_scope, step5_description), zonder markdown code blocks of extra tekst.`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een expert in het ontwerpen van aanvraagformulieren. Geef altijd een geldig JSON object terug zonder extra tekst.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse JSON response
    let aiResponse;
    try {
      // Remove markdown code blocks if present
      const cleaned = responseText.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
      aiResponse = JSON.parse(cleaned);
      
      // Debug: log what AI returned
      console.log('AI Response received:', JSON.stringify(aiResponse, null, 2));
      console.log('Step1 job_type options:', aiResponse.step1_job_type?.options);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return res.status(500).json({
        success: false,
        error: 'AI response kon niet worden geparsed: ' + parseError.message
      });
    }

    // AI now returns only variable parts: step2_subcategory, step3_scope, step5_description
    // We need to merge these into the existing fixed config structure
    
    // Get existing config or create default
    let baseConfig = existingConfig;
    if (!baseConfig || !baseConfig.steps || baseConfig.steps.length === 0) {
      // Create default modern form builder config with 8 fixed steps
      baseConfig = {
        version: 1,
        industryId: industryId,
        title: `Aanvraagformulier ${industryName}`,
        steps: [
          { id: 'step-job-type', order: 1, isFixed: true, title: 'Wat voor klus?', fields: [{ id: 'job_type', type: 'radio-cards', label: 'Wat voor klus?', required: true, options: [] }] },
          { id: 'step-subcategory', order: 2, isFixed: true, isVariable: true, title: 'Meer details', fields: [{ id: 'subcategory', type: 'radio-cards', label: 'Meer details', required: true, options: [] }] },
          { id: 'step-scope', order: 3, isFixed: true, isVariable: true, title: 'Omvang van de klus', fields: [{ id: 'scope', type: 'radio-cards', label: 'Hoe groot is de klus ongeveer?', required: true, options: [] }] },
          { id: 'step-urgency', order: 4, isFixed: true, title: 'Wanneer wil je starten?', fields: [{ id: 'urgency', type: 'radio-cards', label: 'Wanneer wil je starten?', required: true, options: ['Met spoed / zo snel mogelijk', 'Binnen enkele dagen / weken', 'Binnen 3 maanden', 'Binnen 6 maanden', 'In overleg / nader te bepalen'] }] },
          { id: 'step-description', order: 5, isFixed: true, isVariable: true, title: 'Extra informatie', fields: [{ id: 'description', type: 'textarea-with-examples', label: 'Wil je de situatie nog kort toelichten?', required: false, exampleSentences: [] }] },
          { id: 'step-budget', order: 6, isFixed: true, title: 'Wat is je budget?', fields: [{ id: 'budget', type: 'radio-cards', label: 'Wat is je budget voor deze klus?', required: true, options: ['Tot €500', '€500 – €1.500', '€1.500 – €3.000', '€3.000 – €7.500', 'Meer dan €7.500', 'Ik weet het nog niet precies'] }] },
          { id: 'step-location', order: 7, isFixed: true, title: 'Waar is de klus?', fields: [{ id: 'postcode', type: 'text', label: 'Postcode', required: true }, { id: 'city', type: 'text', label: 'Plaats', required: true }, { id: 'street', type: 'text', label: 'Straat en huisnummer', required: false }] },
          { id: 'step-contact-name', order: 8, isFixed: true, title: 'Wat is je naam?', description: 'Vertel ons je naam zodat we je persoonlijk kunnen helpen.', fields: [{ id: 'first_name', type: 'text', label: 'Voornaam', required: true }, { id: 'last_name', type: 'text', label: 'Achternaam', required: true }] },
          { id: 'step-contact-email', order: 9, isFixed: true, title: 'Wat is je e-mailadres?', description: 'We gebruiken je e-mailadres om je offertes te sturen en contact met je op te nemen.', fields: [{ id: 'email', type: 'email', label: 'E-mailadres', required: true }] },
          { id: 'step-contact-phone', order: 10, isFixed: true, title: 'Wat is je telefoonnummer?', description: 'We bellen je graag om je aanvraag door te nemen en de beste vakmensen voor je te vinden.', fields: [{ id: 'phone', type: 'tel', label: 'Telefoonnummer', required: true }] }
        ]
      };
    } else {
      // Ensure step-job-type exists in existing config
      const hasJobTypeStep = baseConfig.steps.some(s => s.id === 'step-job-type');
      if (!hasJobTypeStep) {
        baseConfig.steps.unshift({
          id: 'step-job-type',
          order: 1,
          isFixed: true,
          title: 'Wat voor klus?',
          fields: [{ id: 'job_type', type: 'radio-cards', label: 'Wat voor klus?', required: true, options: [] }]
        });
        // Reorder other steps
        baseConfig.steps.forEach((step, index) => {
          if (step.id !== 'step-job-type') {
            step.order = index + 1;
          }
        });
      }
    }

    // Merge AI response into fixed steps
    // Step 1: job-type (REQUIRED - must have options!)
    const jobTypeStep = baseConfig.steps.find(s => s.id === 'step-job-type');
    console.log('Looking for step-job-type in baseConfig:', jobTypeStep ? 'Found' : 'NOT FOUND');
    console.log('AI Response step1_job_type:', aiResponse.step1_job_type);
    
    if (jobTypeStep && jobTypeStep.fields[0]) {
      if (aiResponse.step1_job_type && aiResponse.step1_job_type.options && aiResponse.step1_job_type.options.length > 0) {
        console.log('Using AI options for step1:', aiResponse.step1_job_type.options);
        jobTypeStep.fields[0].options = aiResponse.step1_job_type.options;
      } else {
        console.log('AI did not provide step1 options, using fallback');
        // Fallback: generate basic options based on industry name if AI didn't provide them
        const industryLower = industryName.toLowerCase();
        let fallbackOptions = [];
        
        if (industryLower.includes('installatie') || industryLower.includes('installatiebedrijf')) {
          fallbackOptions = ['CV-ketel vervangen/plaatsen', 'Warmtepomp', 'Airco', 'Ventilatie', 'Vloerverwarming', 'Complete installatie', 'Anders'];
        } else if (industryLower.includes('dakdekker') || industryLower.includes('dak')) {
          fallbackOptions = ['Dakreparatie', 'Dakrenovatie (vervanging)', 'Plaatsing van nieuw dak', 'Dakgoot reparatie', 'Dakisolatie', 'Anders'];
        } else if (industryLower.includes('schilder')) {
          fallbackOptions = ['Binnenschilderwerk', 'Buitenschilderwerk', 'Complete woning', 'Kozijnen en deuren', 'Muren en plafonds', 'Anders'];
        } else if (industryLower.includes('elektricien') || industryLower.includes('elektra')) {
          fallbackOptions = ['Stopcontacten/lichtpunten', 'Groepenkast', 'Stroomstoring', 'Extra groepen', 'Buitenverlichting', 'Volledige installatie', 'Anders'];
        } else if (industryLower.includes('loodgieter')) {
          fallbackOptions = ['Lekkage', 'Verstopping', 'CV/verwarming', 'Kraan/leiding', 'Badkamer/toilet', 'Keuken', 'Anders'];
        } else {
          fallbackOptions = ['Reparatie', 'Onderhoud', 'Nieuwe installatie', 'Renovatie', 'Anders'];
        }
        
        jobTypeStep.fields[0].options = fallbackOptions;
      }
        jobTypeStep.fields[0].type = 'radio-cards'; // Ensure modern form format
    }
    
    // Step 2: subcategory
    if (aiResponse.step2_subcategory && aiResponse.step2_subcategory.options) {
      const subcategoryStep = baseConfig.steps.find(s => s.id === 'step-subcategory');
      if (subcategoryStep && subcategoryStep.fields[0]) {
        subcategoryStep.fields[0].options = aiResponse.step2_subcategory.options;
        subcategoryStep.fields[0].type = 'radio-cards'; // Ensure Trustoo format
      }
    }

    // Step 3: scope
    if (aiResponse.step3_scope && aiResponse.step3_scope.options) {
      const scopeStep = baseConfig.steps.find(s => s.id === 'step-scope');
      if (scopeStep && scopeStep.fields[0]) {
        scopeStep.fields[0].options = aiResponse.step3_scope.options;
        scopeStep.fields[0].type = 'radio-cards'; // Ensure Trustoo format
      }
    }

    // Step 5: description examples
    if (aiResponse.step5_description && aiResponse.step5_description.exampleSentences) {
      const descriptionStep = baseConfig.steps.find(s => s.id === 'step-description');
      if (descriptionStep && descriptionStep.fields[0]) {
        descriptionStep.fields[0].exampleSentences = aiResponse.step5_description.exampleSentences;
        descriptionStep.fields[0].type = 'textarea-with-examples'; // Ensure modern form format
      }
    }

    // Return the merged config
    const config = {
      success: true,
      config: baseConfig
    };

    // Sort steps by order
    config.config.steps.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Return the full config with merged AI suggestions
    res.json(config);

  } catch (error) {
    console.error('Error generating AI form suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Fout bij genereren van AI suggesties'
    });
  }
});

// =====================================================
// FORM ANALYTICS TRACKING ENDPOINTS
// =====================================================

// POST /api/form-analytics/track
// Track form interaction events (step start, complete, drop-off, field interaction)
router.post('/form-analytics/track', async (req, res) => {
  try {
    const {
      session_id,
      industry_id,
      form_template_id,
      lead_id,
      type, // 'step_start', 'step_complete', 'drop_off', 'field_interaction'
      step_id,
      step_order,
      step_title,
      field_id,
      field_type,
      field_value,
      field_values, // For step_complete events
      field_value_metadata,
      started_at,
      completed_at,
      time_spent_seconds,
      dropped_off,
      drop_off_reason,
      referrer,
      source_keyword,
      source_campaign_id,
      user_agent
    } = req.body;

    // Validate required fields
    if (!session_id || !type) {
      return res.status(400).json({ 
        success: false,
        error: 'session_id and type are required' 
      });
    }

    // Build analytics record
    const analyticsData = {
      session_id,
      industry_id: industry_id || null,
      form_template_id: form_template_id || null,
      lead_id: lead_id || null,
      step_id: step_id || null,
      step_order: step_order || null,
      step_title: step_title || null,
      field_id: field_id || null,
      field_type: field_type || null,
      field_value: field_value || null,
      field_value_metadata: field_value_metadata || null,
      started_at: started_at || new Date().toISOString(),
      completed_at: completed_at || null,
      time_spent_seconds: time_spent_seconds || null,
      dropped_off: dropped_off || false,
      drop_off_reason: drop_off_reason || null,
      referrer: referrer || null,
      source_keyword: source_keyword || null,
      source_campaign_id: source_campaign_id || null,
      user_agent: user_agent || req.headers['user-agent'] || null
    };

    // For step_complete events, extract field values
    if (type === 'step_complete' && field_values && typeof field_values === 'object') {
      // Store field values in metadata
      analyticsData.field_value_metadata = {
        ...analyticsData.field_value_metadata,
        all_field_values: field_values
      };
    }

    // Insert analytics event
    const { data, error } = await supabaseAdmin
      .from('form_analytics')
      .insert([analyticsData])
      .select()
      .single();

    if (error) {
      console.error('Error inserting form analytics:', error);
      throw error;
    }

    res.json({ 
      success: true,
      id: data.id 
    });
  } catch (error) {
    console.error('Form analytics tracking error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Tracking failed' 
    });
  }
});

// POST /api/form-analytics/link-lead
// Link analytics session to lead after form submission
router.post('/form-analytics/link-lead', async (req, res) => {
  try {
    const { session_id, lead_id } = req.body;

    if (!session_id || !lead_id) {
      return res.status(400).json({ 
        success: false,
        error: 'session_id and lead_id are required' 
      });
    }

    // Update all analytics events for this session with lead_id
    const { data, error } = await supabaseAdmin
      .from('form_analytics')
      .update({ lead_id })
      .eq('session_id', session_id)
      .is('lead_id', null) // Only update if lead_id is null
      .select();

    if (error) {
      console.error('Error linking analytics to lead:', error);
      throw error;
    }

    res.json({ 
      success: true,
      updated_count: data?.length || 0
    });
  } catch (error) {
    console.error('Error linking analytics to lead:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to link analytics' 
    });
  }
});

// GET /api/form-analytics/performance/:industryId
// Get form performance metrics for an industry
router.get('/form-analytics/performance/:industryId', requireAuth, async (req, res) => {
  try {
    const { industryId } = req.params;
    const { form_template_id, days = 30 } = req.query;

    // Check permissions (admin or industry owner)
    const isAdmin = req.user.user_metadata?.role === 'admin';
    if (!isAdmin) {
      // Check if user has access to this industry
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('lead_industries')
        .eq('id', req.user.id)
        .single();

      if (!profile || !profile.lead_industries?.includes(parseInt(industryId))) {
        return res.status(403).json({ 
          success: false,
          error: 'Unauthorized' 
        });
      }
    }

    // Build query
    let query = supabaseAdmin
      .from('form_step_performance')
      .select('*')
      .eq('industry_id', parseInt(industryId))
      .gte('last_seen_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('step_order');

    if (form_template_id) {
      query = query.eq('form_template_id', form_template_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching form performance:', error);
      throw error;
    }

    res.json({ 
      success: true,
      data: data || [],
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching form performance:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch performance data' 
    });
  }
});

// POST /api/form-analytics/refresh-performance
// Refresh materialized view (admin only)
router.post('/form-analytics/refresh-performance', requireAuth, isAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.rpc('refresh_form_step_performance');

    if (error) {
      console.error('Error refreshing form step performance:', error);
      throw error;
    }

    res.json({ 
      success: true,
      message: 'Performance view refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing performance view:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to refresh performance view' 
    });
  }
});

// =====================================================
// LEAD VALUE PREDICTION ENDPOINTS
// =====================================================

// GET /api/lead-predictions/:leadId
// Get prediction for a specific lead
router.get('/lead-predictions/:leadId', requireAuth, async (req, res) => {
  try {
    const { leadId } = req.params;
    const leadValuePredictionService = require('../services/leadValuePredictionService');
    
    const prediction = await leadValuePredictionService.getPrediction(leadId);
    
    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: 'No prediction found for this lead'
      });
    }

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Error fetching lead prediction:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch prediction'
    });
  }
});

// GET /api/lead-predictions/industry/:industryId/stats
// Get prediction statistics for an industry
router.get('/lead-predictions/industry/:industryId/stats', requireAuth, async (req, res) => {
  try {
    const { industryId } = req.params;
    const { days = 30 } = req.query;
    
    // Check permissions
    const isAdmin = req.user.user_metadata?.role === 'admin';
    if (!isAdmin) {
      // Check if user has access to this industry
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('lead_industries, is_admin')
        .eq('id', req.user.id)
        .single();

      if (!profile || (!profile.is_admin && !profile.lead_industries?.includes(parseInt(industryId)))) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized'
        });
      }
    }

    const leadValuePredictionService = require('../services/leadValuePredictionService');
    const stats = await leadValuePredictionService.getIndustryStats(parseInt(industryId), parseInt(days));

    res.json({
      success: true,
      data: stats,
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching industry prediction stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stats'
    });
  }
});

// POST /api/lead-predictions/:leadId/update-outcome
// Manually update prediction outcome (admin only, or for testing)
router.post('/lead-predictions/:leadId/update-outcome', requireAuth, isAdmin, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { actual_deal_value, actual_win, actual_response_time_hours } = req.body;

    const leadValuePredictionService = require('../services/leadValuePredictionService');
    
    await leadValuePredictionService.updateActualOutcome(
      leadId,
      actual_deal_value ? parseFloat(actual_deal_value) : null,
      actual_win !== undefined ? Boolean(actual_win) : null,
      actual_response_time_hours ? parseFloat(actual_response_time_hours) : null
    );

    res.json({
      success: true,
      message: 'Prediction outcome updated successfully'
    });
  } catch (error) {
    console.error('Error updating prediction outcome:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update outcome'
    });
  }
});

// =====================================================
// FORM OPTIMIZATION ENDPOINTS
// =====================================================

// POST /api/form-optimization/generate-suggestions
// Generate optimization suggestions for a form template
router.post('/form-optimization/generate-suggestions', requireAuth, isAdmin, async (req, res) => {
  try {
    const { industry_id, form_template_id, days = 30 } = req.body;

    if (!industry_id || !form_template_id) {
      return res.status(400).json({
        success: false,
        error: 'industry_id and form_template_id are required'
      });
    }

    const formOptimizationService = require('../services/formOptimizationService');
    
    const suggestions = await formOptimizationService.generateOptimizationSuggestions(
      parseInt(industry_id),
      form_template_id,
      parseInt(days)
    );

    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length
    });
  } catch (error) {
    console.error('Error generating optimization suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate suggestions'
    });
  }
});

// GET /api/form-optimization/suggestions/:industryId
// Get optimization suggestions for an industry
router.get('/form-optimization/suggestions/:industryId', requireAuth, async (req, res) => {
  try {
    const { industryId } = req.params;
    const { form_template_id, status = 'pending' } = req.query;

    // Check permissions
    const isAdmin = req.user.user_metadata?.role === 'admin';
    if (!isAdmin) {
      // Check if user has access to this industry
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('lead_industries, is_admin')
        .eq('id', req.user.id)
        .single();

      if (!profile || (!profile.is_admin && !profile.lead_industries?.includes(parseInt(industryId)))) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized'
        });
      }
    }

    const formOptimizationService = require('../services/formOptimizationService');
    const suggestions = await formOptimizationService.getSuggestions(
      parseInt(industryId),
      form_template_id || null,
      status
    );

    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length
    });
  } catch (error) {
    console.error('Error fetching optimization suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch suggestions'
    });
  }
});

// POST /api/form-optimization/suggestions/:suggestionId/approve
// Approve an optimization suggestion
router.post('/form-optimization/suggestions/:suggestionId/approve', requireAuth, isAdmin, async (req, res) => {
  try {
    const { suggestionId } = req.params;

    const formOptimizationService = require('../services/formOptimizationService');
    await formOptimizationService.updateSuggestionStatus(
      suggestionId,
      'approved',
      req.user.id
    );

    res.json({
      success: true,
      message: 'Suggestion approved'
    });
  } catch (error) {
    console.error('Error approving suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve suggestion'
    });
  }
});

// POST /api/form-optimization/suggestions/:suggestionId/reject
// Reject an optimization suggestion
router.post('/form-optimization/suggestions/:suggestionId/reject', requireAuth, isAdmin, async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { reason } = req.body;

    const formOptimizationService = require('../services/formOptimizationService');
    await formOptimizationService.updateSuggestionStatus(
      suggestionId,
      'rejected',
      req.user.id,
      reason || null
    );

    res.json({
      success: true,
      message: 'Suggestion rejected'
    });
  } catch (error) {
    console.error('Error rejecting suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject suggestion'
    });
  }
});

// POST /api/form-optimization/suggestions/:suggestionId/implement
// Mark suggestion as implemented
router.post('/form-optimization/suggestions/:suggestionId/implement', requireAuth, isAdmin, async (req, res) => {
  try {
    const { suggestionId } = req.params;

    const formOptimizationService = require('../services/formOptimizationService');
    await formOptimizationService.updateSuggestionStatus(
      suggestionId,
      'implemented',
      req.user.id
    );

    res.json({
      success: true,
      message: 'Suggestion marked as implemented'
    });
  } catch (error) {
    console.error('Error marking suggestion as implemented:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark as implemented'
    });
  }
});

// =====================================================
// PARTNER FORM CUSTOMIZATION ENDPOINTS
// =====================================================

// POST /api/partner-customizations/generate
// Generate partner-specific customization
router.post('/partner-customizations/generate', requireAuth, async (req, res) => {
  try {
    const { industry_id, form_template_id } = req.body;
    const partnerId = req.user.id;

    if (!industry_id || !form_template_id) {
      return res.status(400).json({
        success: false,
        error: 'industry_id and form_template_id are required'
      });
    }

    const partnerFormCustomizationService = require('../services/partnerFormCustomizationService');
    
    const customization = await partnerFormCustomizationService.generateCustomization(
      partnerId,
      parseInt(industry_id),
      form_template_id
    );

    if (!customization) {
      return res.json({
        success: true,
        message: 'No customization needed at this time',
        data: null
      });
    }

    res.json({
      success: true,
      data: customization
    });
  } catch (error) {
    console.error('Error generating partner customization:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate customization'
    });
  }
});

// GET /api/partner-customizations/:industryId
// Get customization for partner
router.get('/partner-customizations/:industryId', requireAuth, async (req, res) => {
  try {
    const { industryId } = req.params;
    const { form_template_id } = req.query;
    const partnerId = req.user.id;

    const partnerFormCustomizationService = require('../services/partnerFormCustomizationService');
    const customization = await partnerFormCustomizationService.getCustomization(
      partnerId,
      parseInt(industryId),
      form_template_id || null
    );

    res.json({
      success: true,
      data: customization
    });
  } catch (error) {
    console.error('Error fetching partner customization:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customization'
    });
  }
});

// =====================================================
// AI SALES ASSIST ENDPOINTS
// =====================================================

// GET /api/sales-assist/:leadId
// Get AI-generated sales summary and scripts
router.get('/sales-assist/:leadId', requireAuth, async (req, res) => {
  try {
    const { leadId } = req.params;
    
    // Check if user has access to this lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('user_id')
      .eq('id', leadId)
      .single();

    if (leadError) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Check permissions
    const isAdmin = req.user.user_metadata?.role === 'admin';
    if (!isAdmin && lead.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const aiSalesAssistService = require('../services/aiSalesAssistService');
    const summary = await aiSalesAssistService.generateLeadSummary(leadId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error generating sales assist:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate sales assist'
    });
  }
});

// GET /api/sales-assist/:leadId/quick
// Get quick summary (lighter, faster)
router.get('/sales-assist/:leadId/quick', requireAuth, async (req, res) => {
  try {
    const { leadId } = req.params;
    
    // Check permissions
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('user_id')
      .eq('id', leadId)
      .single();

    const isAdmin = req.user.user_metadata?.role === 'admin';
    if (!isAdmin && lead?.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const aiSalesAssistService = require('../services/aiSalesAssistService');
    const summary = await aiSalesAssistService.generateQuickSummary(leadId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error generating quick summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate quick summary'
    });
  }
});

// =====================================================
// QUESTION ENGINE ENDPOINTS (Multi-channel)
// =====================================================

// GET /api/question-engine/:channel/:industryId
// Get questions formatted for specific channel
router.get('/question-engine/:channel/:industryId', async (req, res) => {
  try {
    const { channel, industryId } = req.params;
    const { form_template_id, keywords, landing_page } = req.query;

    if (!['website', 'whatsapp', 'phone'].includes(channel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channel. Must be: website, whatsapp, or phone'
      });
    }

    const questionEngineService = require('../services/questionEngineService');
    
    const questions = await questionEngineService.getQuestionsForChannel(
      channel,
      parseInt(industryId),
      form_template_id || null,
      {
        keywords: keywords ? keywords.split(',') : [],
        landingPage: landing_page || null
      }
    );

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Error getting questions for channel:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get questions'
    });
  }
});

// POST /api/question-engine/:channel/process-answer
// Process answer and get next question
router.post('/question-engine/:channel/process-answer', async (req, res) => {
  try {
    const { channel } = req.params;
    const { question_id, answer, session_data } = req.body;

    if (!question_id || answer === undefined) {
      return res.status(400).json({
        success: false,
        error: 'question_id and answer are required'
      });
    }

    const questionEngineService = require('../services/questionEngineService');
    const result = await questionEngineService.processAnswer(
      channel,
      question_id,
      answer,
      session_data || {}
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error processing answer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process answer'
    });
  }
});

// GET /api/question-engine/dynamic-starter/:industryId
// Get dynamic form starter based on context
router.get('/question-engine/dynamic-starter/:industryId', async (req, res) => {
  try {
    const { industryId } = req.params;
    const { keywords, landing_page } = req.query;

    const questionEngineService = require('../services/questionEngineService');
    const starter = await questionEngineService.getDynamicStarter(
      parseInt(industryId),
      {
        keywords: keywords ? keywords.split(',') : [],
        landingPage: landing_page || null
      }
    );

    res.json({
      success: true,
      data: starter
    });
  } catch (error) {
    console.error('Error getting dynamic starter:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get dynamic starter'
    });
  }
});

// =====================================================
// BENCHMARK & INSIGHTS ENDPOINTS
// =====================================================

// GET /api/form-benchmarks/:industryId
// Get benchmark data for an industry
router.get('/form-benchmarks/:industryId', requireAuth, async (req, res) => {
  try {
    const { industryId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('form_benchmarks')
      .select('*')
      .eq('industry_id', parseInt(industryId))
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.json({
          success: true,
          data: null,
          message: 'No benchmark data available yet'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch benchmarks'
    });
  }
});

// GET /api/form-benchmarks
// Get all benchmarks (admin only)
router.get('/form-benchmarks', requireAuth, isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('form_benchmarks')
      .select('*')
      .order('industry_name');

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Error fetching all benchmarks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch benchmarks'
    });
  }
});

// POST /api/form-benchmarks/refresh
// Refresh benchmark materialized view (admin only)
router.post('/form-benchmarks/refresh', requireAuth, isAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.rpc('refresh_form_benchmarks');

    if (error) throw error;

    res.json({
      success: true,
      message: 'Benchmarks refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing benchmarks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to refresh benchmarks'
    });
  }
});

// =====================================================
// EMPLOYEE MANAGEMENT API ENDPOINTS
// =====================================================

const EmployeeService = require('../services/employeeService')
const TaskService = require('../services/taskService')
const TimeEntryService = require('../services/timeEntryService')
const PayoutService = require('../services/payoutService')

// GET /api/employees/:id/summary
// Get employee summary with role-based KPIs
router.get('/employees/:id/summary', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const summary = await EmployeeService.getEmployeeSummary(id)
    res.json({ ok: true, data: summary })
  } catch (error) {
    console.error('Error fetching employee summary:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// PUT /api/employees/:id/status
// Update employee status
router.put('/employees/:id/status', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    if (!['active', 'paused', 'inactive'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid status' })
    }
    const updated = await EmployeeService.updateEmployeeStatus(id, status, req.user.id)
    res.json({ ok: true, data: updated })
  } catch (error) {
    console.error('Error updating employee status:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// GET /api/employees/:id/tasks
// Get tasks for employee
router.get('/employees/:id/tasks', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { status, priority, limit, offset } = req.query
    
    // Check permissions: employee can only see own tasks
    if (req.user.id !== id && !req.user.user_metadata?.is_admin) {
      // Check if user is manager
      const { data: employee } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', id)
        .single()
      
      if (employee?.manager_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Forbidden' })
      }
    }

    // Parse status: can be comma-separated string like "open,in_progress"
    let statusArray = undefined;
    if (status) {
      if (Array.isArray(status)) {
        statusArray = status;
      } else if (typeof status === 'string' && status.includes(',')) {
        statusArray = status.split(',').map(s => s.trim());
      } else {
        statusArray = [status];
      }
    }

    const result = await TaskService.getTasks(id, {
      status: statusArray,
      priority,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    })
    
    res.json({ ok: true, data: result })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/tasks/ai-suggest-assignment
// Get AI suggestion for task assignment based on task details and employee skills
router.post('/tasks/ai-suggest-assignment', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.user_metadata?.is_admin || false;
    const currentUserId = req.user?.id;
    
    // Determine if user is a manager
    let isManager = false;
    if (req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isManager = true;
      }
    }

    const canViewAll = isAdmin || isManager;
    
    if (!canViewAll) {
      return res.status(403).json({
        ok: false,
        error: 'Alleen managers en admins kunnen AI suggesties bekijken'
      });
    }

    const { title, description, customer_id, priority } = req.body;

    if (!title) {
      return res.status(400).json({
        ok: false,
        error: 'Titel is verplicht voor AI suggestie'
      });
    }

    // Get all employees (filtered, same logic as tasks page)
    const { data: allProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, role_id, employee_status, is_admin, skills')
      .order('first_name');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }
    
    // Get roles to identify employee roles vs customer roles
    const { data: allRoles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('id, name');
    
    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }
    
    // Create role map
    const roleMap = {};
    if (allRoles) {
      allRoles.forEach(role => {
        roleMap[String(role.id)] = role.name?.toLowerCase() || '';
      });
    }
    
    // Filter to only employees (same logic as tasks page)
    const customerRoleId = '873fe734-197d-41a0-828b-31ced55e6695';
    const consumerRoleId = '58e20673-a6c1-4f48-9633-2462f4a124db';
    
    const employees = (allProfiles || []).filter(profile => {
      // FIRST: Check if this is a customer/consumer role - EXCLUDE immediately
      if (profile.role_id) {
        const roleIdStr = String(profile.role_id);
        const roleName = roleMap[roleIdStr] || '';
        
        if (roleIdStr === customerRoleId || roleIdStr === consumerRoleId) {
          return false;
        }
        
        if (roleName) {
          const lowerRoleName = roleName.toLowerCase();
          if (lowerRoleName === 'customer' || lowerRoleName === 'consumer' || lowerRoleName === 'klant') {
            return false;
          }
        }
      }
      
      // SECOND: If not a customer/consumer, check if it's an employee
      if (profile.is_admin === true) {
        return true;
      }
      
      if (profile.employee_status === 'active' || profile.employee_status === 'paused') {
        return true;
      }
      
      if (profile.role_id) {
        const roleIdStr = String(profile.role_id);
        const roleName = roleMap[roleIdStr] || '';
        if (roleName) {
          return true;
        }
      }
      
      return false;
    }).map(emp => ({
      id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      skills: emp.skills || []
    }));

    if (employees.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Geen werknemers gevonden'
      });
    }

    // Get task statistics for each employee
    const { data: allTasks } = await supabaseAdmin
      .from('employee_tasks')
      .select('employee_id, status, priority');

    // Calculate employee stats
    const employeeStats = {};
    employees.forEach(emp => {
      const empTasks = (allTasks || []).filter(t => t.employee_id === emp.id);
      const inProgress = empTasks.filter(t => t.status === 'in_progress').length;
      const completed = empTasks.filter(t => t.status === 'done').length;
      const total = empTasks.length;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      const currentLoad = inProgress;

      employeeStats[emp.id] = {
        totalTasks: total,
        completedTasks: completed,
        inProgressTasks: inProgress,
        completionRate,
        currentLoad
      };
    });

    // Score each employee based on:
    // 1. Skills match (0-50 points)
    // 2. Current workload (0-30 points) - less is better
    // 3. Completion rate (0-20 points)
    
    const taskText = `${title} ${description || ''}`.toLowerCase();
    const taskKeywords = taskText.split(/\s+/).filter(w => w.length > 3);
    
    const scores = employees.map(emp => {
      const stats = employeeStats[emp.id] || { completionRate: 0, currentLoad: 0 };
      let score = 0;
      
      // Factor 1: Skills match (0-50 points)
      const empSkills = (emp.skills || []).map(s => s.toLowerCase());
      let skillsMatch = 0;
      if (empSkills.length > 0) {
        // Check for keyword matches in skills
        const matchedKeywords = taskKeywords.filter(kw => 
          empSkills.some(skill => skill.includes(kw) || kw.includes(skill))
        );
        skillsMatch = (matchedKeywords.length / Math.max(taskKeywords.length, 1)) * 50;
      } else {
        // If no skills, give baseline score
        skillsMatch = 25;
      }
      score += skillsMatch;
      
      // Factor 2: Current workload (0-30 points) - inverse, less is better
      const loadScore = Math.max(0, 30 - (stats.currentLoad * 5));
      score += loadScore;
      
      // Factor 3: Completion rate (0-20 points)
      const completionScore = (stats.completionRate / 100) * 20;
      score += completionScore;
      
      return {
        employee_id: emp.id,
        employee_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email,
        employee_email: emp.email,
        score: Math.round(score),
        skills: emp.skills || [],
        stats: {
          totalTasks: stats.totalTasks,
          completionRate: Math.round(stats.completionRate),
          currentLoad: stats.currentLoad
        },
        reason: empSkills.length > 0 
          ? `Heeft relevante vaardigheden: ${empSkills.slice(0, 3).join(', ')}`
          : 'Geschikt op basis van beschikbaarheid en prestaties'
      };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    const topMatch = scores[0];
    const alternatives = scores.slice(1, 4); // Top 3 alternatives

    res.json({
      ok: true,
      data: {
        suggestion: {
          employee_id: topMatch.employee_id,
          employee_name: topMatch.employee_name,
          employee_email: topMatch.employee_email,
          match_percentage: topMatch.score,
          reason: topMatch.reason,
          score: topMatch.score
        },
        alternatives: alternatives.map(alt => ({
          employee_id: alt.employee_id,
          employee_name: alt.employee_name,
          employee_email: alt.employee_email,
          match_percentage: alt.score,
          reason: alt.reason,
          score: alt.score
        }))
      }
    });
  } catch (error) {
    console.error('Error generating AI task assignment suggestion:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Fout bij genereren AI suggestie'
    });
  }
});

// GET /api/tasks
// Get all tasks with filters (for AJAX filtering)
router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.user_metadata?.is_admin || false;
    const currentUserId = req.user?.id;
    
    // Determine if user is a manager
    let isManager = false;
    if (req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      if (role?.name?.toLowerCase().includes('manager')) {
        isManager = true;
      }
    }

    const canViewAll = isAdmin || isManager;
    const { status, employee_id, priority } = req.query;
    
    // Build query based on permissions
    let query = supabaseAdmin
      .from('employee_tasks')
      .select('*, employee:profiles!employee_tasks_employee_id_fkey(id, first_name, last_name, email, manager_id), customer:profiles!employee_tasks_customer_id_fkey(id, first_name, last_name, company_name)')
      .order('created_at', { ascending: false });

    // Employees can only see: own tasks, team tasks (where they are manager), and project tasks
    if (!canViewAll) {
      // Get employees that report to this user (if they are a manager)
      const { data: teamMembers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('manager_id', currentUserId);
      
      const teamMemberIds = teamMembers?.map(m => m.id) || [];
      
      // Filter: own tasks OR team member tasks OR tasks assigned to projects they're on
      if (teamMemberIds.length > 0) {
        query = query.or(`employee_id.eq.${currentUserId},employee_id.in.(${teamMemberIds.join(',')})`);
      } else {
        query = query.eq('employee_id', currentUserId);
      }
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (employee_id && canViewAll) {
      query = query.eq('employee_id', employee_id);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: tasks, error } = await query;

    if (error) throw error;

    res.json({ ok: true, data: { tasks: tasks || [] } });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/tasks
// Create task (for managers+ or employees creating their own tasks)
router.post('/tasks', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.user_metadata?.is_admin || false;
    const { 
      employee_id, 
      customer_id, 
      contact_id,
      title, 
      description, 
      priority, 
      due_at,
      is_recurring,
      recurrence_frequency,
      recurrence_interval,
      recurrence_end_date,
      recurrence_count,
      recurrence_days_of_week
    } = req.body;

    if (!employee_id || !title) {
      return res.status(400).json({ ok: false, error: 'Werknemer en titel zijn verplicht' });
    }
    
    // Validate: task must have customer_id OR contact_id
    if (!customer_id && !contact_id) {
      return res.status(400).json({ ok: false, error: 'Bij een taak moet je een bedrijf of contactpersoon selecteren' });
    }

    // Check permissions: employees can only create tasks for themselves, managers+ can create for anyone
    if (!isAdmin) {
      // Check if user is manager
      let isManager = false;
      if (req.user?.role_id) {
        const { data: role } = await supabaseAdmin
          .from('roles')
          .select('name')
          .eq('id', req.user.role_id)
          .maybeSingle();
        if (role?.name?.toLowerCase().includes('manager')) {
          isManager = true;
        }
      }

      // Check if user is manager of the employee
      if (!isManager) {
        const { data: employee } = await supabaseAdmin
          .from('profiles')
          .select('manager_id')
          .eq('id', employee_id)
          .single();
        
        if (employee?.manager_id !== req.user.id && employee_id !== req.user.id) {
          return res.status(403).json({ ok: false, error: 'Geen toestemming om taken aan te maken voor deze werknemer' });
        }
      }
    }

    // Convert customer_id from customers table to profiles.id if needed
    let profileCustomerId = null;
    if (customer_id) {
      try {
        // First, try to find if customer_id is already a profiles.id
        const { data: profileCheck, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', customer_id)
          .maybeSingle();
        
        if (profileError) {
          console.error('Error checking profile:', profileError);
        }
        
        if (profileCheck && profileCheck.id) {
          // customer_id is already a profiles.id
          profileCustomerId = customer_id;
          console.log(`Customer ID ${customer_id} is already a profiles.id`);
        } else {
          // customer_id is from customers table, find corresponding profiles.id
          const { data: customer, error: customerError } = await supabaseAdmin
            .from('customers')
            .select('email, name, company_name')
            .eq('id', customer_id)
            .maybeSingle();
          
          if (customerError) {
            console.error('Error fetching customer:', customerError);
          }
          
          if (customer && customer.email) {
            // Try to find profile by email
            const { data: profile, error: profileLookupError } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('email', customer.email)
              .maybeSingle();
            
            if (profileLookupError) {
              console.error('Error looking up profile by email:', profileLookupError);
            }
            
            if (profile && profile.id) {
              profileCustomerId = profile.id;
              console.log(`Found profile ${profile.id} for customer ${customer_id} (email: ${customer.email})`);
            } else {
              console.warn(`No profile found for customer ${customer_id} (email: ${customer.email}), setting customer_id to null`);
              profileCustomerId = null; // Explicitly set to null
            }
          } else {
            console.warn(`Customer ${customer_id} not found or has no email, setting customer_id to null`);
            profileCustomerId = null; // Explicitly set to null
          }
        }
      } catch (error) {
        console.error('Error converting customer_id:', error);
        profileCustomerId = null; // Explicitly set to null on error
      }
    }

    // Final safety check: ensure customer_id is either null or a valid profiles.id
    if (profileCustomerId) {
      const { data: finalCheck } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', profileCustomerId)
        .maybeSingle();
      
      if (!finalCheck || !finalCheck.id) {
        console.warn(`Final check failed: customer_id ${profileCustomerId} is not a valid profiles.id, setting to null`);
        profileCustomerId = null;
      }
    }

    const task = await TaskService.createTask({
      employee_id,
      customer_id: profileCustomerId,
      contact_id: contact_id || null,
      title,
      description: description || null,
      priority: priority || 'medium',
      value_cents: 0, // Always 0, value field removed
      due_at: due_at || null,
      is_recurring: is_recurring || false,
      recurrence_frequency: recurrence_frequency || null,
      recurrence_interval: recurrence_interval || null,
      recurrence_end_date: recurrence_end_date || null,
      recurrence_count: recurrence_count || null,
      recurrence_days_of_week: recurrence_days_of_week || null
    }, req.user.id);

    res.json({ ok: true, data: task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
})

// POST /api/employees/:id/tasks
// Create task (legacy endpoint, kept for backward compatibility)
router.post('/employees/:id/tasks', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const task = await TaskService.createTask({
      employee_id: id,
      ...req.body
    }, req.user.id)
    res.json({ ok: true, data: task })
  } catch (error) {
    console.error('Error creating task:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// PATCH /api/tasks/:taskId/status
// Update task status
router.patch('/tasks/:taskId/status', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params
    const { status } = req.body
    
    // Get task to check permissions
    const { data: task } = await supabaseAdmin
      .from('employee_tasks')
      .select('employee_id')
      .eq('id', taskId)
      .single()
    
    if (!task) {
      return res.status(404).json({ ok: false, error: 'Task not found' })
    }

    // Check permissions - allow employee, manager, or admin
    const isAdmin = req.user.user_metadata?.is_admin || false;
    const isEmployee = task.employee_id === req.user.id;
    
    // Check if user is manager of the employee
    let isManager = false;
    if (!isAdmin && !isEmployee) {
      const { data: employee } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', task.employee_id)
        .single();
      
      if (employee?.manager_id === req.user.id) {
        isManager = true;
      }
    }
    
    if (!isEmployee && !isAdmin && !isManager) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }

    const updated = await TaskService.updateTaskStatus(taskId, status, req.user.id)
    res.json({ ok: true, data: updated })
  } catch (error) {
    console.error('Error updating task status:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/tasks/:taskId/approve
// Approve task (inline)
router.post('/tasks/:taskId/approve', requireAuth, isAdmin, async (req, res) => {
  try {
    const { taskId } = req.params
    const task = await TaskService.approveTask(taskId, req.user.id)
    res.json({ ok: true, data: task })
  } catch (error) {
    console.error('Error approving task:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/tasks/:taskId/reject
// Reject task (inline)
router.post('/tasks/:taskId/reject', requireAuth, isAdmin, async (req, res) => {
  try {
    const { taskId } = req.params
    const { reason } = req.body
    const task = await TaskService.rejectTask(taskId, reason, req.user.id)
    res.json({ ok: true, data: task })
  } catch (error) {
    console.error('Error rejecting task:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// GET /api/employees/:id/time-entries
// Get time entries for employee
router.get('/employees/:id/time-entries', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { status, start_date, end_date, limit, offset } = req.query
    
    // Check permissions
    if (req.user.id !== id && !req.user.user_metadata?.is_admin) {
      const { data: employee } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', id)
        .single()
      
      if (employee?.manager_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Forbidden' })
      }
    }

    const result = await TimeEntryService.getTimeEntries(id, {
      status: status ? (Array.isArray(status) ? status : [status]) : undefined,
      start_date,
      end_date,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    })
    
    res.json({ ok: true, data: result })
  } catch (error) {
    console.error('Error fetching time entries:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// GET /api/time-entries/all
// Get all time entries (for managers/admins)
router.get('/time-entries/all', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.user_metadata?.is_admin || false;
    
    // Check if user is manager or admin
    let isManager = false;
    if (!isAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle();
      
      if (role?.name) {
        const roleName = role.name.toLowerCase();
        isManager = roleName.includes('manager');
      }
    }
    
    if (!isAdmin && !isManager) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const { status, start_date, end_date, employee_id, limit, offset } = req.query;
    
    // Build query
    let query = supabaseAdmin
      .from('time_entries')
      .select(`
        *,
        employee:profiles!time_entries_employee_id_fkey(id, first_name, last_name, email),
        customer:profiles!time_entries_customer_id_fkey(id, company_name, first_name, last_name, email),
        task:employee_tasks(id, title)
      `)
      .order('start_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (start_date) {
      query = query.gte('start_at', start_date);
    }
    if (end_date) {
      query = query.lte('start_at', end_date);
    }
    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    if (offset) {
      query = query.range(parseInt(offset), parseInt(offset) + (parseInt(limit) || 100) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ ok: true, data: { time_entries: data || [] } });
  } catch (error) {
    console.error('Error fetching all time entries:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/employees/:id/time-entries/week
// Get week overview
router.get('/employees/:id/time-entries/week', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { week_start } = req.query
    
    // Check permissions
    if (req.user.id !== id && !req.user.user_metadata?.is_admin) {
      const { data: employee } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', id)
        .single()
      
      if (employee?.manager_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Forbidden' })
      }
    }

    const weekStart = week_start ? new Date(week_start) : null
    const overview = await TimeEntryService.getWeekOverview(id, weekStart)
    
    res.json({ ok: true, data: overview })
  } catch (error) {
    console.error('Error fetching week overview:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/employees/:id/time-entries
// Create time entry (draft only for employees)
router.post('/employees/:id/time-entries', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    
    // Employees can only create their own entries
    if (req.user.id !== id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }

    const entry = await TimeEntryService.createTimeEntry({
      employee_id: id,
      ...req.body
    }, req.user.id)
    
    res.json({ ok: true, data: entry })
  } catch (error) {
    console.error('Error creating time entry:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// PUT /api/time-entries/:entryId
// Update time entry
router.put('/time-entries/:entryId', requireAuth, async (req, res) => {
  try {
    const { entryId } = req.params
    
    // Get entry to check permissions
    const { data: entry } = await supabaseAdmin
      .from('time_entries')
      .select('employee_id, status')
      .eq('id', entryId)
      .single()
    
    if (!entry) {
      return res.status(404).json({ ok: false, error: 'Time entry not found' })
    }

    // Employees can only update their own draft entries
    if (entry.employee_id === req.user.id && entry.status === 'draft') {
      const updated = await TimeEntryService.updateTimeEntry(entryId, req.body, req.user.id)
      return res.json({ ok: true, data: updated })
    }

    // Managers/admins can update submitted entries
    const { data: employee } = await supabaseAdmin
      .from('profiles')
      .select('manager_id')
      .eq('id', entry.employee_id)
      .single()

    if (req.user.user_metadata?.is_admin || employee?.manager_id === req.user.id) {
      const updated = await TimeEntryService.updateTimeEntry(entryId, req.body, req.user.id)
      return res.json({ ok: true, data: updated })
    }

    return res.status(403).json({ ok: false, error: 'Forbidden' })
  } catch (error) {
    console.error('Error updating time entry:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/employees/:id/time-entries/submit-week
// Submit week (change drafts to submitted)
router.post('/employees/:id/time-entries/submit-week', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { week_start } = req.body
    
    // Employees can only submit their own weeks
    if (req.user.id !== id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }

    const weekStart = week_start ? new Date(week_start) : null
    const result = await TimeEntryService.submitWeek(id, weekStart, req.user.id)
    
    res.json({ ok: true, data: result })
  } catch (error) {
    console.error('Error submitting week:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// GET /api/employees/:id/time-entries/active-timer
// Get active timer for employee
router.get('/employees/:id/time-entries/active-timer', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    
    // Employees can only view their own active timer
    if (req.user.id !== id && !req.user.user_metadata?.is_admin) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }

    // Prevent caching - this data changes frequently
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })

    const activeTimer = await TimeEntryService.getActiveTimer(id)
    // Return null if no active timer, not undefined
    res.json({ ok: true, data: activeTimer || null })
  } catch (error) {
    console.error('Error getting active timer:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/employees/:id/time-entries/clock-in
// Clock in - start active timer
router.post('/employees/:id/time-entries/clock-in', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    
    // Employees can only clock in for themselves
    if (req.user.id !== id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }

    const entry = await TimeEntryService.clockIn(id, req.body)
    res.json({ ok: true, data: entry })
  } catch (error) {
    console.error('Error clocking in:', error)
    // Return 400 for business logic errors (like already has active timer)
    // Return 500 for server errors
    const statusCode = error.message.includes('already has an active timer') ? 400 : 500
    res.status(statusCode).json({ ok: false, error: error.message })
  }
})

// POST /api/employees/:id/time-entries/clock-out
// Clock out - stop active timer
router.post('/employees/:id/time-entries/clock-out', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    
    // Employees can only clock out for themselves
    if (req.user.id !== id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }

    const entry = await TimeEntryService.clockOut(id, req.body)
    res.json({ ok: true, data: entry })
  } catch (error) {
    console.error('Error clocking out:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/employees/:id/time-entries/switch-task
// Switch task - close current active timer and start new one immediately
router.post('/employees/:id/time-entries/switch-task', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    
    // Employees can only switch their own tasks
    if (req.user.id !== id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }

    const newEntry = await TimeEntryService.switchTask(id, req.body)
    res.json({ ok: true, data: newEntry })
  } catch (error) {
    console.error('Error switching task:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// PUT /api/employees/:id/time-entries/active-timer
// Update active timer (change project, customer, task, note)
router.put('/employees/:id/time-entries/active-timer', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    
    // Employees can only update their own active timer
    if (req.user.id !== id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }

    const entry = await TimeEntryService.updateActiveTimer(id, req.body)
    res.json({ ok: true, data: entry })
  } catch (error) {
    console.error('Error updating active timer:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/time-entries/:entryId/approve
// Approve time entry (inline)
router.post('/time-entries/:entryId/approve', requireAuth, isAdmin, async (req, res) => {
  try {
    const { entryId } = req.params
    const entry = await TimeEntryService.approveTimeEntry(entryId, req.user.id)
    res.json({ ok: true, data: entry })
  } catch (error) {
    console.error('Error approving time entry:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/time-entries/:entryId/reject
// Reject time entry (inline)
router.post('/time-entries/:entryId/reject', requireAuth, isAdmin, async (req, res) => {
  try {
    const { entryId } = req.params
    const { reason } = req.body
    const entry = await TimeEntryService.rejectTimeEntry(entryId, reason, req.user.id)
    res.json({ ok: true, data: entry })
  } catch (error) {
    console.error('Error rejecting time entry:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// GET /api/employees/:id/payouts
// Get payouts for employee
router.get('/employees/:id/payouts', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { limit, offset } = req.query
    const result = await PayoutService.getPayouts(id, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    })
    res.json({ ok: true, data: result })
  } catch (error) {
    console.error('Error fetching payouts:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/employees/:id/payouts/calculate
// Calculate earnings for period
router.post('/employees/:id/payouts/calculate', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { period_start, period_end } = req.body
    
    if (!period_start || !period_end) {
      return res.status(400).json({ ok: false, error: 'period_start and period_end required' })
    }

    const earnings = await PayoutService.calculateEarnings(
      id,
      new Date(period_start),
      new Date(period_end)
    )
    
    res.json({ ok: true, data: earnings })
  } catch (error) {
    console.error('Error calculating earnings:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/employees/:id/payouts
// Create payout
router.post('/employees/:id/payouts', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const payout = await PayoutService.createPayout({
      employee_id: id,
      ...req.body
    }, req.user.id)
    res.json({ ok: true, data: payout })
  } catch (error) {
    console.error('Error creating payout:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/payouts/:batchId/approve
// Approve payout batch
router.post('/payouts/:batchId/approve', requireAuth, isAdmin, async (req, res) => {
  try {
    const { batchId } = req.params
    const batch = await PayoutService.approvePayout(batchId, req.user.id)
    res.json({ ok: true, data: batch })
  } catch (error) {
    console.error('Error approving payout:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/payouts/:batchId/paid
// Mark payout as paid
router.post('/payouts/:batchId/paid', requireAuth, isAdmin, async (req, res) => {
  try {
    const { batchId } = req.params
    const batch = await PayoutService.markPayoutPaid(batchId, req.user.id)
    res.json({ ok: true, data: batch })
  } catch (error) {
    console.error('Error marking payout as paid:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// GET /api/employees/:id/notes
// Get last 3 notes (or all if ?all=true)
router.get('/employees/:id/notes', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { all } = req.query
    
    // Check permissions: only manager/admin can view notes
    if (!req.user.user_metadata?.is_admin) {
      const { data: employee } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', id)
        .single()
      
      if (employee?.manager_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Forbidden' })
      }
    }

    let query = supabaseAdmin
      .from('employee_notes')
      .select('*, created_by_profile:profiles!employee_notes_created_by_fkey(id, first_name, last_name, email)')
      .eq('employee_id', id)
      .order('created_at', { ascending: false })

    if (all !== 'true') {
      query = query.limit(3)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ ok: true, data: data || [] })
  } catch (error) {
    console.error('Error fetching notes:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// POST /api/employees/:id/notes
// Create note (manager/admin only)
router.post('/employees/:id/notes', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { note } = req.body
    
    if (!note || !note.trim()) {
      return res.status(400).json({ ok: false, error: 'Note is required' })
    }

    // Check permissions
    if (!req.user.user_metadata?.is_admin) {
      const { data: employee } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', id)
        .single()
      
      if (employee?.manager_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Forbidden' })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('employee_notes')
      .insert({
        employee_id: id,
        created_by: req.user.id,
        note: note.trim()
      })
      .select('*, created_by_profile:profiles!employee_notes_created_by_fkey(id, first_name, last_name, email)')
      .single()

    if (error) throw error

    res.json({ ok: true, data })
  } catch (error) {
    console.error('Error creating note:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// PUT /api/employees/:id/salary
// Update employee salary (manager/admin only)
router.put('/employees/:id/salary', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { hourly_rate_cents, payroll_scale_id } = req.body
    
    // Check if user is manager or admin
    let isUserAdmin = req.user?.user_metadata?.is_admin === true
    let isUserManager = false
    
    if (!isUserAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle()
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true
      }
    }
    
    if (!isUserAdmin && !isUserManager) {
      return res.status(403).json({ ok: false, error: 'Alleen managers en admins kunnen salaris aanpassen' })
    }
    
    const updateData = {}
    
    // If scale_id is provided, use that and fetch the rate from the scale
    if (payroll_scale_id) {
      const { data: scale, error: scaleError } = await supabaseAdmin
        .from('payroll_scales')
        .select('id, name, hourly_rate_cents')
        .eq('id', payroll_scale_id)
        .eq('is_active', true)
        .maybeSingle()
      
      if (scaleError) throw scaleError
      if (!scale) {
        return res.status(400).json({ ok: false, error: 'Schaal niet gevonden' })
      }
      
      updateData.payroll_scale_id = payroll_scale_id
      updateData.hourly_rate_cents = scale.hourly_rate_cents
    } else if (hourly_rate_cents !== undefined && hourly_rate_cents !== null) {
      // Custom rate provided
      const rateCents = parseInt(hourly_rate_cents)
      if (isNaN(rateCents) || rateCents < 0) {
        return res.status(400).json({ ok: false, error: 'Ongeldig uurtarief' })
      }
      
      updateData.hourly_rate_cents = rateCents
      updateData.payroll_scale_id = null // Clear scale when using custom rate
    } else {
      return res.status(400).json({ ok: false, error: 'Geef een schaal of uurtarief op' })
    }
    
    // Update employee salary
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', id)
    
    if (updateError) throw updateError
    
    // Fetch updated employee with scale info
    const { data: updatedProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select(`
        hourly_rate_cents,
        payroll_scale_id,
        payroll_scale:payroll_scales(id, name, hourly_rate_cents)
      `)
      .eq('id', id)
      .maybeSingle()
    
    if (fetchError) throw fetchError
    
    res.json({ 
      ok: true, 
      hourly_rate_cents: updatedProfile.hourly_rate_cents,
      payroll_scale_id: updatedProfile.payroll_scale_id,
      payroll_scale: updatedProfile.payroll_scale,
      message: 'Salaris succesvol bijgewerkt' 
    })
  } catch (error) {
    console.error('Error updating salary:', error)
    res.status(500).json({ ok: false, error: error.message || 'Er is een fout opgetreden bij het bijwerken van salaris' })
  }
})

// Payroll Scales API Routes

// Get all payroll scales
router.get('/payroll/scales', requireAuth, async (req, res) => {
  try {
    // Check if user is manager or admin
    let isUserAdmin = req.user?.user_metadata?.is_admin === true
    let isUserManager = false
    
    if (!isUserAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle()
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true
      }
    }
    
    if (!isUserAdmin && !isUserManager) {
      return res.status(403).json({ ok: false, error: 'Alleen managers en admins kunnen schalen bekijken' })
    }
    
    const { data: scales, error } = await supabaseAdmin
      .from('payroll_scales')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
    
    if (error) throw error
    
    res.json({ ok: true, data: scales || [] })
  } catch (error) {
    console.error('Error fetching payroll scales:', error)
    res.status(500).json({ ok: false, error: error.message || 'Fout bij ophalen schalen' })
  }
})

// Create payroll scale (admin only)
router.post('/payroll/scales', requireAuth, async (req, res) => {
  try {
    const isUserAdmin = req.user?.user_metadata?.is_admin === true
    if (!isUserAdmin) {
      return res.status(403).json({ ok: false, error: 'Alleen admins kunnen schalen aanmaken' })
    }
    
    const { 
      name, 
      hourly_rate_cents, 
      description,
      roles,
      travel_type,
      travel_amount_cents,
      travel_max_km_per_day,
      travel_roundtrip
    } = req.body
    
    // Validate required fields
    if (!name || !hourly_rate_cents) {
      return res.status(400).json({ ok: false, error: 'Naam en uurtarief zijn verplicht' })
    }
    
    // Validate roles (required, array, min 1)
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ ok: false, error: 'Selecteer minimaal één functie/rol' })
    }
    
    // Validate travel_type (required, must be valid, no 'none' option)
    const validTravelTypes = ['per_km', 'per_day', 'monthly']
    if (!travel_type || !validTravelTypes.includes(travel_type)) {
      return res.status(400).json({ ok: false, error: 'Selecteer een geldig type reiskosten' })
    }
    
    // Validate travel amount (required, must be > 0)
    const travelAmountCents = parseInt(travel_amount_cents) || 0
    if (travelAmountCents <= 0) {
      return res.status(400).json({ ok: false, error: 'Reiskosten bedrag moet groter zijn dan 0' })
    }
    
    // Validate travel-specific fields based on type
    if (travel_type === 'per_km') {
      if (travel_max_km_per_day !== undefined && travel_max_km_per_day !== null) {
        const maxKm = parseInt(travel_max_km_per_day)
        if (isNaN(maxKm) || maxKm <= 0) {
          return res.status(400).json({ ok: false, error: 'Max km per dag moet groter zijn dan 0' })
        }
      }
    }
    
    const rateCents = parseInt(hourly_rate_cents)
    if (isNaN(rateCents) || rateCents < 0) {
      return res.status(400).json({ ok: false, error: 'Ongeldig uurtarief' })
    }
    
    // Build insert data
    const insertData = {
      name,
      hourly_rate_cents: rateCents,
      description: description || null,
      roles: roles,
      travel_type: travel_type,
      travel_amount_cents: travelAmountCents,
      travel_roundtrip: travel_roundtrip !== undefined ? Boolean(travel_roundtrip) : true,
      created_by: req.user.id
    }
    
    // Only include travel_max_km_per_day if travel_type is per_km
    if (travel_type === 'per_km' && travel_max_km_per_day !== undefined && travel_max_km_per_day !== null) {
      insertData.travel_max_km_per_day = parseInt(travel_max_km_per_day)
    } else {
      insertData.travel_max_km_per_day = null
    }
    
    const { data: scale, error } = await supabaseAdmin
      .from('payroll_scales')
      .insert(insertData)
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ ok: true, data: scale, message: 'Schaal succesvol aangemaakt' })
  } catch (error) {
    console.error('Error creating payroll scale:', error)
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ ok: false, error: 'Een schaal met deze naam bestaat al' })
    }
    res.status(500).json({ ok: false, error: error.message || 'Fout bij aanmaken schaal' })
  }
})

// Update payroll scale (admin only)
router.put('/payroll/scales/:id', requireAuth, async (req, res) => {
  try {
    const isUserAdmin = req.user?.user_metadata?.is_admin === true
    if (!isUserAdmin) {
      return res.status(403).json({ ok: false, error: 'Alleen admins kunnen schalen bewerken' })
    }
    
    const { id } = req.params
    const { 
      name, 
      hourly_rate_cents, 
      description, 
      is_active,
      roles,
      travel_type,
      travel_amount_cents,
      travel_max_km_per_day,
      travel_roundtrip
    } = req.body
    
    const updateData = {}
    
    if (name !== undefined) updateData.name = name
    if (hourly_rate_cents !== undefined) {
      const rateCents = parseInt(hourly_rate_cents)
      if (isNaN(rateCents) || rateCents < 0) {
        return res.status(400).json({ ok: false, error: 'Ongeldig uurtarief' })
      }
      updateData.hourly_rate_cents = rateCents
    }
    if (description !== undefined) updateData.description = description
    if (is_active !== undefined) updateData.is_active = is_active
    
    // Validate and update roles
    if (roles !== undefined) {
      if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ ok: false, error: 'Selecteer minimaal één functie/rol' })
      }
      updateData.roles = roles
    }
    
    // Validate and update travel fields
    if (travel_type !== undefined) {
      const validTravelTypes = ['none', 'per_km', 'per_day', 'monthly']
      if (!validTravelTypes.includes(travel_type)) {
        return res.status(400).json({ ok: false, error: 'Selecteer een geldig type reiskosten' })
      }
      updateData.travel_type = travel_type
    }
    
    if (travel_amount_cents !== undefined) {
      const travelAmountCents = parseInt(travel_amount_cents) || 0
      if (travelAmountCents <= 0) {
        return res.status(400).json({ ok: false, error: 'Reiskosten bedrag moet groter zijn dan 0' })
      }
      updateData.travel_amount_cents = travelAmountCents
    }
    
    if (travel_roundtrip !== undefined) {
      updateData.travel_roundtrip = Boolean(travel_roundtrip)
    }
    
    // Handle travel_max_km_per_day based on travel_type
    const finalTravelType = travel_type !== undefined ? travel_type : (await supabaseAdmin.from('payroll_scales').select('travel_type').eq('id', id).single()).data?.travel_type
    if (travel_max_km_per_day !== undefined) {
      if (finalTravelType === 'per_km') {
        if (travel_max_km_per_day !== null && travel_max_km_per_day !== '') {
          const maxKm = parseInt(travel_max_km_per_day)
          if (isNaN(maxKm) || maxKm <= 0) {
            return res.status(400).json({ ok: false, error: 'Max km per dag moet groter zijn dan 0' })
          }
          updateData.travel_max_km_per_day = maxKm
        } else {
          updateData.travel_max_km_per_day = null
        }
      } else {
        updateData.travel_max_km_per_day = null
      }
    }
    
    const { data: scale, error } = await supabaseAdmin
      .from('payroll_scales')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    if (!scale) {
      return res.status(404).json({ ok: false, error: 'Schaal niet gevonden' })
    }
    
    res.json({ ok: true, data: scale, message: 'Schaal succesvol bijgewerkt' })
  } catch (error) {
    console.error('Error updating payroll scale:', error)
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ ok: false, error: 'Een schaal met deze naam bestaat al' })
    }
    res.status(500).json({ ok: false, error: error.message || 'Fout bij bijwerken schaal' })
  }
})

// Delete payroll scale (admin only)
router.delete('/payroll/scales/:id', requireAuth, async (req, res) => {
  try {
    const isUserAdmin = req.user?.user_metadata?.is_admin === true
    if (!isUserAdmin) {
      return res.status(403).json({ ok: false, error: 'Alleen admins kunnen schalen verwijderen' })
    }
    
    const { id } = req.params
    
    // Check if scale is used by any employees
    const { data: employees, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('payroll_scale_id', id)
      .limit(1)
    
    if (checkError) throw checkError
    
    if (employees && employees.length > 0) {
      return res.status(400).json({ ok: false, error: 'Deze schaal wordt nog gebruikt door werknemers. Verwijder eerst de toewijzingen.' })
    }
    
    const { error } = await supabaseAdmin
      .from('payroll_scales')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    res.json({ ok: true, message: 'Schaal succesvol verwijderd' })
  } catch (error) {
    console.error('Error deleting payroll scale:', error)
    res.status(500).json({ ok: false, error: error.message || 'Fout bij verwijderen schaal' })
  }
})

// Contract document upload storage
const _isVercelApi = process.env.VERCEL === '1' || process.env.VERCEL_ENV
const contractStorage = _isVercelApi ? multer.memoryStorage() : multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'contracts')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const { id } = req.params
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `contract-${id}-${uniqueSuffix}${ext}`)
  }
})

const uploadContract = multer({ 
  storage: contractStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Ongeldig bestandstype. Alleen PDF, DOC en DOCX toegestaan.'))
    }
  }
})

// POST /api/employees/:id/contract
// Upload contract document (manager/admin only)
router.post('/employees/:id/contract', requireAuth, (req, res, next) => {
  uploadContract.single('contract')(req, res, (err) => {
    if (err) {
      // Handle multer errors (file size, file type, etc.)
      return res.status(400).json({ 
        ok: false, 
        error: err.message || 'Fout bij uploaden bestand' 
      })
    }
    next()
  })
}, async (req, res) => {
  try {
    const { id } = req.params
    
    // Check if user is manager or admin
    let isUserAdmin = req.user?.user_metadata?.is_admin === true
    let isUserManager = false
    
    if (!isUserAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle()
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true
      }
    }
    
    if (!isUserAdmin && !isUserManager) {
      if (req.file && !_isVercelApi && req.file.path) fs.unlinkSync(req.file.path)
      return res.status(403).json({ ok: false, error: 'Alleen managers en admins kunnen contracten uploaden' })
    }
    
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Geen bestand geüpload' })
    }
    let documentUrl
    if (_isVercelApi && req.file.buffer) {
      const { ensureStorageBucket } = require('../utils/storage')
      const bucketOk = await ensureStorageBucket('uploads', true)
      if (!bucketOk) return res.status(500).json({ ok: false, error: 'Storage niet beschikbaar' })
      const ext = path.extname(req.file.originalname) || '.pdf'
      const fileName = `contracts/contract-${id}-${Date.now()}${ext}`
      const { error: uploadErr } = await supabaseAdmin.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true })
      if (uploadErr) return res.status(500).json({ ok: false, error: 'Fout bij uploaden: ' + uploadErr.message })
      const { data: { publicUrl } } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName)
      documentUrl = publicUrl
    } else {
      documentUrl = '/uploads/contracts/' + req.file.filename
    }
    // Get original filename and ensure proper UTF-8 encoding
    let originalFileName = req.file.originalname
    
    // Multer may receive filename in wrong encoding from browser
    // Try to fix common encoding issues (latin1 -> utf8)
    if (typeof originalFileName === 'string') {
      try {
        // Check if filename contains mojibake (wrong encoding artifacts)
        // Common pattern: é becomes Ã© or Ì
        if (originalFileName.includes('Ã') || originalFileName.includes('Ì')) {
          // Try to fix: decode as latin1, then encode as utf8
          originalFileName = Buffer.from(originalFileName, 'latin1').toString('utf8')
        }
      } catch (e) {
        // If conversion fails, use original
        console.warn('Could not normalize filename encoding:', e.message)
      }
    }
    
    // Update employee profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        contract_document_url: documentUrl,
        contract_document_name: originalFileName
      })
      .eq('id', id)
    
    if (updateError) {
      if (!_isVercelApi && req.file?.path) fs.unlinkSync(req.file.path)
      throw updateError
    }
    
    res.json({ 
      ok: true, 
      url: documentUrl,
      filename: originalFileName,
      message: 'Contract succesvol geüpload' 
    })
  } catch (error) {
    console.error('Contract upload error:', error)
    if (!_isVercelApi && req.file?.path) fs.unlinkSync(req.file.path)
    res.status(500).json({ 
      ok: false, 
      error: error.message || 'Er is een fout opgetreden bij het uploaden' 
    })
  }
})

// DELETE /api/employees/:id/contract
// Delete contract document (manager/admin only)
router.delete('/employees/:id/contract', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    
    // Check if user is manager or admin
    let isUserAdmin = req.user?.user_metadata?.is_admin === true
    let isUserManager = false
    
    if (!isUserAdmin && req.user?.role_id) {
      const { data: role } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .maybeSingle()
      if (role?.name?.toLowerCase().includes('manager')) {
        isUserManager = true
      }
    }
    
    if (!isUserAdmin && !isUserManager) {
      return res.status(403).json({ ok: false, error: 'Alleen managers en admins kunnen contracten verwijderen' })
    }
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('contract_document_url')
      .eq('id', id)
      .single()
    
    if (profileError) throw profileError
    
    if (profile?.contract_document_url) {
      const url = profile.contract_document_url
      if (url.startsWith('http') && url.includes('supabase') && url.includes('/storage/')) {
        const match = url.match(/\/object\/public\/uploads\/(.+)$/)
        if (match) {
          await supabaseAdmin.storage.from('uploads').remove([match[1]])
        }
      } else {
        const filePath = path.join(__dirname, '..', 'public', url)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }
    }
    
    // Update database
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ contract_document_url: null })
      .eq('id', id)
    
    if (updateError) throw updateError
    
    res.json({ ok: true, message: 'Contract succesvol verwijderd' })
  } catch (error) {
    console.error('Contract delete error:', error)
    res.status(500).json({ ok: false, error: error.message || 'Er is een fout opgetreden bij het verwijderen' })
  }
})

// =====================================================
// SCRAPER MODULE - API ENDPOINTS
// =====================================================

const ScraperService = require('../services/scraperService')

// POST /api/admin/scraper/jobs - Create new scraper job
router.post('/admin/scraper/jobs', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const {
      location_text,
      radius_km = 20,
      branches = [],
      service_id,
      desired_fields = ['company_name', 'website', 'phone', 'email'],
      max_results = 50,
      only_nl = true,
      max_pages_per_domain = 2
    } = req.body

    if (!location_text || location_text.trim() === '') {
      return res.status(400).json({ error: 'location_text is required' })
    }

    // Validate desired_fields
    const validFields = ['company_name', 'website', 'phone', 'email', 'address', 'city', 'postcode', 'contact_person', 'notes']
    const filteredFields = desired_fields.filter(f => validFields.includes(f))
    if (!filteredFields.includes('company_name')) {
      filteredFields.unshift('company_name') // Always include company_name
    }

    // Create job
    const { data: job, error } = await supabaseAdmin
      .from('scraper_jobs')
      .insert({
        created_by: req.user.id,
        location_text: location_text.trim(),
        radius_km: parseInt(radius_km) || 20,
        branches: Array.isArray(branches) ? branches : [],
        service_id: service_id || null,
        desired_fields: filteredFields,
        max_results: parseInt(max_results) || 50,
        only_nl: only_nl !== false,
        max_pages_per_domain: parseInt(max_pages_per_domain) || 2,
        status: 'queued'
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // Start job asynchronously (don't await)
    ScraperService.runJob(job.id).catch(err => {
      console.error('Scraper job error:', err)
    })

    res.json({ success: true, job })
  } catch (err) {
    console.error('Error creating scraper job:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/scraper/jobs - List jobs
router.get('/admin/scraper/jobs', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20
    const activeOnly = req.query.active === 'true'
    
    let query = supabaseAdmin
      .from('scraper_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (activeOnly) {
      query = query.in('status', ['queued', 'running'])
    }

    const { data: jobs, error } = await query

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json({ jobs: jobs || [] })
  } catch (err) {
    console.error('Error fetching jobs:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/scraper/jobs/:id - Get job detail
router.get('/admin/scraper/jobs/:id', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data: job, error } = await supabaseAdmin
      .from('scraper_jobs')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) {
      return res.status(404).json({ error: 'Job not found' })
    }

    res.json({ job })
  } catch (err) {
    console.error('Error fetching job:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/scraper/jobs/:id/results - Get job results
router.get('/admin/scraper/jobs/:id/results', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const cursor = req.query.cursor
    const hasPhone = req.query.has_phone === 'true'
    const hasEmail = req.query.has_email === 'true'
    const minScore = req.query.min_score ? parseInt(req.query.min_score) : null

    let query = supabaseAdmin
      .from('scraper_results')
      .select('*')
      .eq('job_id', req.params.id)
      .eq('is_blocked', false) // Never show blocked results
      .order('created_at', { ascending: false })
      .limit(50)

    // CRITICAL: Only show results with at least phone OR email (minimale data vereiste)
    // This ensures we don't show null/null/null results
    // Note: We'll filter client-side as Supabase .or() syntax is complex for this case

    if (hasPhone) {
      query = query.not('phone', 'is', null)
    }
    if (hasEmail) {
      query = query.not('email', 'is', null)
    }
    if (minScore !== null) {
      query = query.gte('fit_score', minScore)
    }
    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data: results, error } = await query

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // Additional client-side filter: ensure at least phone OR email is valid (not null string)
    const filteredResults = (results || []).filter(r => {
      const hasPhone = r.phone && r.phone.trim() !== '' && r.phone !== 'null'
      const hasEmail = r.email && r.email.trim() !== '' && r.email !== 'null' && r.email.includes('@')
      return hasPhone || hasEmail
    })

    res.json({ results: filteredResults })
  } catch (err) {
    console.error('Error fetching results:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/scraper/jobs/:id/cancel - Cancel job
router.post('/admin/scraper/jobs/:id/cancel', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data: job, error } = await supabaseAdmin
      .from('scraper_jobs')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .eq('status', 'running') // Only cancel running jobs
      .select()
      .single()

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found or not running' })
    }

    res.json({ success: true, job })
  } catch (err) {
    console.error('Error cancelling job:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/scraper/results/:resultId/create-kans - Create opportunity from result
router.post('/admin/scraper/results/:resultId/create-kans', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    // Fetch result
    const { data: result, error: resultError } = await supabaseAdmin
      .from('scraper_results')
      .select('*')
      .eq('id', req.params.resultId)
      .single()

    if (resultError || !result) {
      return res.status(404).json({ error: 'Result not found' })
    }

    // Check if already converted
    if (result.opportunity_id) {
      return res.status(400).json({ error: 'Already converted to kans' })
    }

    // Create opportunity (reuse existing pattern)
    const title = `${result.company_name}${result.city ? ` - ${result.city}` : ''}`.slice(0, 140)
    
    const { data: opportunity, error: oppError } = await supabaseAdmin
      .from('opportunities')
      .insert({
        title,
        contact_name: result.contact_person || null,
        email: result.email || null,
        company_name: result.company_name,
        phone: result.phone || null,
        address: result.address || null,
        city: result.city || null,
        postcode: result.postcode || null,
        status: 'open',
        stage: 'nieuw',
        owner_id: req.user.id,
        value: null, // Can be estimated later
        notes: `Gevonden via scraper.\nFit score: ${result.fit_score}/100\n${result.fit_reason || ''}\n\nWebsite: ${result.website || 'N/A'}\nBron: ${result.source_url || 'N/A'}`
      })
      .select()
      .single()

    if (oppError) {
      return res.status(500).json({ error: oppError.message })
    }

    // Update result - mark as created AND mark opportunity as from scraper
    await supabaseAdmin
      .from('scraper_results')
      .update({
        status: 'created_as_kans',
        opportunity_id: opportunity.id
      })
      .eq('id', result.id)

    // Mark opportunity with scraper source (so it's never scraped again)
    await supabaseAdmin
      .from('opportunities')
      .update({
        meta: { source: 'scraper', scraper_result_id: result.id }
      })
      .eq('id', opportunity.id)

    res.json({ success: true, opportunity })
  } catch (err) {
    console.error('Error creating kans:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/scraper/scripts - Get call scripts
router.get('/admin/scraper/scripts', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const serviceId = req.query.service_id

    let query = supabaseAdmin
      .from('scraper_call_scripts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (serviceId) {
      query = query.eq('service_id', serviceId)
    }

    const { data: scripts, error } = await query

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json({ scripts: scripts || [] })
  } catch (err) {
    console.error('Error fetching scripts:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/scraper/scripts - Create script
router.post('/admin/scraper/scripts', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { service_id, script_text, title } = req.body

    if (!service_id || !script_text) {
      return res.status(400).json({ error: 'service_id and script_text are required' })
    }

    const { data: script, error } = await supabaseAdmin
      .from('scraper_call_scripts')
      .insert({
        service_id,
        script_text,
        title: title || 'Standaard belscript',
        is_active: true
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json({ success: true, script })
  } catch (err) {
    console.error('Error creating script:', err)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/admin/scraper/scripts/:id - Update script
router.patch('/admin/scraper/scripts/:id', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { script_text, title } = req.body

    const updateData = {}
    if (script_text !== undefined) updateData.script_text = script_text
    if (title !== undefined) updateData.title = title

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    const { data: script, error } = await supabaseAdmin
      .from('scraper_call_scripts')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.json({ success: true, script })
  } catch (err) {
    console.error('Error updating script:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/scraper/results/:resultId/check-existing - Check if company is already customer/opportunity
router.get('/admin/scraper/results/:resultId/check-existing', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { data: result } = await supabaseAdmin
      .from('scraper_results')
      .select('company_name, email, phone')
      .eq('id', req.params.resultId)
      .single()

    if (!result) {
      return res.status(404).json({ error: 'Result not found' })
    }

    // Check customers
    let customerQuery = supabaseAdmin
      .from('customers')
      .select('id, name')
      .limit(1)
    
    if (result.company_name) {
      customerQuery = customerQuery.ilike('name', `%${result.company_name}%`)
    }
    if (result.email) {
      if (result.company_name) {
        customerQuery = customerQuery.or(`name.ilike.%${result.company_name}%,email.eq.${result.email}`)
      } else {
        customerQuery = customerQuery.eq('email', result.email)
      }
    }
    
    const { data: customer } = await customerQuery.maybeSingle()

    // Check opportunities
    let oppQuery = supabaseAdmin
      .from('opportunities')
      .select('id, company_name, title')
      .limit(1)
    
    if (result.company_name) {
      oppQuery = oppQuery.ilike('company_name', `%${result.company_name}%`)
    }
    if (result.email) {
      if (result.company_name) {
        oppQuery = oppQuery.or(`company_name.ilike.%${result.company_name}%,email.eq.${result.email}`)
      } else {
        oppQuery = oppQuery.eq('email', result.email)
      }
    }
    
    const { data: opportunity } = await oppQuery.maybeSingle()

    res.json({
      is_customer: !!customer,
      is_opportunity: !!opportunity,
      customer: customer || null,
      opportunity: opportunity || null
    })
  } catch (err) {
    console.error('Error checking existing:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/scraper/results/:resultId/block - Block company (zwarte lijst)
router.post('/admin/scraper/results/:resultId/block', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    const { reason } = req.body

    // Fetch result
    const { data: result } = await supabaseAdmin
      .from('scraper_results')
      .select('*')
      .eq('id', req.params.resultId)
      .single()

    if (!result) {
      return res.status(404).json({ error: 'Result not found' })
    }

    // Add to blocked list
    const { data: blocked, error } = await supabaseAdmin
      .from('scraper_blocked_domains')
      .insert({
        created_by: req.user.id,
        domain: result.source_domain || null,
        company_name: result.company_name || null,
        reason: reason || 'Geblokkeerd door gebruiker',
        opportunity_id: result.opportunity_id || null
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // Mark result as blocked
    await supabaseAdmin
      .from('scraper_results')
      .update({ is_blocked: true })
      .eq('id', req.params.resultId)

    res.json({ success: true, blocked })
  } catch (err) {
    console.error('Error blocking company:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/admin/scraper/opportunities/:id - Delete opportunity
router.delete('/admin/scraper/opportunities/:id', requireAuth, isManagerOrAdmin, async (req, res) => {
  try {
    // Check if opportunity exists
    const { data: opportunity, error: oppError } = await supabaseAdmin
      .from('opportunities')
      .select('id, meta')
      .eq('id', req.params.id)
      .single()

    if (oppError || !opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' })
    }

    // Delete opportunity
    const { error: deleteError } = await supabaseAdmin
      .from('opportunities')
      .delete()
      .eq('id', req.params.id)

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message })
    }

    // If it was linked to a scraper result, update the result
    if (opportunity.meta?.scraper_result_id) {
      await supabaseAdmin
        .from('scraper_results')
        .update({ opportunity_id: null, status: 'new' })
        .eq('id', opportunity.meta.scraper_result_id)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting opportunity:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
