#!/usr/bin/env node

/**
 * Reset risk assessments for all users
 * 
 * Usage:
 *   node scripts/reset-risk-assessments.js
 */

'use strict'

require('dotenv').config()
const { supabaseAdmin } = require('../config/supabase')

async function resetRiskAssessments() {
  try {
    console.log('🔄 Resetting risk assessments for all users...\n')

    // Get count before reset
    const { count: beforeCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .or('ai_risk_score.not.is.null,ai_risk_level.not.is.null,ai_risk_assessed_at.not.is.null')

    console.log(`Found ${beforeCount || 0} profiles with risk assessments\n`)

    // Reset risk assessment fields
    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .update({
        ai_risk_score: null,
        ai_risk_level: null,
        ai_risk_explanation: null,
        ai_risk_assessed_at: null,
        updated_at: new Date().toISOString()
      })
      .or('ai_risk_score.not.is.null,ai_risk_level.not.is.null,ai_risk_assessed_at.not.is.null')
      .select()

    if (error) {
      throw error
    }

    console.log(`✅ Successfully reset risk assessments for ${data?.length || 0} profiles\n`)

    // Verify reset
    const { count: afterCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .or('ai_risk_score.not.is.null,ai_risk_level.not.is.null,ai_risk_assessed_at.not.is.null')

    console.log(`Remaining profiles with risk assessments: ${afterCount || 0}`)
    console.log('\n✅ Reset complete! Risk assessments can now be re-run with KVK integration.')

  } catch (error) {
    console.error('❌ Error resetting risk assessments:', error)
    process.exit(1)
  }
}

resetRiskAssessments()

