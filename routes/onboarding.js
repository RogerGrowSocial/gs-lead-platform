const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../config/supabase')

// Dedicated onboarding page (requires auth at mount site)
router.get('/', async (req, res) => {
  try {
    // Check if user already completed onboarding
    try {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('onboarding_completed_at, onboarding_step')
        .eq('id', req.user.id)
        .single()

      if (!profileError && profile) {
        const completed = !!profile?.onboarding_completed_at;
        const step = profile?.onboarding_step || 0;
        
        // Redirect if onboarding is fully completed OR if step >= 99 (ready for tour)
        // Step 99 means "ready for tour" - user should be on dashboard to start tour
        if (completed || (step >= 99 && step !== null && step !== undefined)) {
          console.log('[ONBOARDING] User ready for tour or completed, redirecting to dashboard', { completed, step });
          return res.redirect('/dashboard');
        }
      }
    } catch (checkErr) {
      console.warn('[ONBOARDING] Error checking onboarding status:', checkErr);
      // Continue to show onboarding page
    }

    res.render('onboarding/index', {
      layout: false,
      user: req.user || null
    })
  } catch (err) {
    console.error('Error rendering onboarding page:', err)
    res.status(500).render('errors/500', { layout: false })
  }
})

module.exports = router


