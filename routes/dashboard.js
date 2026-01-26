const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const multer = require('multer');
const path = require('path');
const UserRiskAssessmentService = require('../services/userRiskAssessmentService');
const ActivityService = require('../services/activityService');

const { requireAuth } = require('../middleware/auth');
const { handleFirstContact, handleWon, handleLost } = require('../lib/performanceTriggers');

// Helper function to create user object for templates
async function createUserForTemplate(req) {
  try {
    console.log('📋 createUserForTemplate - Fetching profile for user:', req.user.id);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle()

    if (profileError) {
      console.error('❌ Profile error in createUserForTemplate:', profileError);
    }

    if (!profile) {
      // Profile doesn't exist - try to create it
      console.log(`📝 Creating missing profile for user ${req.user.id} in createUserForTemplate`);
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: req.user.id,
          email: req.user.email,
          company_name: req.user.user_metadata?.company_name || null,
          first_name: req.user.user_metadata?.first_name || null,
          last_name: req.user.user_metadata?.last_name || null,
          role_id: null,
          status: 'active',
          balance: 0,
          is_admin: req.user.user_metadata?.is_admin === true || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select('*')
        .single();
      
      if (createError) {
        console.error('❌ Error creating profile in createUserForTemplate:', createError);
      } else {
        console.log('✅ Profile created for user:', req.user.id);
        profile = newProfile;
      }
    }
    
    if (profile) {
      console.log('✅ Profile found:', {
        first_name: profile.first_name,
        last_name: profile.last_name,
        company_name: profile.company_name,
        email: profile.email,
        postal_code: profile.postal_code,
        city: profile.city
      });
    }

    console.log('📋 createUserForTemplate - Profile picture:', profile?.profile_picture)

    // Build user object - prioritize database profile data over session data
    // IMPORTANT: Spread userObj LAST to ensure database data overwrites session data
    const userObj = {
      id: req.user.id,
      email: profile?.email || req.user.email || '',
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
      company_name: profile?.company_name || null,
      phone: profile?.phone || null,
      postal_code: profile?.postal_code || null,
      city: profile?.city || null,
      country: profile?.country || null,
      street: profile?.street || null, // Database column name
      address: profile?.street || profile?.address || null, // Support both 'street' and 'address' column names
      sepa_consent_accepted: profile?.sepa_consent_accepted || false,
      has_payment_method: profile?.has_payment_method || false,
      payment_method: profile?.payment_method || null,
      profile_picture: profile?.profile_picture || null,
      // Billing fields
      billing_company_name: profile?.billing_company_name || null,
      billing_address: profile?.billing_address || null,
      billing_postal_code: profile?.billing_postal_code || null,
      billing_city: profile?.billing_city || null,
      billing_country: profile?.billing_country || 'NL',
      vat_number: profile?.vat_number || null,
      coc_number: profile?.coc_number || profile?.chamber_of_commerce || null,
      chamber_of_commerce: profile?.chamber_of_commerce || profile?.coc_number || null
    };
    
    console.log('📋 createUserForTemplate - Built userObj:', {
      first_name: userObj.first_name,
      last_name: userObj.last_name,
      company_name: userObj.company_name,
      email: userObj.email,
      postal_code: userObj.postal_code,
      city: userObj.city,
      country: userObj.country,
      phone: userObj.phone,
      street: userObj.street,
      address: userObj.address
    });
    
    // Merge: req.user first, then userObj (database data) to overwrite
    // This ensures database data takes precedence over session data
    const finalUser = {
      ...req.user,
      ...userObj
    };
    
    console.log('📋 createUserForTemplate - Final user object:', {
      first_name: finalUser.first_name,
      last_name: finalUser.last_name,
      company_name: finalUser.company_name,
      email: finalUser.email,
      postal_code: finalUser.postal_code,
      city: finalUser.city,
      country: finalUser.country,
      phone: finalUser.phone,
      street: finalUser.street,
      address: finalUser.address
    });
    
    return finalUser;
  } catch (err) {
    console.error('Error creating user template:', err);
    return {
      id: req.user?.id || '',
      email: req.user?.email || '',
      first_name: '',
      last_name: '',
      company_name: '',
      phone: '',
      postal_code: '',
      city: '',
      country: '',
      address: '',
      sepa_consent_accepted: false,
      has_payment_method: false,
      payment_method: null,
      profile_picture: null,
      // Billing fields
      billing_company_name: '',
      billing_address: '',
      billing_postal_code: '',
      billing_city: '',
      billing_country: '',
      vat_number: '',
      coc_number: '',
      chamber_of_commerce: '',
      ...req.user
    };
  }
}

// Dashboard hoofdpagina
router.get('/', requireAuth, async (req, res) => {
  try {
    // Redirect new users to dedicated onboarding page (server-side, before heavy queries)
    // Skip onboarding for managers and employees (non-customer roles)
    try {
      // First check if user is admin, manager, or employee (should skip onboarding)
      let shouldSkipOnboarding = false;
      
      // Check if user is admin
      if (req.user.user_metadata?.is_admin === true) {
        shouldSkipOnboarding = true;
      } else {
        // Check role to see if user is manager or employee (not customer)
        const { data: profileCheck, error: profileCheckErr } = await supabaseAdmin
          .from('profiles')
          .select('is_admin, role_id')
          .eq('id', req.user.id)
          .single();
        
        if (!profileCheckErr && profileCheck) {
          // Admins skip onboarding
          if (profileCheck.is_admin === true) {
            shouldSkipOnboarding = true;
          } else if (profileCheck.role_id) {
            // Check role name
            const { data: role, error: roleErr } = await supabaseAdmin
              .from('roles')
              .select('name')
              .eq('id', profileCheck.role_id)
              .maybeSingle();
            
            if (!roleErr && role) {
              const roleName = role.name?.toLowerCase() || '';
              // Skip onboarding for managers and employees (not customers)
              if (roleName.includes('manager') || 
                  roleName.includes('employee') || 
                  roleName.includes('werknemer') ||
                  roleName.includes('admin')) {
                shouldSkipOnboarding = true;
              } else if (roleName === 'consumer' || roleName === 'customer' || roleName === 'klant') {
                // Customers should see onboarding
                shouldSkipOnboarding = false;
              }
            }
          }
        }
      }
      
      // If user should skip onboarding, mark it as completed
      if (shouldSkipOnboarding) {
        const { data: ob, error: obErr } = await supabaseAdmin
          .from('profiles')
          .select('onboarding_completed_at, onboarding_step')
          .eq('id', req.user.id)
          .single();
        
        // Auto-complete onboarding for managers/employees if not already completed
        if (!obErr && ob && !ob.onboarding_completed_at) {
          await supabaseAdmin
            .from('profiles')
            .update({
              onboarding_completed_at: new Date().toISOString(),
              onboarding_step: 99
            })
            .eq('id', req.user.id);
          console.log('[DASHBOARD] Auto-completed onboarding for manager/employee:', req.user.id);
        }
        // Continue to dashboard (skip onboarding redirect)
      } else {
        // Regular onboarding check for customers
        const { data: ob, error: obErr } = await supabaseAdmin
          .from('profiles')
          .select('onboarding_completed_at, onboarding_step')
          .eq('id', req.user.id)
          .single()

        if (obErr) {
          console.warn('[DASHBOARD] Onboarding status check error:', obErr.message);
          // If error, continue to dashboard (fail gracefully)
        } else if (ob) {
          const completed = !!ob?.onboarding_completed_at;
          const step = ob?.onboarding_step || 0;
          
          console.log('[DASHBOARD] Onboarding check:', {
            userId: req.user.id,
            completed: completed,
            step: step,
            shouldRedirect: !completed && step < 99
          });
          
          // Redirect if onboarding not completed and step is less than 99
          // Step 99 means "ready for tour" - allow access to dashboard even if not fully completed
          // Also redirect if step is NULL (new users)
          if (!completed && (step < 99 || step === null || step === undefined)) {
            console.log('[DASHBOARD] Redirecting to onboarding for user:', req.user.id);
            return res.redirect('/onboarding');
          }
          // If step >= 99 but not completed, user is in tour - allow dashboard access
        } else {
          // No profile found - try to create it
          console.log(`[DASHBOARD] Creating missing profile for user ${req.user.id}`);
          
          // Check if user should skip onboarding before creating profile
          let shouldSkipOnboarding = false;
          if (req.user.user_metadata?.is_admin === true) {
            shouldSkipOnboarding = true;
          }
          
          const { data: newProfile, error: createError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: req.user.id,
              email: req.user.email,
              company_name: req.user.user_metadata?.company_name || null,
              first_name: req.user.user_metadata?.first_name || null,
              last_name: req.user.user_metadata?.last_name || null,
              role_id: null,
              status: 'active',
              balance: 0,
              is_admin: req.user.user_metadata?.is_admin === true || false,
              onboarding_completed_at: shouldSkipOnboarding ? new Date().toISOString() : null,
              onboarding_step: shouldSkipOnboarding ? 99 : 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            })
            .select('onboarding_completed_at, onboarding_step, role_id')
            .single();
          
          if (createError) {
            console.error('[DASHBOARD] Error creating profile:', createError);
          } else {
            console.log('[DASHBOARD] ✅ Profile created for user:', req.user.id);
            
            // If profile was created with role_id, check if it's manager/employee
            if (newProfile?.role_id && !shouldSkipOnboarding) {
              const { data: role, error: roleErr } = await supabaseAdmin
                .from('roles')
                .select('name')
                .eq('id', newProfile.role_id)
                .maybeSingle();
              
              if (!roleErr && role) {
                const roleName = role.name?.toLowerCase() || '';
                if (roleName.includes('manager') || 
                    roleName.includes('employee') || 
                    roleName.includes('werknemer') ||
                    roleName.includes('admin')) {
                  // Auto-complete onboarding for managers/employees
                  await supabaseAdmin
                    .from('profiles')
                    .update({
                      onboarding_completed_at: new Date().toISOString(),
                      onboarding_step: 99
                    })
                    .eq('id', req.user.id);
                  shouldSkipOnboarding = true;
                  console.log('[DASHBOARD] Auto-completed onboarding for manager/employee:', req.user.id);
                }
              }
            }
            
            // Retry onboarding check with new profile (only for customers)
            if (!shouldSkipOnboarding && newProfile) {
              const completed = !!newProfile?.onboarding_completed_at;
              const step = newProfile?.onboarding_step || 0;
              if (!completed && (step < 99 || step === null || step === undefined)) {
                console.log('[DASHBOARD] Redirecting to onboarding for user:', req.user.id);
                return res.redirect('/onboarding');
              }
            }
          }
        }
      }
    } catch (obCheckErr) {
      console.error('[DASHBOARD] Onboarding status check exception:', obCheckErr);
      // Continue to dashboard on error
    }
    // Get leads for the current user
    // Show all leads where user is owner OR assigned to (regardless of status)
    // Use supabaseAdmin to bypass RLS and ensure visibility
    let leads = [];
    try {
      const { data: leadsData, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .or(`user_id.eq.${req.user.id},assigned_to.eq.${req.user.id}`)
      .order('created_at', { ascending: false })

      if (leadsError) {
        console.error('❌ [DASHBOARD] Error fetching leads:', leadsError);
        leads = [];
      } else {
        leads = leadsData || [];
      }
    } catch (leadsErr) {
      console.error('❌ [DASHBOARD] Exception fetching leads:', leadsErr);
      leads = [];
    }

    // Process leads data for charts
    const currentYear = new Date().getFullYear();
    const months = Array(12).fill(0); // Initialize array with 12 zeros
    const revenue = Array(12).fill(0); // Initialize array with 12 zeros

    leads.forEach(lead => {
      const date = new Date(lead.created_at);
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth();
        months[month]++;
        
        // Calculate revenue for accepted leads
        if (lead.status === 'accepted' && lead.price_at_purchase) {
          revenue[month] += parseFloat(lead.price_at_purchase) || 0;
        }
      }
    });

    // Get recent leads for the table
    const recentLeads = leads.slice(0, 5);

    // Haal betalingen op voor deze gebruiker
    let payments = [];
    try {
      const { data: paymentsData, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

      if (paymentsError) {
        console.error('❌ [DASHBOARD] Error fetching payments:', paymentsError);
        payments = [];
      } else {
        payments = paymentsData || [];
      }
    } catch (paymentsErr) {
      console.error('❌ [DASHBOARD] Exception fetching payments:', paymentsErr);
      payments = [];
    }

    // Haal gebruiker op voor saldo (service role zodat RLS nooit blokkeert)
    let user = { balance: 0 };
    try {
      const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', req.user.id)
      .single()

      if (userError) {
        console.error('❌ [DASHBOARD] Error fetching user:', userError);
        user = { balance: 0 };
      } else {
        user = userData || { balance: 0 };
      }
    } catch (userErr) {
      console.error('❌ [DASHBOARD] Exception fetching user:', userErr);
      user = { balance: 0 };
    }

    // Bereken statistieken met echte data
    const stats = {
      totalLeads: leads?.length || 0,
      newLeads: leads?.filter(lead => lead.status === 'new').length || 0,
      acceptedLeads: leads?.filter(lead => lead.status === 'accepted').length || 0,
      totalPayments: payments?.length || 0,
      totalSpent: payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0,
      totalRevenue: leads?.filter(lead => lead.status === 'accepted').reduce((sum, lead) => sum + (parseFloat(lead.price_at_purchase) || 0), 0) || 0
    }

    // Create user object for template
    const userForTemplate = await createUserForTemplate(req);
    userForTemplate.balance = user?.balance || 0;

    // Get user settings (service role om RLS-issues te voorkomen)
    let settings = { lead_limit: 50, paused: 0 };
    try {
      // FIX: lead_limit doesn't exist in profiles table - get from settings table instead
      const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('lead_limit, paused')
      .eq('user_id', req.user.id)
      .maybeSingle();
      
      if (settingsError) {
        console.error('❌ [DASHBOARD] Error fetching settings:', settingsError);
        settings = { lead_limit: 50, paused: 0 };
      } else {
        settings = settingsData || { lead_limit: 50, paused: 0 };
      }
    } catch (settingsErr) {
      console.error('❌ [DASHBOARD] Exception fetching settings:', settingsErr);
      settings = { lead_limit: 50, paused: 0 };
    }

    // Get monthly usage and quota for progress indicator
    // ALWAYS get quota from subscription first (source of truth)
    let monthlyQuota = 0;
    try {
      const { data: subscriptions, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('leads_per_month, status')
        .eq('user_id', req.user.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false });
      
      if (!subError && subscriptions && subscriptions.length > 0) {
        // Use the first subscription (most recent) - handle null explicitly
        const quotaValue = subscriptions[0].leads_per_month;
        if (quotaValue !== null && quotaValue !== undefined) {
          monthlyQuota = quotaValue;
        } else {
          // If leads_per_month is null, try to get from settings or use fallback
          monthlyQuota = settings?.lead_limit || 50;
        }
        console.log('📊 [DASHBOARD] Quota from subscription:', monthlyQuota, 'from', subscriptions.length, 'subscription(s)', 'raw value:', quotaValue);
      } else {
        console.log('⚠️ [DASHBOARD] No subscription found, using fallback. Error:', subError?.message);
        monthlyQuota = settings?.lead_limit || 50;
      }
    } catch (subError) {
      console.error('❌ [DASHBOARD] Error getting subscription quota:', subError);
      monthlyQuota = settings?.lead_limit || 50;
    }

    let monthlyUsage = 0;
    try {
      // Try to get billing snapshot using the database function
      const { data: snapshot, error: snapshotError } = await supabaseAdmin
        .rpc('get_billing_snapshot', { p_user: req.user.id });

      if (!snapshotError && snapshot && snapshot.length > 0) {
        monthlyUsage = snapshot[0].approved_count || 0;
        // Use monthly_quota from snapshot only if subscription query failed
        if (monthlyQuota === 0) {
          monthlyQuota = snapshot[0].monthly_quota || 0;
        }
      } else {
        // Fallback: calculate from leads for current month
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);
        
        const currentMonthEnd = new Date();
        currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1, 0);
        currentMonthEnd.setHours(23, 59, 59, 999);
        
        const monthlyAcceptedLeads = leads?.filter(lead => 
          lead.status === 'accepted' && 
          new Date(lead.created_at) >= currentMonthStart && 
          new Date(lead.created_at) <= currentMonthEnd
        ) || [];
        
        monthlyUsage = monthlyAcceptedLeads.length;
      }
    } catch (error) {
      console.log('Error getting monthly usage:', error.message);
      // Fallback: calculate from leads for current month
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);
      
      const currentMonthEnd = new Date();
      currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1, 0);
      currentMonthEnd.setHours(23, 59, 59, 999);
      
      const monthlyAcceptedLeads = leads?.filter(lead => 
        lead.status === 'accepted' && 
        new Date(lead.created_at) >= currentMonthStart && 
        new Date(lead.created_at) <= currentMonthEnd
      ) || [];
      
      monthlyUsage = monthlyAcceptedLeads.length;
    }
    
    console.log('📊 [DASHBOARD] Final values:', { monthlyUsage, monthlyQuota });
    console.log('📊 [DASHBOARD] Settings:', settings);
    console.log('📊 [DASHBOARD] Stats object:', { ...stats, monthlyUsage, monthlyQuota });

    // Ensure settings.lead_limit always matches monthlyQuota from subscription
    if (!settings) {
      settings = {};
    }
    settings.lead_limit = monthlyQuota;

    res.render('dashboard/index', {
      activeMenu: 'dashboard',
      user: userForTemplate,
      leads: recentLeads,
      payments: payments || [],
      balance: user?.balance || 0,
      stats: {
        ...stats,
        monthlyUsage: monthlyUsage,
        monthlyQuota: monthlyQuota
      },
      settings: settings,
      chartData: {
        leadsPerMonth: months,
        revenuePerMonth: revenue
      },
      error: null // No error, we handle errors gracefully now
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    // Create fallback user object for error case
    const fallbackUser = await createUserForTemplate(req);
    fallbackUser.balance = 0;

    res.render('dashboard/index', {
      activeMenu: 'dashboard',
      user: fallbackUser,
      leads: [],
      payments: [],
      balance: 0,
      stats: {
        totalLeads: 0,
        newLeads: 0,
        acceptedLeads: 0,
        totalPayments: 0,
        totalSpent: 0,
        monthlyUsage: 0,
        monthlyQuota: 50
      },
      settings: { lead_limit: 50, paused: 0 },
      chartData: null,
      error: 'Er is een fout opgetreden bij het laden van het dashboard'
    });
  }
});

// Leads pagina
router.get('/leads', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [LEADS] Route hit for user:', req.user.id);
    console.log('🔍 [LEADS] User object:', { id: req.user.id, email: req.user.email });
    
    // Get leads where user is owner OR assigned to (regardless of status)
    // This shows all leads related to the user
    // Use supabaseAdmin to bypass RLS and ensure visibility
    // Include first_contact_at for performance tracking
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*, first_contact_at, deal_value')
      .or(`user_id.eq.${req.user.id},assigned_to.eq.${req.user.id}`)
      .order('created_at', { ascending: false })

    console.log('🔍 [LEADS] Query result:', {
      leadsCount: leads?.length || 0,
      leads: leads?.map(l => ({ id: l.id, name: l.name, status: l.status, user_id: l.user_id, assigned_to: l.assigned_to })) || [],
      error: error?.message || null
    });

    if (error) {
      console.error('❌ [LEADS] Query error:', error);
      throw error;
    }

    // Get billing data for monthly usage
    let billingData = null;
    try {
      // Try to get billing snapshot using the database function
      const { data: snapshot, error: snapshotError } = await supabaseAdmin
        .rpc('get_billing_snapshot', { p_user: req.user.id });

      if (snapshotError) {
        console.error('Error getting billing snapshot:', snapshotError);
      } else if (snapshot && snapshot.length > 0) {
        billingData = snapshot[0];
      }
    } catch (rpcError) {
      console.log('RPC failed, trying manual data collection:', rpcError.message);
      
      // Fallback: Manual data collection
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7) + '-01';
      
      // Get user's subscription
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('leads_per_month, status')
        .eq('user_id', req.user.id)
        .eq('status', 'active')
        .single();

      // Get monthly usage from v_monthly_lead_usage view (same source as quota system)
      const { data: usage, error: usageError } = await supabaseAdmin
        .from('v_monthly_lead_usage')
        .select('approved_count, approved_amount')
        .eq('user_id', req.user.id)
        .single();

      // Get user balance
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('balance')
        .eq('id', req.user.id)
        .single();

      if (!subError && !usageError && !profileError) {
        billingData = {
          period_month: currentMonth,
          approved_count: usage ? usage.approved_count : 0,
          monthly_quota: subscription ? subscription.leads_per_month : 0,
          approved_amount: usage ? usage.approved_amount : 0,
          balance: profile ? profile.balance : 0,
          payment_method: 'sepa'
        };
      }
    }

    // Debug logging
    console.log('=== DASHBOARD LEADS DEBUG ===');
    console.log('BillingData:', billingData);
    console.log('Leads count:', leads?.length || 0);
    console.log('Accepted leads:', leads?.filter(lead => lead.status === 'accepted').length || 0);

    // Calculate statistics with fallback
    const acceptedLeadsCount = leads?.filter(lead => lead.status === 'accepted').length || 0;
    
    // Calculate monthly usage: ALL leads from this month (not just accepted)
    // This is for the "Deze maand" KPI which should show total leads received
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    const currentMonthEnd = new Date();
    currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1, 0);
    currentMonthEnd.setHours(23, 59, 59, 999);
    
    // Count ALL leads from this month (for "Deze maand" KPI)
    const monthlyLeads = leads?.filter(lead => {
      const leadDate = new Date(lead.created_at);
      return leadDate >= currentMonthStart && leadDate <= currentMonthEnd;
    }) || [];
    
    // Count accepted leads for billing/revenue (separate metric)
    const monthlyAcceptedLeads = monthlyLeads.filter(lead => lead.status === 'accepted');
    
    let monthlyUsage = monthlyLeads.length; // ALL leads this month (for KPI)
    let monthlyQuota = 0;
    let monthlyRevenue = monthlyAcceptedLeads.reduce((sum, lead) => sum + (lead.price_at_purchase || 0), 0);
    
    // Get quota from subscription
    try {
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('leads_per_month')
        .eq('user_id', req.user.id)
        .eq('status', 'active')
        .single();
      
      monthlyQuota = subscription?.leads_per_month || 0;
    } catch (error) {
      console.log('Error getting subscription for quota:', error.message);
      // Try to get from billingData if available
      if (billingData) {
        monthlyQuota = billingData.monthly_quota || 0;
      }
    }

    const stats = {
      totalLeads: leads?.length || 0,
      newLeads: leads?.filter(lead => lead.status === 'new').length || 0,
      acceptedLeads: acceptedLeadsCount,
      rejectedLeads: leads?.filter(lead => lead.status === 'rejected').length || 0,
      monthlyUsage: monthlyUsage,
      monthlyQuota: monthlyQuota,
      monthlyRevenue: monthlyRevenue
    }
    
    console.log('Final stats:', stats);
    console.log('=== END DEBUG ===');

    // Create user object for template
    const userForTemplate = await createUserForTemplate(req);

    // Get user settings (pause status from subscription)
    let isPaused = false;
    try {
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('is_paused')
        .eq('user_id', req.user.id)
        .in('status', ['active', 'paused'])
        .single();
      
      isPaused = subscription?.is_paused ?? false;
    } catch (error) {
      console.log('Error getting pause status:', error.message);
    }

    console.log('🔍 [LEADS] Rendering template with:', {
      leadsCount: leads?.length || 0,
      stats: stats,
      userEmail: userForTemplate?.email
    });

    res.render('dashboard/leads', {
      user: userForTemplate,
      leads: leads || [],
      stats: stats,
      billingData: billingData,
      settings: { lead_limit: monthlyQuota, paused: isPaused },
      error: null
    });
  } catch (err) {
    console.error('Leads error:', err);
    
    // Create fallback user object for error case
    const fallbackUser = await createUserForTemplate(req);

    res.render('dashboard/leads', {
      user: fallbackUser,
      leads: [],
      stats: {
        totalLeads: 0,
        newLeads: 0,
        acceptedLeads: 0,
        rejectedLeads: 0,
        monthlyUsage: 0,
        monthlyQuota: 0,
        monthlyRevenue: 0
      },
      billingData: null,
      settings: { lead_limit: 50, paused: false },
      error: 'Er is een fout opgetreden bij het laden van de leads'
    });
  }
});

// Lead details pagina
router.get('/leads/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const leadId = req.params.id;
    
    console.log('🔍 [LEAD DETAILS] Fetching lead:', { leadId, userId });
    
    // Eerst checken of de lead überhaupt bestaat (zonder toegangscheck)
    const { data: leadExists, error: existsError } = await supabaseAdmin
      .from('leads')
      .select('id, user_id, assigned_to, name')
      .eq('id', leadId)
      .limit(1);
    
    if (existsError) {
      console.error('❌ [LEAD DETAILS] Error checking if lead exists:', existsError);
    } else {
      console.log('🔍 [LEAD DETAILS] Lead exists check:', { 
        exists: leadExists && leadExists.length > 0,
        leadData: leadExists?.[0] 
      });
    }
    
    // Haal lead details op (check both user_id and assigned_to)
    // Use supabaseAdmin to bypass RLS for checking
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .limit(1);

    if (error) {
      console.error('❌ [LEAD DETAILS] Database error:', error);
      return res.status(500).render('errors/500', {
        error: 'Er is een fout opgetreden bij het laden van de lead details'
      });
    }
    
    console.log('🔍 [LEAD DETAILS] Query result:', { 
      leadsFound: leads?.length || 0, 
      leadId,
      userId,
      leadUserId: leads?.[0]?.user_id,
      leadAssignedTo: leads?.[0]?.assigned_to
    });
    
    const lead = leads && leads.length > 0 ? leads[0] : null;
    
    if (!lead) {
      console.log('⚠️ [LEAD DETAILS] Lead does not exist:', { leadId });
      return res.status(404).render('errors/404', {
        message: 'Lead niet gevonden',
        error: 'Lead niet gevonden'
      });
    }
    
    // Check toegang
    const hasAccess = lead.user_id === userId || lead.assigned_to === userId;
    
    if (!hasAccess) {
      console.log('⚠️ [LEAD DETAILS] No access to lead:', { 
        leadId, 
        userId,
        leadUserId: lead.user_id,
        leadAssignedTo: lead.assigned_to
      });
      return res.status(403).render('errors/403', {
        message: 'Geen toegang tot deze lead',
        error: 'Geen toegang tot deze lead'
      });
    }
    
    console.log('✅ [LEAD DETAILS] Lead found:', { leadId, leadName: lead.name });
    
    // Haal industry naam op (als industry_id bestaat)
    let industryName = null;
    if (lead.industry_id) {
      const { data: industry } = await supabaseAdmin
        .from('industries')
        .select('name')
        .eq('id', lead.industry_id)
        .single();
      
      if (industry) {
        industryName = industry.name;
      }
    }
    
    // Haal lead activities op (voor afspraak status)
    let appointmentAttended = null;
    let appointmentNoShow = null;
    try {
      // Check if partner_id column exists, otherwise use created_by
      let activitiesQuery = supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .in('type', ['appointment_attended', 'no_show_customer'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      // Try with partner_id first, fallback to created_by
      let { data: activities, error: activitiesError } = await activitiesQuery.eq('partner_id', userId);
      
      // If partner_id column doesn't exist, try with created_by
      if (activitiesError && (activitiesError.message.includes('partner_id') || activitiesError.code === '42703')) {
        const { data: activitiesRetry, error: activitiesErrorRetry } = await supabase
          .from('lead_activities')
          .select('*')
          .eq('lead_id', leadId)
          .eq('created_by', userId)
          .in('type', ['appointment_attended', 'no_show_customer'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!activitiesErrorRetry) {
          activities = activitiesRetry;
          activitiesError = null;
        }
      }
      
      if (!activitiesError && activities && activities.length > 0) {
        const latest = activities[0];
        if (latest.type === 'appointment_attended') {
          appointmentAttended = latest;
        } else if (latest.type === 'no_show_customer') {
          appointmentNoShow = latest;
        }
      }
    } catch (activityError) {
      console.error('Error fetching activities:', activityError);
    }
    
    // Haal feedback op
    let feedback = null;
    try {
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('lead_feedback')
        .select('*')
        .eq('lead_id', leadId)
        .eq('partner_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!feedbackError && feedbackData && Array.isArray(feedbackData) && feedbackData.length > 0) {
        feedback = feedbackData[0];
      } else {
        feedback = null;
      }
    } catch (feedbackError) {
      // No feedback found is OK - table might not exist yet
      console.log('Feedback table might not exist or no feedback found:', feedbackError?.message);
      feedback = null;
    }
    
    // Create user object for template
    const userForTemplate = await createUserForTemplate(req);
    
    res.render('dashboard/lead-details', {
      user: userForTemplate,
      lead,
      industryName,
      appointmentAttended,
      appointmentNoShow,
      feedback,
      activeMenu: 'leads',
      title: 'Aanvragen',
      error: null
    });
  } catch (err) {
    console.error('Lead details error:', err);
    res.status(500).render('errors/500', {
      error: 'Er is een fout opgetreden bij het laden van de lead details'
    });
  }
});

// Nieuwe route voor het bijwerken van lead status
router.post('/leads/update-status', requireAuth, async (req, res) => {
  try {
    // 1. Input validatie
    const { leadId, status } = req.body;
    const userId = req.user.id;

    // Debug logging
    console.log('Status update request ontvangen:', {
      leadId,
      status,
      userId,
      body: req.body,
      headers: req.headers
    });

    if (!leadId) {
      console.error('Geen lead ID opgegeven');
      return res.status(400).json({
        success: false,
        message: 'Lead ID is verplicht'
      });
    }

    if (!status) {
      console.error('Geen status opgegeven');
      return res.status(400).json({
        success: false,
        message: 'Status is verplicht'
      });
    }

    // 2. Status validatie
    const validStatuses = ['new', 'accepted', 'rejected', 'in_progress'];
    if (!validStatuses.includes(status)) {
      console.error('Ongeldige status:', status);
      return res.status(400).json({
        success: false,
        message: 'Ongeldige status'
      });
    }

    // 3. Lead ophalen
    console.log('Lead ophalen uit database:', leadId);
    const { data: existingLead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError) {
      console.error('Database fout bij ophalen lead:', leadError);
      return res.status(500).json({
        success: false,
        message: 'Fout bij ophalen van de lead',
        error: leadError.message
      });
    }

    if (!existingLead) {
      console.error('Lead niet gevonden:', leadId);
      return res.status(404).json({
        success: false,
        message: 'Lead niet gevonden'
      });
    }

    console.log('Bestaande lead gevonden:', existingLead);

    // 4. Controleer of de gebruiker toegang heeft tot deze lead
    if (existingLead.user_id !== userId) {
      console.error('Geen toegang tot lead:', {
        leadUserId: existingLead.user_id,
        currentUserId: userId
      });
      return res.status(403).json({
        success: false,
        message: 'Geen toegang tot deze lead'
      });
    }

    // 5. Lead updaten
    console.log('Lead status bijwerken:', {
      leadId,
      oldStatus: existingLead.status,
      newStatus: status
    });

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Database fout bij updaten lead:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Fout bij bijwerken van lead status',
        error: updateError.message
      });
    }

    console.log('Lead succesvol bijgewerkt:', updatedLead);

    // 6. Succesvolle response
    return res.json({
      success: true,
      message: 'Status succesvol bijgewerkt',
      data: updatedLead
    });

  } catch (error) {
    console.error('Onverwachte fout bij bijwerken lead status:', error);
    return res.status(500).json({
      success: false,
      message: 'Er is een onverwachte fout opgetreden',
      error: error.message
    });
  }
});

// Helper function to get settings
async function getSettingsForUser(userId) {
  // Use supabaseAdmin to bypass RLS and ensure we get the correct data
  const { data: settings, error } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  let finalSettings = settings;

  if (error) {
    console.error('[SETTINGS] Database fout:', error.message);
    console.error('[SETTINGS] Error details:', error);
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
      login_from_new_device_notification: 1
    };
  } else {
    console.log('[SETTINGS] Raw settings from database:', {
      two_factor_enabled: settings?.two_factor_enabled,
      two_factor_enabled_type: typeof settings?.two_factor_enabled,
      has_two_factor_secret: !!settings?.two_factor_secret
    });
  }

  // Als er geen instellingen zijn, maak standaard instellingen aan
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
      login_from_new_device_notification: 1
    };
    
    const { error: insertError } = await supabaseAdmin
      .from('settings')
      .insert([{
        user_id: userId,
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
      }]);

    if (insertError) {
      console.error('[SETTINGS] Fout bij aanmaken instellingen:', insertError.message);
    }
  }

  // Ensure all required fields exist and convert to proper types
  // Convert two_factor_enabled to integer (0 or 1) for comparison
  // Handle all possible formats: boolean, string, number, null, undefined
  if (finalSettings.two_factor_enabled === true || finalSettings.two_factor_enabled === 'true' || finalSettings.two_factor_enabled === '1' || finalSettings.two_factor_enabled === 1) {
    finalSettings.two_factor_enabled = 1;
  } else {
    finalSettings.two_factor_enabled = 0;
  }
  
  // Log the final converted value
  console.log('[SETTINGS] Final two_factor_enabled value:', finalSettings.two_factor_enabled, typeof finalSettings.two_factor_enabled);
  if (!finalSettings.new_lead_notification) finalSettings.new_lead_notification = 0;
  if (!finalSettings.payment_notification) finalSettings.payment_notification = 0;
  // Account en marketing notifications zijn optioneel (als kolommen niet bestaan, gebruik defaults)
  if (finalSettings.account_notification === undefined || finalSettings.account_notification === null) finalSettings.account_notification = 1;
  if (finalSettings.marketing_notification === undefined || finalSettings.marketing_notification === null) finalSettings.marketing_notification = 0;
  // Nieuwe notificatie instellingen met defaults
  if (finalSettings.quota_warning_notification === undefined || finalSettings.quota_warning_notification === null) finalSettings.quota_warning_notification = 1;
  if (finalSettings.quota_reached_notification === undefined || finalSettings.quota_reached_notification === null) finalSettings.quota_reached_notification = 1;
  if (finalSettings.lead_assigned_notification === undefined || finalSettings.lead_assigned_notification === null) finalSettings.lead_assigned_notification = 1;
  if (finalSettings.lead_status_changed_notification === undefined || finalSettings.lead_status_changed_notification === null) finalSettings.lead_status_changed_notification = 0;
  if (finalSettings.subscription_expiring_notification === undefined || finalSettings.subscription_expiring_notification === null) finalSettings.subscription_expiring_notification = 1;
  if (finalSettings.subscription_expired_notification === undefined || finalSettings.subscription_expired_notification === null) finalSettings.subscription_expired_notification = 1;
  if (finalSettings.login_from_new_device_notification === undefined || finalSettings.login_from_new_device_notification === null) finalSettings.login_from_new_device_notification = 1;
  if (finalSettings.whatsapp_notification_enabled === undefined || finalSettings.whatsapp_notification_enabled === null) finalSettings.whatsapp_notification_enabled = 0;

  return finalSettings;
}

// Content Generator routes
router.get('/tools/content-generator', requireAuth, async (req, res) => {
  try {
    const user = await createUserForTemplate(req);
    
    // Get user's brands
    const { data: brands, error: brandsError } = await supabaseAdmin
      .from('brands')
      .select('*, customers:customer_id(id, name, company_name)')
      .eq('owner_user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
    }
    
    // Get templates
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('content_templates')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
    }
    
    res.render('dashboard/content-generator', {
      layout: 'dashboard',
      title: 'Content generator',
      pageClass: 'content-generator',
      activeMenu: 'tools',
      activeSubmenu: 'content-generator',
      user,
      brands: brands || [],
      templates: templates || []
    });
  } catch (err) {
    console.error('Content generator route error:', err);
    res.status(500).render('error', {
      layout: 'dashboard',
      title: 'Fout',
      error: 'Er is een fout opgetreden bij het laden van de content generator'
    });
  }
});

router.get('/settings', requireAuth, async (req, res) => {
  res.redirect('/dashboard/settings/profile');
});

// Instellingen - Profiel
router.get('/settings/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📄 GET /settings/profile - Loading page for user:', userId);
    
    const finalSettings = await getSettingsForUser(userId);
    const userForTemplate = await createUserForTemplate(req);
    
    console.log('📄 GET /settings/profile - User data loaded:', {
      first_name: userForTemplate.first_name,
      last_name: userForTemplate.last_name,
      company_name: userForTemplate.company_name,
      email: userForTemplate.email,
      postal_code: userForTemplate.postal_code,
      city: userForTemplate.city,
      country: userForTemplate.country,
      phone: userForTemplate.phone,
      address: userForTemplate.address
    });
    console.log('📄 GET /settings/profile - Full user object keys:', Object.keys(userForTemplate));
    
    res.render('dashboard/settings', {
      user: userForTemplate,
      settings: finalSettings,
      activeMenu: 'settings',
      activeTab: 'profile',
      title: 'Instellingen - Profiel',
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
  } catch (err) {
    console.error('❌ Settings error:', err);
    res.status(500).render('errors/500', {
      error: 'Er is een fout opgetreden bij het laden van de instellingen'
    });
  }
});

// Instellingen - Beveiliging
router.get('/settings/security', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const finalSettings = await getSettingsForUser(userId);
    const userForTemplate = await createUserForTemplate(req);
    
    // Fetch login history for this user (last 50 entries)
    const { data: loginHistory, error: loginHistoryError } = await supabaseAdmin
      .from('login_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (loginHistoryError) {
      console.error('Error fetching login history:', loginHistoryError);
    }

    // Debug: Log settings to see what we're passing to template
    console.log('[SETTINGS] Rendering security page with settings:', {
      two_factor_enabled: finalSettings.two_factor_enabled,
      two_factor_enabled_type: typeof finalSettings.two_factor_enabled,
      two_factor_secret: finalSettings.two_factor_secret ? '***' : null,
      loginHistoryCount: loginHistory?.length || 0
    });
    
    res.render('dashboard/settings', {
      user: userForTemplate,
      settings: finalSettings,
      loginHistory: loginHistory || [],
      activeMenu: 'settings',
      activeTab: 'security',
      title: 'Instellingen - Beveiliging',
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).render('errors/500', {
      error: 'Er is een fout opgetreden bij het laden van de instellingen'
    });
  }
});

// Instellingen - Betalingen
router.get('/settings/payment', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📄 GET /settings/payment - Loading page for user:', userId);
    
    const finalSettings = await getSettingsForUser(userId);
    const userForTemplate = await createUserForTemplate(req);
    
    // Haal betalingen op met paginatie (10 per pagina)
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    
    // Haal totale aantal betalingen op
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (countError) {
      console.error('❌ Error counting payments:', countError);
    }
    
    // Haal betalingen op met paginatie
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('id, user_id, amount, status, created_at, payment_details')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (paymentsError) {
      console.error('❌ Error fetching payments:', paymentsError);
    }
    
    const totalPages = Math.ceil((totalCount || 0) / limit);
    
    console.log('📄 GET /settings/payment - Billing data loaded:', {
      billing_company_name: userForTemplate.billing_company_name,
      billing_address: userForTemplate.billing_address,
      billing_postal_code: userForTemplate.billing_postal_code,
      billing_city: userForTemplate.billing_city,
      billing_country: userForTemplate.billing_country,
      vat_number: userForTemplate.vat_number,
      coc_number: userForTemplate.coc_number
    });
    
    res.render('dashboard/settings', {
      user: userForTemplate,
      settings: finalSettings,
      payments: payments || [],
      paymentsPage: page,
      paymentsTotalPages: totalPages,
      paymentsTotalCount: totalCount || 0,
      activeMenu: 'settings',
      activeTab: 'payment',
      title: 'Instellingen - Betalingen',
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
  } catch (err) {
    console.error('❌ Settings error:', err);
    res.status(500).render('errors/500', {
      error: 'Er is een fout opgetreden bij het laden van de instellingen'
    });
  }
});

// Instellingen - Notificaties
router.get('/settings/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const finalSettings = await getSettingsForUser(userId);
    const userForTemplate = await createUserForTemplate(req);
    
    res.render('dashboard/settings', {
      user: userForTemplate,
      settings: finalSettings,
      activeMenu: 'settings',
      activeTab: 'notifications',
      title: 'Instellingen - Notificaties',
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).render('errors/500', {
      error: 'Er is een fout opgetreden bij het laden van de instellingen'
    });
  }
});

// Notificatie-instellingen bijwerken
router.post('/settings/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      newLeadNotification, 
      leadAssignedNotification,
      quotaWarningNotification,
      quotaReachedNotification,
      subscriptionExpiringNotification,
      loginFromNewDeviceNotification,
      whatsappNotification,
      marketingNotification 
    } = req.body;
    
    const isJsonRequest = req.headers['content-type']?.includes('application/json');
    
    // Betalingen en account updates zijn altijd aan (verplicht)
    const updateData = {
      new_lead_notification: newLeadNotification ? 1 : 0,
      lead_assigned_notification: leadAssignedNotification !== undefined ? (leadAssignedNotification ? 1 : 0) : 1,
      quota_warning_notification: quotaWarningNotification !== undefined ? (quotaWarningNotification ? 1 : 0) : 1,
      quota_reached_notification: quotaReachedNotification !== undefined ? (quotaReachedNotification ? 1 : 0) : 1,
      subscription_expiring_notification: subscriptionExpiringNotification !== undefined ? (subscriptionExpiringNotification ? 1 : 0) : 1,
      login_from_new_device_notification: loginFromNewDeviceNotification !== undefined ? (loginFromNewDeviceNotification ? 1 : 0) : 1,
      whatsapp_notification_enabled: whatsappNotification !== undefined ? (whatsappNotification ? 1 : 0) : 0,
      payment_notification: 1, // Altijd aan
      account_notification: 1, // Altijd aan
      marketing_notification: marketingNotification ? 1 : 0,
      notifications_enabled: 1 // Altijd aan voor kritieke notificaties
    };
    
    const { data: existingSettings } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (existingSettings) {
      // Update bestaande instellingen
      const { error } = await supabaseAdmin
        .from('settings')
        .update(updateData)
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error updating notification settings:', error);
        if (isJsonRequest) {
          return res.status(500).json({ success: false, message: 'Er is een fout opgetreden' });
        }
        req.flash('error', 'Er is een fout opgetreden bij het opslaan van de instellingen');
        return res.redirect('/dashboard/settings/notifications');
      }
    } else {
      // Maak nieuwe instellingen aan
      const { error } = await supabaseAdmin
        .from('settings')
        .insert([{
          user_id: userId,
          ...updateData
        }]);
      
      if (error) {
        console.error('Error creating notification settings:', error);
        if (isJsonRequest) {
          return res.status(500).json({ success: false, message: 'Er is een fout opgetreden' });
        }
        req.flash('error', 'Er is een fout opgetreden bij het opslaan van de instellingen');
        return res.redirect('/dashboard/settings/notifications');
      }
    }
    
    if (isJsonRequest) {
      return res.json({ success: true, message: 'Notificatie-instellingen bijgewerkt' });
    }
    
    req.flash('success', 'Notificatie-instellingen bijgewerkt');
    res.redirect('/dashboard/settings/notifications');
  } catch (err) {
    console.error('Notification settings update error:', err);
    const isJsonRequest = req.headers['content-type']?.includes('application/json');
    if (isJsonRequest) {
      return res.status(500).json({ success: false, message: 'Er is een fout opgetreden' });
    }
    req.flash('error', 'Er is een fout opgetreden bij het opslaan van de instellingen');
    res.redirect('/dashboard/settings/notifications');
  }
});

router.post('/settings/test-notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const NotificationService = require('../services/notificationService');
    const notificationService = new NotificationService();
    
    // Log user info for debugging
    console.log('🧪 Testing notifications for user:', userId);
    
    // Haal de huidige instellingen op
    const settings = await getSettingsForUser(userId);
    
    // Check user profile email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, last_name, company_name')
      .eq('id', userId)
      .maybeSingle();
    
    if (profile && profile.email) {
      console.log(`📧 User email address: ${profile.email}`);
    } else {
      console.error(`❌ No email found in profile for user ${userId}`);
    }
    
    // TEST MODE: Gebruik een test email adres als je naar een ander domain wilt testen
    // Haal het test email adres uit query parameter of environment variable
    const testEmail = req.query.test_email || process.env.TEST_EMAIL || null;
    const recipientEmail = testEmail || (profile && profile.email);
    
    if (!recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geen email adres gevonden. Voeg ?test_email=jouw@email.nl toe aan de URL om te testen met een ander adres.' 
      });
    }
    
    console.log(`📧 Sending test emails to: ${recipientEmail}${testEmail ? ' (TEST MODE)' : ''}`);
    // Add a short unique suffix to subjects to avoid Gmail threading collapsing identical tests
    const testSuffix = `(test ${new Date().toLocaleTimeString('nl-NL')})`;
    
    const sentNotifications = [];
    let sentCount = 0;
    
    // Test new lead notification (use lead_assigned template for now)
    if (settings.new_lead_notification === 1 || settings.new_lead_notification === undefined) {
      const result = await notificationService.sendNotification(userId, 'lead_assigned', {
        company_name: 'Test Bedrijf B.V.',
        contact_name: 'Jan Janssen',
        email: 'jan@testbedrijf.nl',
        phone: '+31 6 12345678',
        industry: 'IT & Software',
        lead_id: 'test-lead-id',
        lead_url: `${process.env.DASHBOARD_URL || 'http://localhost:3000/dashboard'}/leads/test-lead-id`
      }, { force: true, overrideEmail: recipientEmail, subjectSuffix: testSuffix });
      if (result) {
        sentNotifications.push('Nieuwe lead');
        sentCount++;
      } else {
        console.error('❌ Failed to send new lead notification');
      }
    } else {
      console.log('⏭️  Skipping new lead notification (disabled in settings)');
    }
    
    // Test quota warning notification
    if (settings.quota_warning_notification === 1 || settings.quota_warning_notification === undefined) {
      const result = await notificationService.sendNotification(userId, 'quota_warning', {
        leads_used: 8,
        monthly_quota: 10,
        leads_remaining: 2,
        usage_percentage: 80,
        quota_reset_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
      }, { force: true, overrideEmail: recipientEmail, subjectSuffix: testSuffix });
      if (result) {
        sentNotifications.push('Quota waarschuwing');
        sentCount++;
      } else {
        console.error('❌ Failed to send quota warning notification');
      }
    } else {
      console.log('⏭️  Skipping quota warning notification (disabled in settings)');
    }
    
    // Test quota reached notification
    if (settings.quota_reached_notification === 1 || settings.quota_reached_notification === undefined) {
      const result = await notificationService.sendNotification(userId, 'quota_reached', {
        leads_used: 10,
        monthly_quota: 10,
        quota_reset_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
      }, { force: true, overrideEmail: recipientEmail, subjectSuffix: testSuffix });
      if (result) {
        sentNotifications.push('Quota bereikt');
        sentCount++;
      } else {
        console.error('❌ Failed to send quota reached notification');
      }
    } else {
      console.log('⏭️  Skipping quota reached notification (disabled in settings)');
    }
    
    // Test lead assigned notification
    if (settings.lead_assigned_notification === 1 || settings.lead_assigned_notification === undefined) {
      const result = await notificationService.sendNotification(userId, 'lead_assigned', {
        company_name: 'Test Bedrijf B.V.',
        contact_name: 'Jan Janssen',
        email: 'jan@testbedrijf.nl',
        phone: '+31 6 12345678',
        industry: 'IT & Software',
        lead_id: 'test-lead-id-2',
        lead_url: `${process.env.DASHBOARD_URL || 'http://localhost:3000/dashboard'}/leads/test-lead-id-2`
      }, { force: true, overrideEmail: recipientEmail, subjectSuffix: testSuffix });
      if (result) {
        sentNotifications.push('Lead toegewezen');
        sentCount++;
      } else {
        console.error('❌ Failed to send lead assigned notification');
      }
    } else {
      console.log('⏭️  Skipping lead assigned notification (disabled in settings)');
    }
    
    // Test subscription expiring notification
    if (settings.subscription_expiring_notification === 1 || settings.subscription_expiring_notification === undefined) {
      const result = await notificationService.sendNotification(userId, 'subscription_expiring', {
        name: 'Pro Plan',
        expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL'),
        days_remaining: 7
      }, { force: true, overrideEmail: recipientEmail, subjectSuffix: testSuffix });
      if (result) {
        sentNotifications.push('Abonnement loopt af');
        sentCount++;
      } else {
        console.error('❌ Failed to send subscription expiring notification');
      }
    } else {
      console.log('⏭️  Skipping subscription expiring notification (disabled in settings)');
    }
    
    // Test subscription expired notification
    if (settings.subscription_expired_notification === 1 || settings.subscription_expired_notification === undefined) {
      const result = await notificationService.sendNotification(userId, 'subscription_expired', {
        name: 'Pro Plan',
        expiry_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL')
      }, { force: true, overrideEmail: recipientEmail, subjectSuffix: testSuffix });
      if (result) {
        sentNotifications.push('Abonnement verlopen');
        sentCount++;
      } else {
        console.error('❌ Failed to send subscription expired notification');
      }
    } else {
      console.log('⏭️  Skipping subscription expired notification (disabled in settings)');
    }
    
    // Test login from new device notification
    if (settings.login_from_new_device_notification === 1 || settings.login_from_new_device_notification === undefined) {
      const result = await notificationService.sendNotification(userId, 'login_from_new_device', {
        login_time: new Date().toLocaleString('nl-NL'),
        location: 'Amsterdam, Nederland',
        device: 'MacBook Pro',
        browser: 'Chrome'
      }, { force: true, overrideEmail: recipientEmail, subjectSuffix: testSuffix });
      if (result) {
        sentNotifications.push('Nieuw apparaat');
        sentCount++;
      } else {
        console.error('❌ Failed to send login from new device notification');
      }
    } else {
      console.log('⏭️  Skipping login from new device notification (disabled in settings)');
    }
    
    console.log(`📊 Test result: ${sentCount} notifications sent successfully`);
    console.log(`📋 Sent notifications (${sentNotifications.length}): ${sentNotifications.join(', ')}`);
    
    // Calculate expected vs actual
    const expectedNotifications = [
      settings.new_lead_notification === 1 || settings.new_lead_notification === undefined ? 'Nieuwe lead' : null,
      settings.quota_warning_notification === 1 || settings.quota_warning_notification === undefined ? 'Quota waarschuwing' : null,
      settings.quota_reached_notification === 1 || settings.quota_reached_notification === undefined ? 'Quota bereikt' : null,
      settings.lead_assigned_notification === 1 || settings.lead_assigned_notification === undefined ? 'Lead toegewezen' : null,
      settings.subscription_expiring_notification === 1 || settings.subscription_expiring_notification === undefined ? 'Abonnement loopt af' : null,
      settings.subscription_expired_notification === 1 || settings.subscription_expired_notification === undefined ? 'Abonnement verlopen' : null,
      settings.login_from_new_device_notification === 1 || settings.login_from_new_device_notification === undefined ? 'Nieuw apparaat' : null
    ].filter(Boolean);
    
    console.log(`📊 Expected notifications (${expectedNotifications.length}): ${expectedNotifications.join(', ')}`);
    
    if (sentCount < expectedNotifications.length) {
      console.warn(`⚠️  Not all notifications were sent! Expected ${expectedNotifications.length}, got ${sentCount}`);
    }
    
    return res.json({ 
      success: true, 
      sent: sentCount,
      notifications: sentNotifications,
      recipientEmail: recipientEmail,
      message: `${sentCount} notificatie(s) verzonden naar ${recipientEmail}: ${sentNotifications.join(', ')}`
    });
  } catch (err) {
    console.error('Test notifications error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Er is een fout opgetreden bij het verzenden van test notificaties',
      error: err.message 
    });
  }
});

// WhatsApp test bericht verzenden
router.post('/settings/test-whatsapp', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const WhatsAppService = require('../services/whatsappService');
    const whatsappService = new WhatsAppService();
    
    console.log('📱 Testing WhatsApp for user:', userId);
    
    // Check of WhatsApp service is geconfigureerd
    if (!whatsappService.enabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'WhatsApp service is niet geconfigureerd. Controleer je environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM).' 
      });
    }
    
    // Haal user profiel op voor telefoonnummer
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('phone, first_name, last_name, company_name')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileError) {
      console.error('❌ Profile error:', profileError);
      return res.status(500).json({ 
        success: false, 
        message: 'Fout bij ophalen profielgegevens' 
      });
    }
    
    if (!profile || !profile.phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geen telefoonnummer gevonden in je profiel. Voeg eerst je telefoonnummer toe in je profielinstellingen.' 
      });
    }
    
    console.log(`📱 Sending test WhatsApp to: ${profile.phone}`);
    
    // Verstuur test bericht - gebruik Content Template als beschikbaar
    const contentSid = process.env.TWILIO_CONTENT_SID;
    
    let result;
    if (contentSid) {
      // Gebruik Content Template voor test
      console.log(`📱 Using Content Template: ${contentSid}`);
      result = await whatsappService.sendMessage(profile.phone, '', {
        contentSid: contentSid,
        contentVariables: {
          company_name: 'Test Bedrijf B.V.',
          contact_name: 'Jan Janssen',
          email: 'jan@testbedrijf.nl',
          dashboard_url: `${process.env.DASHBOARD_URL || 'http://localhost:3000/dashboard'}/leads/test-lead-id`
        }
      });
    } else {
      // Fallback naar vrije tekst (werkt alleen in sandbox of user-initiated)
      const testMessage = `🧪 Test bericht van GrowSocial

Dit is een test WhatsApp bericht om te controleren of alles werkt.

Test gegevens:
- Bedrijf: Test Bedrijf B.V.
- Naam: Jan Janssen
- E-mail: jan@testbedrijf.nl

Als je dit bericht ontvangt, werkt WhatsApp notificaties correct! ✅`;
      
      result = await whatsappService.sendMessage(profile.phone, testMessage);
    }
    
    if (result) {
      console.log('✅ Test WhatsApp message sent successfully');
      return res.json({ 
        success: true, 
        message: `Test bericht verzonden naar ${profile.phone}. Check je WhatsApp!`,
        phone: profile.phone
      });
    } else {
      console.error('❌ Failed to send test WhatsApp message');
      return res.status(500).json({ 
        success: false, 
        message: 'Fout bij verzenden WhatsApp bericht. Check de server logs voor details. Mogelijk moet je eerst een Content Template goedkeuren in Twilio.' 
      });
    }
  } catch (err) {
    console.error('Test WhatsApp error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Er is een fout opgetreden bij het verzenden van het test WhatsApp bericht',
      error: err.message 
    });
  }
});

// Profiel bijwerken (ondersteunt zowel form als JSON)
router.post('/settings/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, companyName, phone, email, address, postalCode, city, country } = req.body;

    // Check if request is JSON (AJAX)
    const isJsonRequest = req.headers['content-type']?.includes('application/json');

    console.log('Profile update request:', { userId, isJsonRequest, body: req.body });

  // Validatie
  if (!companyName || !email) {
    if (isJsonRequest) {
      return res.status(400).json({ success: false, message: 'Vul alle verplichte velden in' });
    }
    if (req.flash) {
      req.flash('error', 'Vul alle verplichte velden in');
    }
    return res.redirect('/dashboard/settings/profile');
  }

    // Update gebruiker
    // Note: Database uses 'street' column for address, not 'address'
    // Email might need to be updated in auth.users separately, but we'll try profiles first
    const updateData = {
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: companyName,
      phone: phone || null,
      street: address || null, // Use 'street' column in database
      postal_code: postalCode || null,
      city: city || null,
      country: country || null
    };
    
    console.log('📝 Updating profile - Full updateData:', updateData);
    
    // Only update email in profiles if it's different from current
    // Check current profile email first
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    
    if (email && email !== currentProfile?.email) {
      updateData.email = email;
      console.log('Email will be updated from', currentProfile?.email, 'to', email);
    }

    console.log('Updating profile with data:', updateData);
    console.log('User ID:', userId);

    // Get old profile data BEFORE update for risk re-evaluation
    const { data: oldProfile } = await supabaseAdmin
      .from('profiles')
      .select('company_name, coc_number, vat_number, email, street, postal_code, city, country, phone')
      .eq('id', userId)
      .single();

    const { error, data } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('❌ Database fout bij profile update:', error.message);
      console.error('Error details:', error);
      console.error('Error code:', error.code);
      if (isJsonRequest) {
        return res.status(500).json({ success: false, message: 'Er is een fout opgetreden bij het opslaan', error: error.message });
      }
      if (req.flash) {
        req.flash('error', 'Er is een fout opgetreden');
      }
      return res.redirect('/dashboard/settings/profile');
    }

    console.log('✅ Profile updated successfully. Returned data:', JSON.stringify(data, null, 2));
    
    // Verify the update was successful by fetching the profile again
    if (data && data.length > 0) {
      console.log('✅ Verified updated profile:', {
        first_name: data[0].first_name,
        last_name: data[0].last_name,
        company_name: data[0].company_name,
        email: data[0].email,
        phone: data[0].phone,
        street: data[0].street,
        postal_code: data[0].postal_code,
        city: data[0].city,
        country: data[0].country
      });

      // Re-evaluate risk if relevant fields changed (async, don't block response)
      if (oldProfile && UserRiskAssessmentService.shouldReevaluate(oldProfile, data[0])) {
        console.log(`🔄 Relevant profile fields changed, re-evaluating risk for user ${userId}`);
        UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, data[0])
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
    } else {
      console.error('⚠️ Update returned no data!');
    }

    // Update session user data with the actual updated data from database
    if (data && data.length > 0) {
      const updatedProfile = data[0];
      req.user = {
        ...req.user,
        first_name: updatedProfile.first_name || null,
        last_name: updatedProfile.last_name || null,
        company_name: updatedProfile.company_name || '',
        phone: updatedProfile.phone || null,
        email: updatedProfile.email || email,
        street: updatedProfile.street || null,
        address: updatedProfile.street || null, // Also set 'address' for compatibility
        postal_code: updatedProfile.postal_code || null,
        city: updatedProfile.city || null,
        country: updatedProfile.country || null
      };
      console.log('✅ Session updated with:', {
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        company_name: req.user.company_name,
        email: req.user.email,
        street: req.user.street,
        address: req.user.address,
        postal_code: req.user.postal_code,
        city: req.user.city,
        country: req.user.country
      });
    } else {
      // Fallback to request data if database didn't return data
      req.user = {
        ...req.user,
        first_name: firstName || null,
        last_name: lastName || null,
        company_name: companyName,
        phone: phone || null,
        email: email,
        street: address || null,
        address: address || null,
        postal_code: postalCode || null,
        city: city || null,
        country: country || null
      };
      console.warn('⚠️ Database did not return updated data, using request data for session');
    }

    if (isJsonRequest) {
      return res.json({ success: true, message: 'Profiel bijgewerkt', data: data && data.length > 0 ? data[0] : null });
    }

    if (req.flash) {
      req.flash('success', 'Profiel bijgewerkt');
    }
    res.redirect('/dashboard/settings');
  } catch (err) {
    console.error('Profile update error:', err);
    console.error('Error stack:', err.stack);
    if (isJsonRequest) {
      return res.status(500).json({ 
        success: false, 
        message: 'Er is een fout opgetreden',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    if (req.flash) {
      req.flash('error', 'Er is een fout opgetreden');
    }
    res.redirect('/dashboard/settings');
  }
});

// Factuurgegevens bijwerken (ondersteunt zowel form als JSON)
router.post('/settings/billing', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      billingCompanyName, 
      billingAddress, 
      billingPostalCode, 
      billingCity, 
      billingCountry, 
      vatNumber, 
      chamberOfCommerce 
    } = req.body;

    const isJsonRequest = req.headers['content-type']?.includes('application/json');

    console.log('Billing update request:', { userId, isJsonRequest, body: req.body });

    // Validatie - Bedrijfsnaam is verplicht
    if (!billingCompanyName) {
      if (isJsonRequest) {
        return res.status(400).json({ success: false, message: 'Bedrijfsnaam is verplicht' });
      }
      if (req.flash) {
        req.flash('error', 'Bedrijfsnaam is verplicht');
      }
      return res.redirect('/dashboard/settings/payment');
    }

    // Prepare update data
    const updateData = {
      billing_company_name: billingCompanyName || null,
      billing_address: billingAddress || null,
      billing_postal_code: billingPostalCode || null,
      billing_city: billingCity || null,
      billing_country: billingCountry || 'NL',
      vat_number: vatNumber || null,
      coc_number: chamberOfCommerce || null
      // Note: Only update coc_number, not chamber_of_commerce (they should be the same)
      // If your database has both columns, add: chamber_of_commerce: chamberOfCommerce || null
    };

    console.log('Updating billing info with data:', updateData);
    console.log('Chamber of Commerce value:', chamberOfCommerce);

    const { error, data } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('❌ Database fout bij billing update:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('UpdateData that caused error:', updateData);
      
      if (isJsonRequest) {
        return res.status(500).json({ 
          success: false, 
          message: 'Er is een fout opgetreden bij het opslaan', 
          error: error.message,
          errorCode: error.code,
          errorDetails: process.env.NODE_ENV === 'development' ? error : undefined
        });
      }
      if (req.flash) {
        req.flash('error', 'Er is een fout opgetreden');
      }
      return res.redirect('/dashboard/settings/payment');
    }

    console.log('✅ Billing info updated successfully. Returned data:', JSON.stringify(data, null, 2));
    
    // Verify the update was successful
    if (data && data.length > 0) {
      console.log('✅ Verified updated billing info:', {
        billing_company_name: data[0].billing_company_name,
        billing_address: data[0].billing_address,
        billing_postal_code: data[0].billing_postal_code,
        billing_city: data[0].billing_city,
        billing_country: data[0].billing_country,
        vat_number: data[0].vat_number,
        coc_number: data[0].coc_number
      });
    } else {
      console.error('⚠️ Billing update returned no data!');
    }

    if (isJsonRequest) {
      return res.json({ 
        success: true, 
        message: 'Gegevens bijgewerkt',
        data: data && data.length > 0 ? data[0] : null
      });
    }

    if (req.flash) {
      req.flash('success', 'Factuurgegevens bijgewerkt');
    }
    res.redirect('/dashboard/settings/payment');
  } catch (err) {
    console.error('Billing update error:', err);
    console.error('Error stack:', err.stack);
    const isJsonRequest = req.headers['content-type']?.includes('application/json');
    if (isJsonRequest) {
      return res.status(500).json({ 
        success: false, 
        message: 'Er is een fout opgetreden',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    if (req.flash) {
      req.flash('error', 'Er is een fout opgetreden');
    }
    res.redirect('/dashboard/settings/payment');
  }
});

// Instellingen bijwerken
router.post('/settings/preferences', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { leadLimit, notificationsEnabled, paused } = req.body;

  // Controleer of instellingen bestaan
  supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .then(({ data: settings, error }) => {
      if (error) {
        console.error('Database fout:', error.message);
        req.flash('error', 'Er is een fout opgetreden');
        return res.redirect('/dashboard/settings/profile');
      }

      if (settings) {
        // Update bestaande instellingen
        supabase
          .from('settings')
          .update({
            lead_limit: leadLimit || 10,
            notifications_enabled: notificationsEnabled ? 1 : 0,
            paused: paused ? 1 : 0
          })
          .eq('user_id', userId)
          .then(({ error: updateError }) => {
            if (updateError) {
              console.error('Database fout:', updateError.message);
              req.flash('error', 'Er is een fout opgetreden');
              return res.redirect('/dashboard/settings/profile');
            }

            req.flash('success', 'Instellingen bijgewerkt');
            res.redirect('/dashboard/settings');
          });
      } else {
        // Maak nieuwe instellingen aan
        supabase
          .from('settings')
          .insert([{
            user_id: userId,
            lead_limit: leadLimit || 10,
            notifications_enabled: notificationsEnabled ? 1 : 0,
            paused: paused ? 1 : 0
          }])
          .then(({ error: insertError }) => {
            if (insertError) {
              console.error('Database fout:', insertError.message);
              req.flash('error', 'Er is een fout opgetreden');
              return res.redirect('/dashboard/settings/profile');
            }

            req.flash('success', 'Instellingen bijgewerkt');
            res.redirect('/dashboard/settings');
          });
      }
    });
});

// Wachtwoord wijzigen
router.post('/settings/password', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Check if this is a JSON request (AJAX)
    const isJsonRequest = req.headers['content-type']?.includes('application/json');

    // Validatie
    if (!currentPassword || !newPassword || !confirmPassword) {
      if (isJsonRequest) {
        return res.status(400).json({ success: false, message: 'Vul alle wachtwoordvelden in' });
      }
      if (req.flash) {
        req.flash('error', 'Vul alle wachtwoordvelden in');
      }
      return res.redirect('/dashboard/settings/security');
    }

    if (newPassword !== confirmPassword) {
      if (isJsonRequest) {
        return res.status(400).json({ success: false, message: 'Nieuwe wachtwoorden komen niet overeen' });
      }
      if (req.flash) {
        req.flash('error', 'Nieuwe wachtwoorden komen niet overeen');
      }
      return res.redirect('/dashboard/settings/security');
    }

    // Haal huidige gebruiker op
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('password')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Database fout:', userError?.message);
      if (isJsonRequest) {
        return res.status(500).json({ success: false, message: 'Er is een fout opgetreden bij het ophalen van gebruikersgegevens' });
      }
      if (req.flash) {
        req.flash('error', 'Er is een fout opgetreden');
      }
      return res.redirect('/dashboard/settings/security');
    }

    if (!user.password) {
      if (isJsonRequest) {
        return res.status(400).json({ success: false, message: 'Geen wachtwoord gevonden voor deze gebruiker' });
      }
      if (req.flash) {
        req.flash('error', 'Geen wachtwoord gevonden voor deze gebruiker');
      }
      return res.redirect('/dashboard/settings/security');
    }

    // Controleer huidige wachtwoord
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      if (isJsonRequest) {
        return res.status(400).json({ success: false, message: 'Huidig wachtwoord is onjuist' });
      }
      if (req.flash) {
        req.flash('error', 'Huidig wachtwoord is onjuist');
      }
      return res.redirect('/dashboard/settings/security');
    }

    // Hash nieuw wachtwoord
    const hash = await bcrypt.hash(newPassword, 10);

    // Update wachtwoord
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ password: hash })
      .eq('id', userId);

    if (updateError) {
      console.error('Database fout:', updateError.message);
      if (isJsonRequest) {
        return res.status(500).json({ success: false, message: 'Er is een fout opgetreden bij het bijwerken van het wachtwoord' });
      }
      if (req.flash) {
        req.flash('error', 'Er is een fout opgetreden');
      }
      return res.redirect('/dashboard/settings/security');
    }

    if (isJsonRequest) {
      return res.json({ success: true, message: 'Wachtwoord bijgewerkt' });
    }
    if (req.flash) {
      req.flash('success', 'Wachtwoord bijgewerkt');
    }
    res.redirect('/dashboard/settings/security');
  } catch (err) {
    console.error('Error updating password:', err);
    const isJsonRequest = req.headers['content-type']?.includes('application/json');
    if (isJsonRequest) {
      return res.status(500).json({ success: false, message: 'Er is een fout opgetreden' });
    }
    if (req.flash) {
      req.flash('error', 'Er is een fout opgetreden');
    }
    res.redirect('/dashboard/settings/security');
  }
});

// Betaalmethode toevoegen
router.post('/settings/payment-method', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { paymentMethod } = req.body;
  
  // Validatie
  if (!paymentMethod) {
    req.flash('error', 'Selecteer een betaalmethode');
    return res.redirect('/dashboard/settings/payment');
  }
  
  // In een echte applicatie zou je hier een betalingsprovider integreren
  // Voor nu simuleren we het toevoegen van een betaalmethode
  const { error } = await supabase
    .from('profiles')
    .update({ payment_method: paymentMethod })
    .eq('id', userId);
  
  if (error) {
    console.error('Fout bij bijwerken betaalmethode:', error.message);
    req.flash('error', 'Er is een fout opgetreden bij het bijwerken van je betaalmethode');
    return res.redirect('/dashboard/settings/payment');
  }
  
  // Update sessie
  req.user.payment_method = paymentMethod;
  
  // Log activity for admin tracking
  try {
    const requestInfo = ActivityService.getRequestInfo(req);
    await ActivityService.logActivity({
      userId: userId,
      type: 'payment_method_added',
      severity: 'medium',
      title: 'Betaalmethode toegevoegd',
      description: `Gebruiker heeft een betaalmethode toegevoegd: ${paymentMethod}`,
      metadata: {
        payment_method_type: paymentMethod
      },
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent
    });
  } catch (logError) {
    console.error('Error logging payment method addition:', logError);
    // Don't throw error, payment method was saved successfully
  }
  
  req.flash('success', 'Betaalmethode succesvol toegevoegd');
  res.redirect('/dashboard/settings/payment');
});

// Betaalmethode verwijderen
router.post('/settings/payment-method/remove', requireAuth, (req, res) => {
  const userId = req.user.id;
  
  supabase
    .from('profiles')
    .update({ payment_method: null })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) {
        console.error('Fout bij verwijderen betaalmethode:', error.message);
        req.flash('error', 'Er is een fout opgetreden bij het verwijderen van je betaalmethode');
        return res.redirect('/dashboard/settings/payment');
      }
      
      // Update sessie
      req.user.payment_method = null;
      
      req.flash('success', 'Betaalmethode succesvol verwijderd');
      res.redirect('/dashboard/settings/payment');
    });
});

// 2FA: Generate secret and QR code
router.get('/settings/two-factor/secret', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[2FA] Generating secret for user:', userId);

    // Generate a secret
    const secret = speakeasy.generateSecret({
      name: `GrowSocial (${req.user.email || req.user.id})`,
      issuer: 'GrowSocial',
      length: 32
    });

    console.log('[2FA] Secret generated, generating QR code...');

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    console.log('[2FA] QR code generated, length:', qrCodeUrl.length);

    // Store secret temporarily (will be verified and saved later)
    // For now, we'll return it and the client will send it back with verification
    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    });
  } catch (err) {
    console.error('[2FA] Error generating 2FA secret:', err);
    console.error('[2FA] Error stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Fout bij genereren 2FA secret',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 2FA: Verify code and enable 2FA
router.post('/settings/two-factor/verify', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { verificationCode, secret } = req.body;

    if (!verificationCode || !secret) {
      return res.status(400).json({ success: false, message: 'Verificatiecode en secret zijn verplicht' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: verificationCode,
      window: 2 // Allow 2 time steps before/after
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Ongeldige verificatiecode' });
    }

    // Check if settings record exists
    const { data: existingSettings } = await supabaseAdmin
      .from('settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    let updateResult;
    
    if (existingSettings) {
      // Update existing settings
      updateResult = await supabaseAdmin
        .from('settings')
        .update({
          two_factor_enabled: 1,
          two_factor_secret: secret,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      // Create new settings record with 2FA enabled
      updateResult = await supabaseAdmin
        .from('settings')
        .insert({
          user_id: userId,
          lead_limit: 10,
          notifications_enabled: 1,
          paused: 0,
          two_factor_enabled: 1,
          two_factor_secret: secret,
          new_lead_notification: 1,
          payment_notification: 1
        });
    }

    if (updateResult.error) {
      console.error('[2FA] Error updating 2FA settings:', updateResult.error);
      console.error('[2FA] Update result:', updateResult);
      return res.status(500).json({ 
        success: false, 
        message: 'Fout bij opslaan 2FA instellingen',
        error: process.env.NODE_ENV === 'development' ? updateResult.error.message : undefined
      });
    }

    console.log('[2FA] Successfully updated 2FA settings for user:', userId);
    res.json({ success: true, message: 'Twee-factor authenticatie succesvol ingeschakeld' });
  } catch (err) {
    console.error('Error verifying 2FA:', err);
    res.status(500).json({ success: false, message: 'Fout bij verifiëren 2FA' });
  }
});

// 2FA: Disable 2FA
router.post('/settings/two-factor/disable', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body; // Require password for security

    const isJsonRequest = req.headers['content-type']?.includes('application/json');

    if (!password) {
      console.error('[2FA] No password provided');
      if (isJsonRequest) {
        return res.status(400).json({ success: false, message: 'Wachtwoord is verplicht om 2FA uit te schakelen' });
      }
      if (req.flash) {
        req.flash('error', 'Wachtwoord is verplicht om 2FA uit te schakelen');
      }
      return res.redirect('/dashboard/settings/security');
    }

    console.log('[2FA] Starting disable process for user:', userId);

    // Verify password using Supabase Auth
    // First, get the user's email from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.email) {
      console.error('[2FA] Error fetching profile:', profileError);
      if (isJsonRequest) {
        return res.status(500).json({ success: false, message: 'Fout bij ophalen profiel' });
      }
      if (req.flash) {
        req.flash('error', 'Fout bij ophalen profiel');
      }
      return res.redirect('/dashboard/settings/security');
    }

    console.log('[2FA] Profile email found:', profile.email);

    // Verify password using Supabase Admin API - this won't create a session
    // The admin API can verify passwords without logging the user in
    try {
      console.log('[2FA] Attempting password verification via admin API...');
      
      // Use admin API to verify password by attempting to get user with password
      // We'll create a temporary user session that we immediately destroy
      const { createClient } = require('@supabase/supabase-js');
      
      // Create a completely isolated client with memory-only storage
      const isolatedStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
      };
      
      const tempSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            storage: isolatedStorage,
            detectSessionInUrl: false,
            flowType: 'pkce'
          },
          global: {
            headers: {},
            fetch: (url, options = {}) => {
              // Prevent setting cookies by intercepting fetch
              const modifiedOptions = {
                ...options,
                credentials: 'omit', // Don't send or receive cookies
                headers: {
                  ...options.headers,
                  'Cookie': '' // Explicitly don't send cookies
                }
              };
              return fetch(url, modifiedOptions);
            }
          }
        }
      );

      // Verify password by attempting sign in
      const { data: authData, error: authError } = await tempSupabase.auth.signInWithPassword({
        email: profile.email,
        password: password
      });

      if (authError || !authData?.user) {
        console.error('[2FA] Password verification failed:', authError?.message);
        if (isJsonRequest) {
          return res.status(400).json({ success: false, message: 'Ongeldig wachtwoord' });
        }
        if (req.flash) {
          req.flash('error', 'Ongeldig wachtwoord');
        }
        return res.redirect('/dashboard/settings/security');
      }

      console.log('[2FA] Password verified successfully');
      
      // Immediately clear the session from the isolated client
      // This doesn't affect the user's actual session because we used isolated storage
      await tempSupabase.auth.signOut();
      
      // Clear any potential session data from the isolated client
      tempSupabase.auth.setSession(null).catch(() => {});
    } catch (authErr) {
      console.error('[2FA] Error during password verification:', authErr);
      if (isJsonRequest) {
        return res.status(500).json({ success: false, message: 'Fout bij wachtwoord verificatie' });
      }
      if (req.flash) {
        req.flash('error', 'Fout bij wachtwoord verificatie');
      }
      return res.redirect('/dashboard/settings/security');
    }

    // Disable 2FA - ensure settings record exists first
    const { data: existingSettings } = await supabaseAdmin
      .from('settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    let updateResult;
    
    if (existingSettings) {
      updateResult = await supabaseAdmin
        .from('settings')
        .update({
          two_factor_enabled: 0,
          two_factor_secret: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      // Create settings record if it doesn't exist
      updateResult = await supabaseAdmin
        .from('settings')
        .insert({
          user_id: userId,
          lead_limit: 10,
          notifications_enabled: 1,
          paused: 0,
          two_factor_enabled: 0,
          two_factor_secret: null,
          new_lead_notification: 1,
          payment_notification: 1
        });
    }

    if (updateResult.error) {
      console.error('[2FA] Error disabling 2FA:', updateResult.error);
      if (req.headers['content-type']?.includes('application/json')) {
        return res.status(500).json({ success: false, message: 'Fout bij uitschakelen 2FA' });
      }
      if (req.flash) {
        req.flash('error', 'Fout bij uitschakelen 2FA');
      }
      return res.redirect('/dashboard/settings/security');
    }

    if (req.headers['content-type']?.includes('application/json')) {
      return res.json({ success: true, message: 'Twee-factor authenticatie uitgeschakeld' });
    }
    if (req.flash) {
      req.flash('success', 'Twee-factor authenticatie uitgeschakeld');
    }
    res.redirect('/dashboard/settings/security');
  } catch (err) {
    console.error('Error disabling 2FA:', err);
    if (req.headers['content-type']?.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Fout bij uitschakelen 2FA' });
    }
    if (req.flash) {
      req.flash('error', 'Fout bij uitschakelen 2FA');
    }
    res.redirect('/dashboard/settings/security');
  }
});

// 2FA: Toggle (legacy route for compatibility)
router.post('/settings/two-factor', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { verificationCode } = req.body;
    const isJsonRequest = req.headers['content-type']?.includes('application/json');

    // Get user's 2FA secret
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('two_factor_secret')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings || !settings.two_factor_secret) {
      if (isJsonRequest) {
        return res.status(400).json({ success: false, message: 'Geen 2FA secret gevonden. Genereer eerst een nieuwe QR code.' });
      }
      if (req.flash) {
        req.flash('error', 'Geen 2FA secret gevonden. Genereer eerst een nieuwe QR code.');
      }
      return res.redirect('/dashboard/settings/security');
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: settings.two_factor_secret,
      encoding: 'base32',
      token: verificationCode,
      window: 2
    });

    if (!verified) {
      if (isJsonRequest) {
        return res.status(400).json({ success: false, message: 'Ongeldige verificatiecode' });
      }
      if (req.flash) {
        req.flash('error', 'Ongeldige verificatiecode');
      }
      return res.redirect('/dashboard/settings/security');
    }

    // Enable 2FA - check if settings exists first
    const { data: existingSettings2 } = await supabaseAdmin
      .from('settings')
      .select('id')
      .eq('user_id', userId)
      .single();

    let updateResult2;
    
    if (existingSettings2) {
      updateResult2 = await supabaseAdmin
        .from('settings')
        .update({ 
          two_factor_enabled: 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      // Create settings record if it doesn't exist
      updateResult2 = await supabaseAdmin
        .from('settings')
        .insert({
          user_id: userId,
          lead_limit: 10,
          notifications_enabled: 1,
          paused: 0,
          two_factor_enabled: 1,
          new_lead_notification: 1,
          payment_notification: 1
        });
    }

    if (updateResult2.error) {
      console.error('[2FA] Error enabling 2FA:', updateResult2.error);
      if (isJsonRequest) {
        return res.status(500).json({ success: false, message: 'Fout bij activeren 2FA' });
      }
      if (req.flash) {
        req.flash('error', 'Fout bij activeren 2FA');
      }
      return res.redirect('/dashboard/settings/security');
    }

    if (isJsonRequest) {
      return res.json({ success: true, message: 'Twee-factor authenticatie succesvol ingeschakeld' });
    }
    if (req.flash) {
      req.flash('success', 'Twee-factor authenticatie succesvol ingeschakeld');
    }
    res.redirect('/dashboard/settings/security');
  } catch (err) {
    console.error('Error in 2FA route:', err);
    const isJsonRequest = req.headers['content-type']?.includes('application/json');
    if (isJsonRequest) {
      return res.status(500).json({ success: false, message: 'Fout bij verwerken 2FA' });
    }
    if (req.flash) {
      req.flash('error', 'Fout bij verwerken 2FA');
    }
    res.redirect('/dashboard/settings/security');
  }
});

// Account verwijderen
router.post('/settings/delete-account', requireAuth, (req, res) => {
  const userId = req.user.id;
  
  // In een echte applicatie zou je hier een bevestigingscode controleren
  // en mogelijk een e-mail sturen voor extra bevestiging
  
  // Verwijder alle gebruikersgegevens
  supabase
    .from('profiles')
    .delete()
    .eq('id', userId)
    .then(() => {
      // Vernietig de sessie
      req.session.destroy(err => {
        if (err) {
          console.error('Fout bij verwijderen sessie:', err.message);
        }
        
        res.redirect('/login?message=Je account is succesvol verwijderd');
      });
    });
});

// Betalingen pagina
router.get('/payments', requireAuth, async (req, res) => {
  try {
    console.log('🎯 [PAYMENTS] Route hit for user:', req.user.id);
    const userId = req.user.id;
    
    // Haal betalingen op voor deze gebruiker
    console.log('🎯 [PAYMENTS] Fetching payments for userId:', userId);
    // Selecteer alleen kolommen die zeker bestaan - probeer eerst basisvelden
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('id, user_id, amount, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('❌ [PAYMENTS] Database error:', paymentsError);
      console.error('❌ [PAYMENTS] Error code:', paymentsError.code);
      console.error('❌ [PAYMENTS] Error message:', paymentsError.message);
      console.error('❌ [PAYMENTS] Error details:', paymentsError.details);
      throw paymentsError;
    }
    
    // Debug: Log the payments query results
    console.log('🔍 [PAYMENTS] Query results:', {
      userId,
      paymentsCount: payments?.length || 0,
      payments: payments?.map(p => ({ id: p.id, status: p.status, amount: p.amount, created_at: p.created_at })) || []
    });
    
    // Haal leads op van de laatste 30 dagen
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentLeads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, created_at, status, user_id')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (leadsError) throw leadsError;
    
    // Bereken statistieken
    const stats = {
      totalPaid: 0,
      pendingAmount: 0,
      totalTransactions: payments?.length || 0,
      pendingCount: 0,
      completedCount: 0,
      failedCount: 0
    };
    
    // Bereken statistieken op basis van betalingen
    if (payments) {
      const userPayments = payments; // Query already filters by user
      
      console.log('🔍 [PAYMENTS] User payments:', {
        totalCount: userPayments.length,
        userId,
        payments: userPayments?.map(p => ({ id: p.id, status: p.status, amount: p.amount, user_id: p.user_id, invoice_number: p.invoice_number })) || []
      });
      
      userPayments.forEach(payment => {
        if (payment.status === 'completed' || payment.status === 'paid') {
          if (payment.amount > 0) {
            stats.totalPaid += parseFloat(payment.amount);
          }
          stats.completedCount++;
        } else if (payment.status === 'pending') {
          stats.pendingAmount += parseFloat(payment.amount);
          stats.pendingCount++;
        } else if (payment.status === 'failed') {
          stats.failedCount++;
        }
      });
      
      // Update total transactions to reflect filtered count
      stats.totalTransactions = userPayments.length;
    }
    
    // ✅ Always fetch the latest profile data, don't trust the stale session
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance, has_payment_method, payment_method, sepa_consent_accepted')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Fout bij ophalen profiel:', profileError.message);
    }
    
    // Also keep session in sync for other pages
    if (req.session?.user && profile) {
      req.session.user.sepa_consent_accepted = !!profile.sepa_consent_accepted;
      req.session.user.has_payment_method = !!profile.has_payment_method;
      req.session.user.payment_method = profile.payment_method;
    }
    
    // Haal volgende factuurdatum op uit billing settings
    let nextInvoiceDate = null;
    
    // Haal billing settings op
    const { data: billingSettings, error: billingError } = await supabaseAdmin
      .from('billing_settings')
      .select('billing_date, billing_time, timezone, is_active')
      .eq('id', 1)
      .single();

    if (!billingError && billingSettings && billingSettings.is_active) {
      // Bereken volgende factuurdatum op basis van billing settings
      const billingDate = new Date(billingSettings.billing_date);
      const now = new Date();
      
      // Als de billing date deze maand al is geweest, plan voor volgende maand
      if (billingDate.getDate() <= now.getDate()) {
        nextInvoiceDate = new Date(billingDate);
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
      } else {
        // Anders gebruik de billing date van deze maand
        nextInvoiceDate = new Date(billingDate);
        nextInvoiceDate.setFullYear(now.getFullYear(), now.getMonth());
      }
    }
    
    // Bereken bedrag bij volgende betaling (openstaande leads)
    let nextPaymentAmount = 0;
    const { data: pendingLeads, error: pendingLeadsError } = await supabaseAdmin
      .from('leads')
      .select(`
        price_at_purchase,
        industries(price_per_lead)
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted');

    console.log('Debug pendingLeads:', { pendingLeads, pendingLeadsError, userId });

    if (!pendingLeadsError && pendingLeads) {
      nextPaymentAmount = pendingLeads.reduce((sum, lead) => {
        const price = lead.price_at_purchase || lead.industries?.price_per_lead || 0;
        console.log('Debug lead:', { lead, price });
        return sum + parseFloat(price);
      }, 0);
    }
    
    console.log('Debug nextPaymentAmount:', nextPaymentAmount);
    
    // Haal payment methods op voor deze gebruiker
    const { data: paymentMethods, error: pmError } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (pmError) {
      console.error('Fout bij ophalen payment methods:', pmError.message);
    }
    
    // Create user object for template
    const userForTemplate = await createUserForTemplate(req);
    userForTemplate.balance = profile?.balance || 0;
    userForTemplate.has_payment_method = profile?.has_payment_method || false;
    userForTemplate.payment_method = profile?.payment_method || null;
    
    // Debug logging to help identify the issue
    console.log('🔍 [PAYMENTS] Debug info:', {
      userId,
      profile_sepa_consent: profile?.sepa_consent_accepted,
      sepaConsentAccepted: !!profile?.sepa_consent_accepted,
      hasPaymentMethod: profile?.has_payment_method || false,
      paymentMethodsCount: paymentMethods?.length || 0
    });
    
    // Debug logging for stats
    console.log('📊 [PAYMENTS] Computed stats:', stats);
    
    res.render('dashboard/payments', {
      activeMenu: 'payments',
      user: userForTemplate,
      payments: payments || [],
      paymentMethods: paymentMethods || [],
      hasPaymentMethod: profile?.has_payment_method || false,
      sepaConsentAccepted: !!profile?.sepa_consent_accepted,
      stats,
      _stats: stats,  // 👈 alias for templates using _stats
      nextInvoiceDate,
      nextPaymentAmount,
      recentLeads: recentLeads || [],
      recentLeadsCount: recentLeads?.length || 0,
      title: 'Betalingen',
      error: null
    });
  } catch (err) {
    console.error('❌ [PAYMENTS] Fout bij ophalen betalingen:', err);
    console.error('❌ [PAYMENTS] Error code:', err.code);
    console.error('❌ [PAYMENTS] Error message:', err.message);
    console.error('❌ [PAYMENTS] Error stack:', err.stack);
    
    // Return a more helpful error response
    res.status(500).render('errors/500', {
      error: 'Er is een fout opgetreden bij het laden van de betalingen',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Er is een fout opgetreden bij het laden van de betalingen'
    });
  }
});

// Saldo opwaarderen
router.post('/payments/topup', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, payment_method } = req.body;
    
    // Validatie
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      req.flash('error', 'Voer een geldig bedrag in');
      return res.redirect('/dashboard/payments');
    }
    
    if (!payment_method) {
      req.flash('error', 'Selecteer een betaalmethode');
      return res.redirect('/dashboard/payments');
    }
    
    // Haal huidige saldo op
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Update gebruikerssaldo
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: user.balance + amountNum })
      .eq('id', userId);

    if (updateError) throw updateError;
    
    // Genereer een uniek transactie-ID
    const transactionId = 'tr_' + Math.random().toString(36).substr(2, 9);
    
    // Registreer betaling
    const { error: paymentError } = await supabase
      .from('payments')
      .insert([{
        user_id: userId,
        amount: amountNum,
        description: 'Saldo opwaardering',
        status: 'completed',
        payment_method: payment_method,
        transaction_id: transactionId,
        created_at: new Date().toISOString()
      }]);

    if (paymentError) throw paymentError;
    
    // Update sessie met nieuw saldo
    req.user.balance = user.balance + amountNum;
    
    req.flash('success', `Saldo succesvol opgewaardeerd met €${amountNum.toFixed(2)}`);
    res.redirect('/dashboard/payments');
  } catch (err) {
    console.error('Fout bij opwaarderen saldo:', err);
    req.flash('error', 'Er is een fout opgetreden bij het opwaarderen van je saldo');
    res.redirect('/dashboard/payments');
  }
});

// API route om betaling details op te halen
router.get('/payments/:id/details', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const paymentId = req.params.id;
    
    const { data: payment, error } = await supabase
      .from('payments')
      .select(`
        *,
        invoice:invoice_id (
          id,
          user_id,
          invoice_number,
          amount,
          status,
          created_at
        )
      `)
      .eq('id', paymentId)
      .eq('invoice.user_id', userId)
      .single();

    if (error) throw error;
    
    if (!payment) {
      return res.status(404).json({ error: 'Betaling niet gevonden' });
    }
    
    res.json(payment);
  } catch (err) {
    console.error('Fout bij ophalen betaling:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de betaling' });
  }
});

// Factuur downloaden
router.get('/payments/:id/invoice', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const paymentId = req.params.id;
    
    // Haal payment op
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', userId)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found or access denied:', paymentError);
      return res.status(404).json({ error: 'Betaling niet gevonden' });
    }

    // Check of payment voltooid is
    if (payment.status !== 'completed' && payment.status !== 'paid') {
      return res.status(400).json({ error: 'Betaling is nog niet voltooid' });
    }

    // Haal invoice op als die bestaat, anders maak er een
    let invoice = null;
    if (payment.invoice_id) {
      const { data: invoiceData, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('id', payment.invoice_id)
        .single();
      
      if (!invoiceError && invoiceData) {
        invoice = invoiceData;
      }
    }

    // Als er geen invoice is maar wel een invoice_number op payment, maak er een
    if (!invoice && payment.invoice_number) {
      // Maak een simpele invoice structuur voor PDF generatie
      invoice = {
        invoice_number: payment.invoice_number,
        amount: payment.amount,
        created_at: payment.created_at,
        due_date: payment.created_at // Gebruik payment date als fallback
      };
    }

    // Haal user data op voor factuur
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, company_name, street, city, postal_code, billing_company_name, billing_address, billing_city, billing_postal_code')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    // Gebruik invoiceService om PDF te genereren
    const invoiceService = require('../services/invoiceService');
    
    // Bereid invoice data voor
    const invoiceNumber = invoice?.invoice_number || payment.invoice_number || `PAY-${payment.id.substring(0, 8).toUpperCase()}`;
    const invoiceDate = new Date(invoice?.created_at || payment.created_at).toLocaleDateString('nl-NL');
    const dueDate = invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString('nl-NL') : invoiceDate;
    
    const companyName = userProfile?.billing_company_name || userProfile?.company_name || 'Bedrijfsnaam';
    const address = userProfile?.billing_address || userProfile?.street || '';
    const city = userProfile?.billing_city || userProfile?.city || '';
    const postalCode = userProfile?.billing_postal_code || userProfile?.postal_code || '';
    
    const amount = parseFloat(payment.amount || 0);
    const vatAmount = amount * 0.21; // 21% BTW
    const subtotal = amount / 1.21; // Bedrag zonder BTW
    
    // Parse payment_details voor extra informatie
    let paymentDetails = null;
    let periodInfo = '';
    let itemDescription = `Betaling #${payment.id.substring(0, 8)}`;
    
    if (payment.payment_details) {
      try {
        paymentDetails = typeof payment.payment_details === 'string' 
          ? JSON.parse(payment.payment_details) 
          : payment.payment_details;
        
        // Bepaal periode/maand
        if (paymentDetails.billing_date) {
          const billingDate = new Date(paymentDetails.billing_date);
          const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
          periodInfo = monthNames[billingDate.getMonth()];
        } else if (paymentDetails.period_month) {
          const periodDate = new Date(paymentDetails.period_month);
          const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
          periodInfo = monthNames[periodDate.getMonth()];
        } else {
          // Gebruik payment created_at maand
          const paymentDate = new Date(payment.created_at);
          const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
          periodInfo = monthNames[paymentDate.getMonth()];
        }
        
        // Bepaal item description - filter "Sample payment" en andere test strings
        if (paymentDetails.description) {
          // Filter test strings zoals "Sample payment", "test", "Monthly subscription", etc.
          let desc = paymentDetails.description;
          desc = desc.replace(/Sample payment\s*\d*/gi, '').trim();
          desc = desc.replace(/test/gi, '').trim();
          desc = desc.replace(/Monthly subscription/gi, '').trim();
          desc = desc.replace(/subscription/gi, '').trim();
          desc = desc.replace(/\s+/g, ' ').trim(); // Multiple spaces to single space
          // Fix dubbele streepjes (-- wordt -)
          desc = desc.replace(/\s*-\s*-/g, ' -').trim();
          desc = desc.replace(/^\s*-\s*/g, '').trim(); // Remove leading dash
          desc = desc.replace(/\s*-\s*$/g, '').trim(); // Remove trailing dash
          
          if (desc && desc.length > 0) {
            itemDescription = desc;
          } else if (paymentDetails.leads_count) {
            itemDescription = `${paymentDetails.leads_count} geaccepteerde leads`;
          }
        } else if (paymentDetails.leads_count) {
          itemDescription = `${paymentDetails.leads_count} geaccepteerde leads`;
        }
        
        // Voeg period info toe als beschikbaar (alleen als er nog geen period info in description zit)
        if (periodInfo && !itemDescription.includes(periodInfo)) {
          // Zorg dat er geen dubbele streepjes komen
          const separator = itemDescription ? ' - ' : '';
          itemDescription = `Aanvragen ${periodInfo}${separator}${itemDescription}`.replace(/\s*-\s*-/g, ' -').trim();
        }
      } catch (e) {
        console.error('Error parsing payment_details:', e);
      }
    } else {
      // Fallback: gebruik payment created_at maand
      const paymentDate = new Date(payment.created_at);
      const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
      periodInfo = monthNames[paymentDate.getMonth()];
      itemDescription = `Aanvragen ${periodInfo}`;
    }
    
    const invoiceData = {
      invoice_number: invoiceNumber,
      user: {
        company_name: companyName,
        address: address,
        city: city,
        postal_code: postalCode
      },
      date: invoiceDate,
      due_date: dueDate,
      subtotal: subtotal,
      vat: vatAmount,
      total: amount,
      subject: periodInfo ? `Aanvragen ${periodInfo}` : `Betaling #${payment.id.substring(0, 8)}`,
      reference_id: invoiceNumber,
      period: periodInfo,
      payment_method: payment.payment_method === 'directdebit' || payment.payment_method === 'sepa' ? 'SEPA Automatische Incasso' : 
                     payment.payment_method === 'creditcard' ? 'Creditcard' : 
                     payment.payment_method === 'ideal' ? 'iDEAL' : 'SEPA Automatische Incasso',
      payment_status: payment.status === 'completed' || payment.status === 'paid' ? 'Betaald' : 
                     payment.status === 'pending' ? 'Openstaand' : 'Betaald',
      payment_date: payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('nl-NL') : invoiceDate,
      items: [{
        description: itemDescription,
        quantity: 1,
        unit_price: subtotal,
        total: subtotal
      }]
    };

    // Genereer PDF buffer direct voor download
    console.log('📄 Starting PDF generation...');
    let pdfBuffer = await invoiceService.generateInvoicePDFBuffer(invoiceData);
    
    // Valideer buffer - Puppeteer kan Uint8Array retourneren, converteer naar Buffer
    if (!pdfBuffer) {
      throw new Error('PDF buffer is null or undefined');
    }
    
    // Converteer naar Buffer als het een Uint8Array is
    if (!Buffer.isBuffer(pdfBuffer)) {
      if (pdfBuffer instanceof Uint8Array || Array.isArray(pdfBuffer)) {
        pdfBuffer = Buffer.from(pdfBuffer);
        console.log('📦 Converted Uint8Array to Buffer');
      } else {
        throw new Error(`PDF buffer is invalid type: ${typeof pdfBuffer}`);
      }
    }
    
    if (pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty');
    }

    console.log(`✅ PDF generated: ${pdfBuffer.length} bytes (type: ${pdfBuffer.constructor.name})`);
    
    // Genereer ook PDF voor opslag (async, niet wachten)
    invoiceService.createInvoicePDF(invoiceData).then(pdfUrl => {
      // Als er een invoice record bestaat, update de pdf_url
      if (invoice && invoice.id && pdfUrl) {
        supabaseAdmin
          .from('invoices')
          .update({ pdf_url: pdfUrl })
          .eq('id', invoice.id);
      }
    }).catch(err => {
      console.error('Error saving PDF to storage (non-critical):', err);
    });

    // Stuur PDF direct als download
    const fileName = `factuur-${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    
    // Set headers voor PDF download (gebruik beide formaten voor maximale compatibiliteit)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log(`📤 Sending PDF: ${fileName} (${pdfBuffer.length} bytes)`);
    console.log(`📤 Headers set: Content-Type=application/pdf, Content-Length=${pdfBuffer.length}`);
    
    // Send PDF buffer
    res.send(pdfBuffer);
    
  } catch (err) {
    console.error('❌ Fout bij genereren factuur:', err);
    console.error('Error stack:', err.stack);
    
    // Fallback: stuur error response
    if (req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ 
        error: 'Er is een fout opgetreden bij het genereren van de factuur',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    // Flash message alleen als flash beschikbaar is
    if (req.flash) {
      req.flash('error', 'Er is een fout opgetreden bij het genereren van de factuur');
    }
    res.redirect('/dashboard/payments');
  }
});

// Betaling opnieuw proberen
router.get('/payments/:id/retry', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const paymentId = req.params.id;
    
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        invoice:invoice_id (
          id,
          user_id,
          invoice_number,
          amount,
          status,
          created_at
        )
      `)
      .eq('id', paymentId)
      .eq('invoice.user_id', userId)
      .eq('status', 'failed')
      .single();

    if (paymentError) throw paymentError;
    
    if (!payment) {
      req.flash('error', 'Betaling niet gevonden of niet mislukt');
      return res.redirect('/dashboard/payments');
    }
    
    // Update betaling status
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) throw updateError;
    
    // Update gebruikerssaldo
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: user.balance + payment.amount })
      .eq('id', userId);

    if (balanceError) throw balanceError;
    
    // Update sessie met nieuw saldo
    req.user.balance = user.balance + payment.amount;
    
    req.flash('success', 'Betaling is succesvol verwerkt');
    res.redirect('/dashboard/payments');
  } catch (err) {
    console.error('Fout bij opnieuw verwerken betaling:', err);
    req.flash('error', 'Er is een fout opgetreden bij het opnieuw verwerken van de betaling');
    res.redirect('/dashboard/payments');
  }
});

// Betaling verwerken
router.get('/payments/:id/pay', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const paymentId = req.params.id;
    
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        invoice:invoice_id (
          id,
          user_id,
          invoice_number,
          amount,
          status,
          created_at
        )
      `)
      .eq('id', paymentId)
      .eq('invoice.user_id', userId)
      .eq('status', 'pending')
      .single();

    if (paymentError) throw paymentError;
    
    if (!payment) {
      req.flash('error', 'Betaling niet gevonden of niet in behandeling');
      return res.redirect('/dashboard/payments');
    }
    
    // Update betaling status
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) throw updateError;
    
    req.flash('success', 'Betaling is succesvol verwerkt');
    res.redirect('/dashboard/payments');
  } catch (err) {
    console.error('Fout bij verwerken betaling:', err);
    req.flash('error', 'Er is een fout opgetreden bij het verwerken van de betaling');
    res.redirect('/dashboard/payments');
  }
});

// Revenue data voor grafiek
router.get('/revenue-data', requireAuth, async (req, res) => {
  try {
    // Get leads for the current user
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .or(`user_id.eq.${req.user.id},and(assigned_to.eq.${req.user.id},status.eq.accepted)`)
      .eq('status', 'accepted');

    if (error) throw error;

    // Process leads data for revenue chart
    const currentYear = new Date().getFullYear();
    const revenue = Array(12).fill(0); // Initialize array with 12 zeros

    leads.forEach(lead => {
      const date = new Date(lead.created_at);
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth();
        revenue[month] += parseFloat(lead.price_at_purchase) || 0;
      }
    });

    res.json({
      revenuePerMonth: revenue
    });
  } catch (err) {
    console.error('Error fetching revenue data:', err);
    res.status(500).json({
      error: 'Er is een fout opgetreden bij het ophalen van de omzetdata'
    });
  }
});

// Consent complete route - handles return from Mollie verification
// Update SEPA consent status
router.post('/payments/sepa-consent', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.session?.user?.id;
    const { consentAccepted } = req.body;
    
    if (!userId) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    
    if (typeof consentAccepted !== 'boolean') {
      return res.status(400).json({ error: 'Invalid consent status' });
    }
    
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        sepa_consent_accepted: consentAccepted, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)
      .select('id, sepa_consent_accepted')
      .single();
    
    if (error) throw error;
    
    // Debug logging
    console.log('✅ [SEPA-CONSENT] Updated successfully:', {
      userId,
      consentAccepted,
      dbResult: data.sepa_consent_accepted
    });
    
    // 🔑 Refresh the session copy so SSR uses the new value on next render
    if (req.session?.user) {
      req.session.user.sepa_consent_accepted = data.sepa_consent_accepted;
      await new Promise((r) => req.session.save(r));
      console.log('✅ [SEPA-CONSENT] Session updated');
    }
    
    res.json({ 
      success: true, 
      sepaConsentAccepted: data.sepa_consent_accepted 
    });
  } catch (error) {
    console.error('Error updating SEPA consent:', error);
    res.status(500).json({ error: 'Failed to update SEPA consent' });
  }
});

router.get('/payments/consent-complete', requireAuth, async (req, res) => {
  res.render('consent-complete', {
    user: await createUserForTemplate(req)
  });
});

// API endpoint for dashboard statistics
router.get('/statistics', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get leads for the current user
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .or(`user_id.eq.${userId},and(assigned_to.eq.${userId},status.eq.accepted)`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate statistics with real data
    const stats = {
      totalLeads: leads?.length || 0,
      newLeads: leads?.filter(lead => lead.status === 'new').length || 0,
      acceptedLeads: leads?.filter(lead => lead.status === 'accepted').length || 0,
      totalRevenue: leads?.filter(lead => lead.status === 'accepted').reduce((sum, lead) => sum + (parseFloat(lead.price_at_purchase) || 0), 0) || 0
    };

    res.json(stats);
  } catch (err) {
    console.error('Statistics API error:', err);
    res.status(500).json({ 
      error: 'Er is een fout opgetreden bij het ophalen van de statistieken' 
    });
  }
});

// API endpoint for recent requests (returns HTML)
router.get('/recent-requests', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get recent leads for the current user
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .or(`user_id.eq.${userId},and(assigned_to.eq.${userId},status.eq.accepted)`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Render the recent requests partial
    res.render('dashboard/partials/recent-requests', { 
      leads: leads || [] 
    });
  } catch (err) {
    console.error('Recent requests API error:', err);
    res.status(500).send('Er is een fout opgetreden bij het ophalen van recente aanvragen');
  }
});

// API endpoint for logging lead activity
router.post('/api/leads/:id/activity', requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    const { type } = req.body;

    // Validate type - extended with new workspace types
    // Must match the database constraint exactly
    const validTypes = [
      'phone_call', 
      'email_sent', 
      'whatsapp', 
      'meeting',
      'status_change_contacted',
      'note',
      'message',
      'created',
      'status_changed',
      'appointment_attended', 
      'no_show_customer', 
      'status_change_won', 
      'status_change_lost'
    ];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig activiteitstype'
      });
    }

    // Check if user has permission to update this lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead niet gevonden of geen toegang'
      });
    }

    // Insert activity - try partner_id first, fallback to created_by
    let activityData = {
      lead_id: leadId,
      type: type,
      created_at: new Date().toISOString(),
      created_by: userId  // Always include created_by as fallback
    };
    
    // Try to add partner_id (column might not exist yet)
    activityData.partner_id = userId;
    
    const { data: activity, error: activityError } = await supabase
      .from('lead_activities')
      .insert([activityData])
      .select()
      .single();

    if (activityError) {
      // If partner_id column doesn't exist, remove it and try again with just created_by
      if (activityError.message && (activityError.message.includes('partner_id') || activityError.message.includes('column') || activityError.code === '42703')) {
        delete activityData.partner_id;
        
        const { data: activityRetry, error: activityErrorRetry } = await supabase
          .from('lead_activities')
          .insert([activityData])
          .select()
          .single();
        
        if (activityErrorRetry) {
          console.error('Error inserting activity (retry):', activityErrorRetry);
          throw activityErrorRetry;
        }
        
        return res.json({
          success: true,
          activity: activityRetry
        });
      } else {
        console.error('Error inserting activity:', activityError);
        throw activityError;
      }
    }

    // Note: first_contact_at is automatically set by DB trigger when first contact activity is inserted
    // But we also call the helper for extra safety
    await handleFirstContact(leadId, type);

    res.json({
      success: true,
      activity
    });
  } catch (err) {
    console.error('Activity API error:', err);
    res.status(500).json({
      success: false,
      message: 'Er is een fout opgetreden bij het registreren van de activiteit'
    });
  }
});

// API endpoint for updating lead status (extended with won/lost/deal_value)
router.patch('/api/leads/:id/status', requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    const { status, deal_value } = req.body;

    // Validate status - allow predefined statuses and custom statuses
    const predefinedStatuses = ['new', 'accepted', 'rejected', 'completed', 'in_progress', 'won', 'lost'];
    
    // Basic validation: status must be a non-empty string
    if (!status || typeof status !== 'string' || status.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Status is verplicht en moet een geldige waarde zijn'
      });
    }
    
    // Normalize custom statuses: convert to lowercase, replace spaces with underscores
    let normalizedStatus = status.trim().toLowerCase().replace(/\s+/g, '_');
    
    // If it's a predefined status, use it as-is; otherwise use normalized custom status
    const finalStatus = predefinedStatuses.includes(normalizedStatus) ? normalizedStatus : normalizedStatus;

    // Check if user has permission to update this lead
    // Use supabaseAdmin to bypass RLS for permission check
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError) {
      console.error('Error fetching lead:', leadError);
      return res.status(500).json({
        success: false,
        message: 'Fout bij ophalen van lead',
        error: leadError.message
      });
    }

    if (!lead) {
      console.error('Lead not found:', leadId);
      return res.status(404).json({
        success: false,
        message: 'Lead niet gevonden'
      });
    }

    // Check if user has permission (user_id or assigned_to)
    const hasPermission = lead.user_id === userId || lead.assigned_to === userId;
    if (!hasPermission) {
      console.error('No permission for lead:', { leadId, userId, leadUserId: lead.user_id, leadAssignedTo: lead.assigned_to });
      return res.status(403).json({
        success: false,
        message: 'Geen toegang tot deze lead'
      });
    }

    // Update lead status
    const updateData = { 
      status: finalStatus
    };

    // Add deal_value if provided (for won status)
    if (finalStatus === 'won' && deal_value !== null && deal_value !== undefined) {
      updateData.deal_value = parseFloat(deal_value);
    }

    // Also support invoice_amount for backward compatibility
    if (status === 'accepted' && req.body.invoice_amount) {
      updateData.invoice_amount = parseFloat(req.body.invoice_amount);
    }

    // Use supabaseAdmin to bypass RLS for update
    const { data: updatedLead, error: updateError } = await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead:', updateError);
      throw updateError;
    }

    // Use performance triggers for won/lost status
    if (finalStatus === 'won') {
      await handleWon(leadId, deal_value, userId);
    } else if (finalStatus === 'lost') {
      await handleLost(leadId, userId);
    } else {
      // For other status changes, log activity manually
      // Format custom status nicely for display
      const statusDisplay = predefinedStatuses.includes(finalStatus) 
        ? finalStatus 
        : finalStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      let activityData = {
        lead_id: leadId,
        type: 'status_changed',
        description: `Label gewijzigd naar ${statusDisplay}`,
        created_by: userId,
        created_at: new Date().toISOString()
      };
      
      const { error: activityError } = await supabase
        .from('lead_activities')
        .insert([activityData]);
      
      if (activityError) {
        console.error('Error logging status change activity:', activityError);
      }
    }

    res.json({
      success: true,
      message: 'Status succesvol bijgewerkt',
      data: updatedLead
    });

  } catch (err) {
    console.error('Lead status update error:', err);
    res.status(500).json({
      success: false,
      message: 'Er is een fout opgetreden bij het bijwerken van de status'
    });
  }
});

// GET /dashboard/api/leads/:id/activities - Get all activities for a lead
router.get('/api/leads/:id/activities', requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    console.log('🔍 [ACTIVITIES] Request received:', { leadId, userId });

    // Check if user has permission to view this lead
    // Use supabaseAdmin to bypass RLS for checking
    const { data: leadCheck, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('id, user_id, assigned_to')
      .eq('id', leadId)
      .limit(1);

    if (leadError || !leadCheck || leadCheck.length === 0) {
      console.error('❌ [ACTIVITIES] Lead not found:', { leadId, error: leadError });
      return res.status(404).json({
        success: false,
        message: 'Lead niet gevonden'
      });
    }

    const lead = leadCheck[0];
    const hasAccess = lead.user_id === userId || lead.assigned_to === userId;
    
    if (!hasAccess) {
      console.error('❌ [ACTIVITIES] No access:', { leadId, userId, leadUserId: lead.user_id, leadAssignedTo: lead.assigned_to });
      return res.status(403).json({
        success: false,
        message: 'Geen toegang tot deze lead'
      });
    }

    // Get all activities for this lead
    console.log('🔍 [ACTIVITIES] Fetching activities for lead:', leadId);
    const { data: activities, error: activitiesError } = await supabaseAdmin
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (activitiesError) {
      console.error('❌ [ACTIVITIES] Error fetching activities:', activitiesError);
      return res.status(500).json({
        success: false,
        message: 'Fout bij ophalen van activiteiten'
      });
    }
    
    console.log('✅ [ACTIVITIES] Found activities:', activities?.length || 0);

    // Get user info for created_by fields
    const userIds = [...new Set(activities.map(a => a.created_by).filter(Boolean))];
    let userMap = {};
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, company_name, email')
        .in('id', userIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          userMap[profile.id] = {
            name: profile.first_name && profile.last_name 
              ? `${profile.first_name} ${profile.last_name}`
              : profile.company_name || profile.email || 'Onbekend',
            email: profile.email
          };
        });
      }
    }

    // Enrich activities with user info
    const enrichedActivities = activities.map(activity => ({
      ...activity,
      created_by_info: userMap[activity.created_by] || null
    }));

    res.json({
      success: true,
      activities: enrichedActivities
    });
  } catch (err) {
    console.error('Activities API error:', err);
    res.status(500).json({
      success: false,
      message: 'Er is een fout opgetreden bij het ophalen van activiteiten'
    });
  }
});

// POST /dashboard/api/leads/:id/message - Send a message (always sends email + WhatsApp notification)
router.post('/api/leads/:id/message', requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    const { message } = req.body;

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bericht is verplicht'
      });
    }

    // Check if user has permission
    // Use supabaseAdmin to bypass RLS for checking
    const { data: leadCheck, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .limit(1);

    if (leadError || !leadCheck || leadCheck.length === 0) {
      console.error('❌ [MESSAGE] Lead not found:', { leadId, error: leadError });
      return res.status(404).json({
        success: false,
        message: 'Lead niet gevonden'
      });
    }

    const lead = leadCheck[0];
    const hasAccess = lead.user_id === userId || lead.assigned_to === userId;
    
    if (!hasAccess) {
      console.error('❌ [MESSAGE] No access:', { leadId, userId, leadUserId: lead.user_id, leadAssignedTo: lead.assigned_to });
      return res.status(403).json({
        success: false,
        message: 'Geen toegang tot deze lead'
      });
    }

    // Get user profile for sender info
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, company_name, email')
      .eq('id', userId)
      .single();

    const senderName = profile 
      ? (profile.first_name && profile.last_name 
          ? `${profile.first_name} ${profile.last_name}`
          : profile.company_name || profile.email || 'Onbekend')
      : 'Onbekend';

    // Save activity
    const activityData = {
      lead_id: leadId,
      type: 'message',
      description: message.trim(),
      created_by: userId,
      created_at: new Date().toISOString(),
      metadata: {
        sender_name: senderName,
        sent_via: 'dashboard'
      }
    };

    const { data: activity, error: activityError } = await supabase
      .from('lead_activities')
      .insert([activityData])
      .select()
      .single();

    if (activityError) {
      console.error('Error saving message activity:', activityError);
      return res.status(500).json({
        success: false,
        message: 'Fout bij opslaan van bericht'
      });
    }

    // ALWAYS send email AND WhatsApp notification to customer
    const leadUrl = `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/dashboard/leads/${leadId}`;
    
    // Send email notification
    if (lead.email) {
      try {
        const EmailService = require('../services/emailService');
        const emailService = new EmailService();
        
        const htmlContent = emailService.renderTemplate('lead_message', {
          partner_name: senderName,
          lead_name: lead.name || 'Klant',
          message: message.trim(),
          lead_url: leadUrl
        });
        
        await emailService.sendEmail({
          to: lead.email,
          subject: `Nieuw bericht van ${senderName}`,
          html: htmlContent
        });
        
        console.log('📧 Email notification sent to customer:', lead.email);
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    // Send WhatsApp notification
    if (lead.phone) {
      try {
        const WhatsAppService = require('../services/whatsappService');
        const whatsappService = new WhatsAppService();
        
        // TODO: Use Twilio template when verified: new_message_notification_customer (HX33255914ca1fae10058eb2cffd333e77)
        // For now, use regular message
        const whatsappSent = await whatsappService.sendLeadMessage(
          lead.phone,
          senderName,
          message.trim(),
          lead.name || '',
          leadUrl
        );
        
        if (whatsappSent) {
          // Update the existing message activity metadata to indicate it was also sent via WhatsApp
          const { error: updateError } = await supabase
            .from('lead_activities')
            .update({
              metadata: {
                ...activity.metadata,
                also_sent_via: 'whatsapp',
                whatsapp_phone: lead.phone
              }
            })
            .eq('id', activity.id);
          
          if (updateError) {
            console.error('Error updating message activity with WhatsApp info:', updateError);
            // Don't fail the request
          }
        }
        
        console.log('💬 WhatsApp notification sent to customer:', lead.phone);
      } catch (whatsappError) {
        console.error('Error sending WhatsApp notification:', whatsappError);
        // Don't fail the request if WhatsApp fails
      }
    }
    
    // TODO: Also send notification to partner if customer sends message (future feature)
    // For now, only partner->customer notifications are implemented

    res.json({
      success: true,
      activity,
      message: 'Bericht opgeslagen en notificaties verzonden'
    });
  } catch (err) {
    console.error('Message API error:', err);
    res.status(500).json({
      success: false,
      message: 'Er is een fout opgetreden bij het verzenden van het bericht'
    });
  }
});

// GET /dashboard/api/leads/unread-messages-count - Get count of unread messages for current user
// OPTIMIZED: Use parallel queries and cache result
router.get('/api/leads/unread-messages-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // OPTIMIZED: Get user leads and messages in parallel
    const [leadsResult, messagesResult] = await Promise.all([
      // Get all leads assigned to this user
      supabaseAdmin
        .from('leads')
        .select('id')
        .or(`user_id.eq.${userId},assigned_to.eq.${userId}`),
      // Get recent messages (will filter by lead_ids after)
      supabaseAdmin
        .from('lead_activities')
        .select('lead_id')
        .eq('type', 'message')
        .neq('created_by', userId)
        .gte('created_at', sevenDaysAgo.toISOString())
    ]);
    
    if (leadsResult.error) {
      console.error('Error fetching user leads:', leadsResult.error);
      return res.json({ success: true, count: 0 });
    }
    
    if (messagesResult.error) {
      console.error('Error fetching messages:', messagesResult.error);
      return res.json({ success: true, count: 0 });
    }
    
    const userLeads = leadsResult.data || [];
    const recentMessages = messagesResult.data || [];
    
    if (userLeads.length === 0) {
      return res.json({ success: true, count: 0 });
    }
    
    const leadIds = new Set(userLeads.map(l => l.id));
    
    // Filter messages to only those from user's leads
    const unreadMessages = recentMessages.filter(m => m.lead_id && leadIds.has(m.lead_id));
    
    // Count unique leads with unread messages
    const leadsWithUnread = new Set(unreadMessages.map(m => m.lead_id));
    
    res.json({
      success: true,
      count: leadsWithUnread.size
    });
  } catch (err) {
    console.error('Unread messages count error:', err);
    res.json({
      success: true,
      count: 0
    });
  }
});

// API endpoint for sending feedback request
router.post('/api/leads/:id/send-feedback-request', requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;

    // Check if user has permission
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead niet gevonden of geen toegang'
      });
    }

    // Check if feedback already exists (table might not exist yet)
    try {
      const { data: existingFeedback, error: feedbackCheckError } = await supabase
        .from('lead_feedback')
        .select('id')
        .eq('lead_id', leadId)
        .eq('partner_id', userId)
        .limit(1);

      if (!feedbackCheckError && existingFeedback && existingFeedback.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Er is al feedback voor deze lead'
        });
      }
    } catch (feedbackTableError) {
      // Table might not exist yet - that's OK, we'll continue
      console.log('Feedback table might not exist yet:', feedbackTableError?.message);
    }

    // TODO: Generate feedback token and send email/SMS
    // For now, we'll just mark that a request was sent
    // You can add a feedback_request_sent_at column to leads table or create a separate table
    
    // Update lead with feedback request timestamp (if column exists)
    // This is a placeholder - adjust based on your schema
    try {
      await supabase
        .from('leads')
        .update({ 
          updated_at: new Date().toISOString()
          // Add feedback_request_sent_at if column exists
        })
        .eq('id', leadId);
    } catch (updateErr) {
      // Ignore if column doesn't exist
      console.log('Note: feedback_request_sent_at column may not exist');
    }

    res.json({
      success: true,
      message: 'Review-verzoek verstuurd (TODO: implementeer e-mail/SMS integratie)'
    });
  } catch (err) {
    console.error('Feedback request API error:', err);
    res.status(500).json({
      success: false,
      message: 'Er is een fout opgetreden bij het versturen van het review-verzoek'
    });
  }
});

// =====================================================
// CONTENT GENERATOR API ROUTES
// =====================================================

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Helper function to ensure storage bucket exists
async function ensureStorageBucket(bucketName, publicBucket = true) {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      return true;
    }
    
    // Bucket doesn't exist, create it via REST API
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for bucket creation');
      return false;
    }
    
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        name: bucketName,
        public: publicBucket,
        file_size_limit: 52428800, // 50MB
        allowed_mime_types: null
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create bucket ${bucketName}:`, errorText);
      if (response.status === 409) {
        return true; // Already exists
      }
      return false;
    }
    
    console.log(`✅ Created storage bucket: ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`Error ensuring bucket ${bucketName}:`, error);
    return false;
  }
}

// GET /dashboard/api/content-generator/customers - List customers for dropdown
router.get('/api/content-generator/customers', requireAuth, async (req, res) => {
  try {
    const { data: customers, error } = await supabaseAdmin
      .from('customers')
      .select('id, name, company_name, email')
      .order('company_name', { ascending: true });
    
    if (error) {
      console.error('Error fetching customers:', error);
      return res.status(500).json({ success: false, error: 'Error fetching customers' });
    }
    
    res.json({ success: true, customers: customers || [] });
  } catch (err) {
    console.error('Customers API error:', err);
    res.status(500).json({ success: false, error: 'Error fetching customers' });
  }
});

// GET /dashboard/api/content-generator/brands - List user's brands
router.get('/api/content-generator/brands', requireAuth, async (req, res) => {
  try {
    const { data: brands, error } = await supabaseAdmin
      .from('brands')
      .select('*, customers:customer_id(id, name, company_name)')
      .eq('owner_user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching brands:', error);
      return res.status(500).json({ success: false, error: 'Error fetching brands' });
    }
    
    res.json({ success: true, brands: brands || [] });
  } catch (err) {
    console.error('Brands API error:', err);
    res.status(500).json({ success: false, error: 'Error fetching brands' });
  }
});

// GET /dashboard/api/content-generator/brands/:id - Get single brand
router.get('/api/content-generator/brands/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', req.user.id)
      .single();
    
    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }
    
    res.json({ success: true, brand });
  } catch (err) {
    console.error('Brand API error:', err);
    res.status(500).json({ success: false, error: 'Error fetching brand' });
  }
});

// POST /dashboard/api/content-generator/brands - Create brand
router.post('/api/content-generator/brands', requireAuth, upload.single('logo'), async (req, res) => {
  try {
    const { name, customer_id, industry, primary_color, secondary_color } = req.body;
    
    if (!name || !customer_id || !industry || !primary_color) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Logo is required' });
    }
    
    // Validate hex color
    if (!/^#[0-9A-Fa-f]{6}$/.test(primary_color)) {
      return res.status(400).json({ success: false, error: 'Invalid primary color format' });
    }
    
    if (secondary_color && !/^#[0-9A-Fa-f]{6}$/.test(secondary_color)) {
      return res.status(400).json({ success: false, error: 'Invalid secondary color format' });
    }
    
    // Ensure storage bucket exists
    const bucketName = 'brand-assets';
    const bucketExists = await ensureStorageBucket(bucketName, true);
    if (!bucketExists) {
      return res.status(500).json({ success: false, error: 'Failed to initialize storage' });
    }
    
    // Upload logo
    const logoFileName = `${req.user.id}/${Date.now()}-${req.file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(bucketName)
      .upload(logoFileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });
    
    if (uploadError) {
      console.error('Logo upload error:', uploadError);
      return res.status(500).json({ success: false, error: 'Error uploading logo' });
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from(bucketName)
      .getPublicUrl(logoFileName);
    
    // Create brand
    const { data: brand, error: createError } = await supabaseAdmin
      .from('brands')
      .insert({
        owner_user_id: req.user.id,
        customer_id,
        name,
        industry,
        primary_color,
        secondary_color: secondary_color || null,
        logo_path: publicUrl
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating brand:', createError);
      return res.status(500).json({ success: false, error: 'Error creating brand' });
    }
    
    res.json({ success: true, brand });
  } catch (err) {
    console.error('Create brand API error:', err);
    res.status(500).json({ success: false, error: 'Error creating brand' });
  }
});

// PUT /dashboard/api/content-generator/brands/:id - Update brand
router.put('/api/content-generator/brands/:id', requireAuth, upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, customer_id, industry, primary_color, secondary_color } = req.body;
    
    // Check ownership
    const { data: existingBrand, error: checkError } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', req.user.id)
      .single();
    
    if (checkError || !existingBrand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }
    
    const updateData = {};
    if (name) updateData.name = name;
    if (customer_id) updateData.customer_id = customer_id;
    if (industry) updateData.industry = industry;
    if (primary_color) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(primary_color)) {
        return res.status(400).json({ success: false, error: 'Invalid primary color format' });
      }
      updateData.primary_color = primary_color;
    }
    if (secondary_color !== undefined) {
      if (secondary_color && !/^#[0-9A-Fa-f]{6}$/.test(secondary_color)) {
        return res.status(400).json({ success: false, error: 'Invalid secondary color format' });
      }
      updateData.secondary_color = secondary_color || null;
    }
    
    // Upload new logo if provided
    if (req.file) {
      const bucketName = 'brand-assets';
      const bucketExists = await ensureStorageBucket(bucketName, true);
      if (!bucketExists) {
        return res.status(500).json({ success: false, error: 'Failed to initialize storage' });
      }
      
      const logoFileName = `${req.user.id}/${Date.now()}-${req.file.originalname}`;
      const { error: uploadError } = await supabaseAdmin
        .storage
        .from(bucketName)
        .upload(logoFileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });
      
      if (uploadError) {
        console.error('Logo upload error:', uploadError);
        return res.status(500).json({ success: false, error: 'Error uploading logo' });
      }
      
      const { data: { publicUrl } } = supabaseAdmin
        .storage
        .from(bucketName)
        .getPublicUrl(logoFileName);
      
      updateData.logo_path = publicUrl;
    }
    
    const { data: brand, error: updateError } = await supabaseAdmin
      .from('brands')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating brand:', updateError);
      return res.status(500).json({ success: false, error: 'Error updating brand' });
    }
    
    res.json({ success: true, brand });
  } catch (err) {
    console.error('Update brand API error:', err);
    res.status(500).json({ success: false, error: 'Error updating brand' });
  }
});

// DELETE /dashboard/api/content-generator/brands/:id - Delete brand
router.delete('/api/content-generator/brands/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check ownership
    const { data: brand, error: checkError } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', req.user.id)
      .single();
    
    if (checkError || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }
    
    const { error: deleteError } = await supabaseAdmin
      .from('brands')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Error deleting brand:', deleteError);
      return res.status(500).json({ success: false, error: 'Error deleting brand' });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete brand API error:', err);
    res.status(500).json({ success: false, error: 'Error deleting brand' });
  }
});

// Helper function to generate caption
function generateCaption(brandIndustry, topic, cta, notes) {
  const industryHints = {
    'retail': 'winkels',
    'services': 'diensten',
    'technology': 'technologie',
    'food': 'eten',
    'health': 'gezondheid',
    'beauty': 'schoonheid',
    'fitness': 'fitness',
    'education': 'onderwijs'
  };
  
  const industryText = industryHints[brandIndustry?.toLowerCase()] || brandIndustry || 'onze diensten';
  
  let caption = '';
  
  if (topic) {
    caption += `🎉 ${topic}\n\n`;
  }
  
  caption += `Ontdek wat ${industryText} voor jou kunnen betekenen. `;
  
  if (cta) {
    caption += `${cta}! `;
  }
  
  caption += 'Neem vandaag nog contact met ons op voor meer informatie.';
  
  if (notes) {
    caption += `\n\n${notes}`;
  }
  
  caption += '\n\n#socialmedia #marketing #content';
  
  return caption;
}

// POST /dashboard/api/content-generator/generate - Generate content posts
router.post('/api/content-generator/generate', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    const { brand_id, platform, format, template_key, topic, cta, notes } = req.body;
    
    if (!brand_id || !platform || !format || !template_key) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one image is required' });
    }
    
    // Get brand
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('id', brand_id)
      .eq('owner_user_id', req.user.id)
      .single();
    
    if (brandError || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }
    
    // Get template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('content_templates')
      .select('*')
      .eq('key', template_key)
      .single();
    
    if (templateError || !template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    const variations = template.variations || [];
    if (variations.length === 0) {
      return res.status(400).json({ success: false, error: 'Template has no variations' });
    }
    
    // Ensure storage bucket exists
    const bucketName = 'content-images';
    const bucketExists = await ensureStorageBucket(bucketName, true);
    if (!bucketExists) {
      return res.status(500).json({ success: false, error: 'Failed to initialize storage' });
    }
    
    // Upload images and generate posts
    const posts = [];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const variation = variations[i % variations.length];
      
      // Upload image
      const imageFileName = `${req.user.id}/${brand_id}/${Date.now()}-${i}-${file.originalname}`;
      const { error: uploadError } = await supabaseAdmin
        .storage
        .from(bucketName)
        .upload(imageFileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });
      
      if (uploadError) {
        console.error('Image upload error:', uploadError);
        continue; // Skip this image
      }
      
      const { data: { publicUrl } } = supabaseAdmin
        .storage
        .from(bucketName)
        .getPublicUrl(imageFileName);
      
      // Generate caption
      const caption = generateCaption(brand.industry, topic, cta, notes);
      const title = topic || `Post ${i + 1}`;
      
      // Create post
      const { data: post, error: postError } = await supabaseAdmin
        .from('content_posts')
        .insert({
          owner_user_id: req.user.id,
          brand_id: brand.id,
          customer_id: brand.customer_id,
          platform,
          format,
          template_key,
          template_variation: variation.key,
          image_paths: [publicUrl],
          title,
          caption,
          status: 'draft'
        })
        .select()
        .single();
      
      if (postError) {
        console.error('Error creating post:', postError);
        continue; // Skip this post
      }
      
      posts.push(post);
    }
    
    res.json({ success: true, posts });
  } catch (err) {
    console.error('Generate content API error:', err);
    res.status(500).json({ success: false, error: 'Error generating content' });
  }
});

// PUT /dashboard/api/content-generator/posts/:id - Update post
router.put('/api/content-generator/posts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, status } = req.body;
    
    // Check ownership
    const { data: existingPost, error: checkError } = await supabaseAdmin
      .from('content_posts')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', req.user.id)
      .single();
    
    if (checkError || !existingPost) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    const updateData = {};
    if (caption !== undefined) updateData.caption = caption;
    if (status !== undefined) updateData.status = status;
    
    const { data: post, error: updateError } = await supabaseAdmin
      .from('content_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating post:', updateError);
      return res.status(500).json({ success: false, error: 'Error updating post' });
    }
    
    res.json({ success: true, post });
  } catch (err) {
    console.error('Update post API error:', err);
    res.status(500).json({ success: false, error: 'Error updating post' });
  }
});

module.exports = router;