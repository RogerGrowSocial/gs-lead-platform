const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple in-process lock per userId (for single instance)
const locks = new Map();

function lockFor(userId) {
  const key = String(userId);
  let currentLock = locks.get(key);
  
  if (!currentLock) {
    // No existing lock, create a simple resolved promise
    currentLock = Promise.resolve();
  }
  
  let resolveNext;
  const nextLock = new Promise(resolve => {
    resolveNext = resolve;
  });
  
  locks.set(key, currentLock.then(() => nextLock));
  
  return () => {
    if (resolveNext) {
      resolveNext();
    }
  };
}

/**
 * Middleware to validate lead assignment
 * Checks if user has access to lead's industry and has available quota
 */
async function validateAssignment(req, res, next) {
  try {
    const raw = {
      params: req.params, query: req.query, body: req.body
    };
    console.log('[assign:req]', JSON.stringify(raw));

    const userId =
      req.body.assigned_user_id ||
      req.body.assignee_id ||
      req.body.assignedTo ||
      req.body.user_id ||
      req.body.assigned_to ||
      req.params.userId ||
      req.query.user_id;

    const leadId = req.params.id || req.body.lead_id;

    console.log('🔍 validateAssignment middleware called:', {
      method: req.method,
      url: req.url,
      leadId,
      userId,
      body: req.body
    });

    if (!userId || userId === 'null' || userId === null) {
      // No assignment being made, skip validation
      console.log('✅ No assignment being made, skipping validation');
      return next();
    }

    // Hard 500 als userId ontbreekt (voor debugging)
    if (!userId) {
      console.error('❌ CRITICAL: userId is missing from request');
      return res.status(500).json({ 
        success: false, 
        error: 'CRITICAL: userId is missing from request' 
      });
    }

    if (!leadId) {
      return res.status(400).json({ 
        success: false, 
        error: 'lead_id is required' 
      });
    }

    // --- Begin lock (race-guard) - TEMPORARILY DISABLED ---
    const release = () => {}; // No-op release function
    // -------------------------------

    // Fetch lead details
    console.log('🔍 Fetching lead details for ID:', leadId);
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('industry_id')
      .eq('id', leadId)
      .single();

    console.log('🔍 Lead fetch result:', { lead, leadError });

    if (leadError || !lead) {
      console.log('❌ Lead not found or error:', leadError);
      release();
      return res.status(404).json({ 
        success: false, 
        error: 'Lead niet gevonden' 
      });
    }

    // Fetch user industry preferences
    console.log('🔍 Fetching user industry preferences for ID:', userId);
    const { data: preferences, error: preferencesError } = await supabaseAdmin
      .from('user_industry_preferences')
      .select('industry_id')
      .eq('user_id', userId)
      .eq('is_enabled', true);

    console.log('🔍 User preferences result:', { preferences, preferencesError });

    if (preferencesError) {
      console.log('❌ Error fetching user preferences:', preferencesError);
      release();
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij ophalen gebruikersvoorkeuren' 
      });
    }

    // Check if user has access to the lead's industry
    const hasIndustry = preferences.some(
      preference => String(preference.industry_id) === String(lead.industry_id)
    );

    if (!hasIndustry) {
      release();
      return res.status(403).json({ 
        success: false, 
        error: 'Gebruiker heeft geen toegang tot deze branche' 
      });
    }

    // 1) Subscriptions ophalen (active/paused)
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('subscriptions')
      .select('leads_per_month, status, is_paused')
      .eq('user_id', userId);

    if (subsErr) {
      console.log('❌ Error fetching subscriptions:', subsErr);
      release();
      return res.status(500).json({ success: false, error: 'Fout bij ophalen subscription(s)' });
    }

    const totalQuota = (subs || [])
      .filter(s => ['active', 'paused'].includes(s.status))
      .reduce((sum, s) => sum + (s.leads_per_month || 0), 0);

    const isPaused = (subs || []).some(s => s.is_paused === true || s.status === 'paused');

    if (totalQuota <= 0) {
      release();
      return res.status(403).json({ success: false, error: 'Gebruiker heeft geen actief quota' });
    }
    if (isPaused) {
      release();
      return res.status(403).json({ success: false, error: 'Leads voor deze gebruiker zijn gepauzeerd' });
    }

    // 2) Huidig gebruik ophalen (via view, maar met admin) - gebruik effective_count
    const { data: usage, error: usageErr } = await supabaseAdmin
      .from('v_monthly_lead_usage')
      .select('effective_count')
      .eq('user_id', userId)
      .maybeSingle(); // i.p.v. single() om PGRST116 weg te vangen

    if (usageErr) {
      console.log('❌ Error fetching usage:', usageErr);
      release();
      return res.status(500).json({ success: false, error: 'Fout bij ophalen huidig gebruik' });
    }

    const usedEffective = usage?.effective_count || 0;
    const remaining = Math.max(0, totalQuota - usedEffective);

    console.log('[quota]', { userId, totalQuota, usedEffective, remaining, isPaused, allow: remaining > 0 && !isPaused });

    // 3) Blokkeren indien vol
    if (remaining <= 0) {
      release();
      return res.status(403).json({
        success: false,
        error: `Gebruiker heeft zijn quota bereikt (${usedEffective}/${totalQuota})`
      });
    }

    console.log('✅ Quota check passed, proceeding to payment method validation...');

    // 4) Payment method validation
    console.log('🔍 Checking payment method requirements for user:', userId);
    
    // Get user's payment methods
    const { data: paymentMethods, error: paymentMethodsError } = await supabaseAdmin
      .from('payment_methods')
      .select('type, status, is_default')
      .eq('user_id', userId)
      .in('status', ['active', 'pending']); // Accept both active and pending payment methods

    if (paymentMethodsError) {
      console.log('❌ Error fetching payment methods:', paymentMethodsError);
      release();
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij ophalen betaalmethoden' 
      });
    }

    // Get user's current balance
    const { data: userProfile, error: userProfileError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (userProfileError) {
      console.log('❌ Error fetching user profile:', userProfileError);
      release();
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij ophalen gebruikersprofiel' 
      });
    }

    const userBalance = userProfile?.balance || 0;
    const hasSepaMandate = paymentMethods?.some(pm => pm.type === 'sepa' && pm.status === 'active') || false;
    const hasCreditCard = paymentMethods?.some(pm => pm.type === 'credit_card' && ['active', 'pending'].includes(pm.status)) || false;
    const hasAnyPaymentMethod = paymentMethods && paymentMethods.length > 0;

    console.log('🔍 Payment method check:', {
      userId,
      hasSepaMandate,
      hasCreditCard,
      hasAnyPaymentMethod,
      userBalance,
      paymentMethods: paymentMethods?.map(pm => ({ type: pm.type, status: pm.status }))
    });

    // Payment method validation logic
    if (!hasAnyPaymentMethod) {
      release();
      return res.status(403).json({
        success: false,
        error: 'Gebruiker heeft geen actieve betaalmethode. Voeg eerst een betaalmethode toe.'
      });
    }

    // If user only has credit card (no SEPA), check balance
    if (!hasSepaMandate && hasCreditCard) {
      // Get lead price
      const { data: industry, error: industryError } = await supabaseAdmin
        .from('industries')
        .select('price_per_lead')
        .eq('id', lead.industry_id)
        .single();

      const leadPrice = industry?.price_per_lead || 10.00; // Default price

      if (userBalance < leadPrice) {
        release();
        return res.status(403).json({
          success: false,
          error: `Onvoldoende saldo. Vereist: €${leadPrice.toFixed(2)}, Huidig: €${userBalance.toFixed(2)}. Voeg saldo toe of stel SEPA incasso in.`
        });
      }

      console.log('✅ Credit card user has sufficient balance:', {
        userBalance,
        leadPrice,
        remaining: userBalance - leadPrice
      });
    }

    // SEPA users can always receive leads (no balance check needed)
    if (hasSepaMandate) {
      console.log('✅ SEPA user can receive leads (automatic billing enabled)');
    }

    // Store validated data for use in the route handler
    req.validatedLead = lead;
    req.validatedUser = { 
      id: userId,
      hasSepaMandate,
      hasCreditCard,
      userBalance
    };
    
    release();
    console.log('✅ validateAssignment middleware completed successfully');
    next();
  } catch (e) {
    console.error('validateAssignment fatal error:', e);
    console.error('Error stack:', e.stack);
    return res.status(500).json({ success: false, error: 'Onbekende fout in quota-validatie: ' + e.message });
  }
}

/**
 * Middleware to validate lead assignment during creation
 * Checks if user has access to lead's industry and has available quota
 */
async function validateAssignmentCreate(req, res, next) {
  try {
    const { user_id, assigned_to, industry_id } = req.body;
    const userId = user_id || assigned_to;

    if (!userId || !industry_id) {
      // No assignment during creation, skip validation
      return next();
    }

    // Fetch user details
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        email,
        subscriptions(
          status,
          is_paused
        )
      `)
      .eq('id', userId)
      .single();

    console.log('🔍 User fetch result:', { user, userError });

    if (userError || !user) {
      console.log('❌ User not found or error:', userError);
      return res.status(404).json({ 
        success: false, 
        error: 'Gebruiker niet gevonden' 
      });
    }

    // Fetch user industry preferences separately
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_industry_preferences')
      .select('industry_id')
      .eq('user_id', userId)
      .eq('is_enabled', true);

    if (preferencesError) {
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij ophalen gebruikersvoorkeuren' 
      });
    }

    // Check if user has access to the lead's industry
    const hasIndustry = preferences.some(
      preference => String(preference.industry_id) === String(industry_id)
    );

    if (!hasIndustry) {
      return res.status(403).json({ 
        success: false, 
        error: 'Gebruiker heeft geen toegang tot deze branche' 
      });
    }

    // Check subscription status - only if user has subscriptions
    if (user.subscriptions && user.subscriptions.length > 0) {
      const subscription = user.subscriptions[0];
      if (!subscription || subscription.status !== 'active' || subscription.is_paused) {
        return res.status(403).json({ 
          success: false, 
          error: 'Gebruiker heeft geen actieve subscription' 
        });
      }
    }

    // Check quota - prevent assignment if user is over limit
    console.log('🔍 Checking quota for user during creation:', userId);
    const { data: quotaData, error: quotaError } = await supabase
      .from('v_monthly_lead_usage')
      .select('approved_count')
      .eq('user_id', userId)
      .single();

    if (quotaError && quotaError.code !== 'PGRST116') {
      console.log('❌ Error fetching quota:', quotaError);
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij ophalen quota informatie' 
      });
    }

    // Get user's quota limit from subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('leads_per_month')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.log('❌ Error fetching subscription:', subError);
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij ophalen subscription informatie' 
      });
    }

    const currentUsage = quotaData ? quotaData.approved_count : 0;
    const quotaLimit = subscription ? subscription.leads_per_month : 0;

    console.log('🔍 Quota check during creation:', { currentUsage, quotaLimit, canReceiveMore: currentUsage < quotaLimit });

    if (currentUsage >= quotaLimit) {
      return res.status(403).json({ 
        success: false, 
        error: `Gebruiker heeft zijn quota bereikt (${currentUsage}/${quotaLimit} leads)` 
      });
    }

    // Payment method validation for lead creation
    console.log('🔍 Checking payment method requirements for user:', userId);
    
    // Get user's payment methods
    const { data: paymentMethods, error: paymentMethodsError } = await supabase
      .from('payment_methods')
      .select('type, status, is_default')
      .eq('user_id', userId)
      .in('status', ['active', 'pending']); // Accept both active and pending payment methods

    if (paymentMethodsError) {
      console.log('❌ Error fetching payment methods:', paymentMethodsError);
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij ophalen betaalmethoden' 
      });
    }

    // Get user's current balance
    const { data: userProfile, error: userProfileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (userProfileError) {
      console.log('❌ Error fetching user profile:', userProfileError);
      return res.status(500).json({ 
        success: false, 
        error: 'Fout bij ophalen gebruikersprofiel' 
      });
    }

    const userBalance = userProfile?.balance || 0;
    const hasSepaMandate = paymentMethods?.some(pm => pm.type === 'sepa' && pm.status === 'active') || false;
    const hasCreditCard = paymentMethods?.some(pm => pm.type === 'credit_card' && ['active', 'pending'].includes(pm.status)) || false;
    const hasAnyPaymentMethod = paymentMethods && paymentMethods.length > 0;

    console.log('🔍 Payment method check (create):', {
      userId,
      hasSepaMandate,
      hasCreditCard,
      hasAnyPaymentMethod,
      userBalance,
      paymentMethods: paymentMethods?.map(pm => ({ type: pm.type, status: pm.status }))
    });

    // Payment method validation logic
    if (!hasAnyPaymentMethod) {
      return res.status(403).json({
        success: false,
        error: 'Gebruiker heeft geen actieve betaalmethode. Voeg eerst een betaalmethode toe.'
      });
    }

    // If user only has credit card (no SEPA), check balance
    if (!hasSepaMandate && hasCreditCard) {
      // Get lead price
      const { data: industry, error: industryError } = await supabase
        .from('industries')
        .select('price_per_lead')
        .eq('id', industry_id)
        .single();

      const leadPrice = industry?.price_per_lead || 10.00; // Default price

      if (userBalance < leadPrice) {
        return res.status(403).json({
          success: false,
          error: `Onvoldoende saldo. Vereist: €${leadPrice.toFixed(2)}, Huidig: €${userBalance.toFixed(2)}. Voeg saldo toe of stel SEPA incasso in.`
        });
      }

      console.log('✅ Credit card user has sufficient balance:', {
        userBalance,
        leadPrice,
        remaining: userBalance - leadPrice
      });
    }

    // SEPA users can always receive leads (no balance check needed)
    if (hasSepaMandate) {
      console.log('✅ SEPA user can receive leads (automatic billing enabled)');
    }

    // Store validated data for use in the route handler
    req.validatedUser = {
      ...user,
      hasSepaMandate,
      hasCreditCard,
      userBalance
    };
    
    next();
  } catch (error) {
    console.error('Error in validateAssignmentCreate middleware:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Interne serverfout bij validatie' 
    });
  }
}

module.exports = { validateAssignment, validateAssignmentCreate };
