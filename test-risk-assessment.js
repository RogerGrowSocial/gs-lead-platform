#!/usr/bin/env node

/**
 * Test script voor risk assessment
 * Test of bedrijfsleeftijd en internetverificatie correct worden opgehaald
 * 
 * Usage: node test-risk-assessment.js [user_id of company_name]
 */

require('dotenv').config()
const { supabaseAdmin } = require('./config/supabase')
const UserRiskAssessmentService = require('./services/userRiskAssessmentService')

async function testRiskAssessment(userIdentifier) {
  try {
    console.log('🧪 Risk Assessment Test Script\n')
    console.log('=' .repeat(60))
    
    // Get profile
    let profile
    if (userIdentifier) {
      // Try as UUID first, then as company name
      const { data: profileById, error: errorById } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userIdentifier)
        .single()
      
      if (!errorById && profileById) {
        profile = profileById
        console.log(`✅ Profile found by ID: ${userIdentifier}`)
      } else {
        // Try by company name
        const { data: profileByName, error: errorByName } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .ilike('company_name', `%${userIdentifier}%`)
          .limit(1)
          .single()
        
        if (!errorByName && profileByName) {
          profile = profileByName
          console.log(`✅ Profile found by company name: ${userIdentifier}`)
        } else {
          console.error(`❌ Profile not found: ${userIdentifier}`)
          process.exit(1)
        }
      }
    } else {
      // Get first profile with company_name
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .not('company_name', 'is', null)
        .limit(1)
      
      if (error || !profiles || profiles.length === 0) {
        console.error('❌ No profiles with company_name found')
        process.exit(1)
      }
      
      profile = profiles[0]
      console.log(`✅ Using first profile with company_name: ${profile.company_name}`)
    }
    
    console.log('\n📋 Profile Data:')
    console.log(`   ID: ${profile.id}`)
    console.log(`   Email: ${profile.email || 'N/A'}`)
    console.log(`   Company: ${profile.company_name || 'N/A'}`)
    console.log(`   KVK: ${profile.coc_number || 'N/A'}`)
    console.log(`   City: ${profile.city || 'N/A'}`)
    console.log(`   Current Risk Score: ${profile.ai_risk_score || 'N/A'}`)
    console.log(`   Current Risk Level: ${profile.ai_risk_level || 'N/A'}`)
    
    console.log('\n' + '='.repeat(60))
    console.log('🔄 Starting Risk Assessment...\n')
    
    // Execute risk assessment
    const result = await UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, profile)
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 Results:\n')
    
    if (result.success) {
      console.log(`✅ Assessment successful!`)
      console.log(`   Score: ${result.score}/100`)
      console.log(`   Risk Level: ${result.risk_level}`)
      console.log(`   Requires Review: ${result.requires_manual_review ? 'Yes' : 'No'}`)
      console.log(`\n   Explanation:`)
      console.log(`   ${result.explanation}`)
      
      if (result.strengths && result.strengths.length > 0) {
        console.log(`\n   Strengths:`)
        result.strengths.forEach((s, i) => console.log(`   ${i + 1}. ${s}`))
      }
      
      if (result.concerns && result.concerns.length > 0) {
        console.log(`\n   Concerns:`)
        result.concerns.forEach((c, i) => console.log(`   ${i + 1}. ${c}`))
      }
      
      // Check if explanation mentions missing info incorrectly
      const explanation = result.explanation.toLowerCase()
      const mentionsMissingAge = explanation.includes('bedrijfsleeftijd') && 
                                 (explanation.includes('ontbreekt') || 
                                  explanation.includes('niet beschikbaar') ||
                                  explanation.includes('geen informatie'))
      const mentionsMissingInternet = explanation.includes('internet') && 
                                     (explanation.includes('ontbreekt') || 
                                      explanation.includes('niet beschikbaar') ||
                                      explanation.includes('geen informatie'))
      
      if (mentionsMissingAge || mentionsMissingInternet) {
        console.log(`\n⚠️  WARNING: Explanation mentions missing information that may have been available`)
        if (mentionsMissingAge) console.log(`   - Mentions missing company age`)
        if (mentionsMissingInternet) console.log(`   - Mentions missing internet verification`)
      } else {
        console.log(`\n✅ Good: Explanation does not incorrectly mention missing information`)
      }
      
    } else {
      console.log(`❌ Assessment failed:`)
      console.log(`   Error: ${result.error}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Test completed')
    
  } catch (error) {
    console.error('\n❌ Test failed with error:')
    console.error(error)
    process.exit(1)
  }
}

// Get command line argument
const userIdentifier = process.argv[2]

if (userIdentifier === '--help' || userIdentifier === '-h') {
  console.log(`
Usage: node test-risk-assessment.js [user_id or company_name]

Examples:
  node test-risk-assessment.js
  node test-risk-assessment.js mokum-schilderwerken
  node test-risk-assessment.js 123e4567-e89b-12d3-a456-426614174000

If no argument is provided, uses the first profile with a company_name.
`)
  process.exit(0)
}

testRiskAssessment(userIdentifier)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

