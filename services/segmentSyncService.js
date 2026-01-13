'use strict'

const { supabaseAdmin } = require('../config/supabase')
const logger = require('../utils/logger')
const LeadSegmentService = require('./leadSegmentService')

/**
 * Segment Sync Service
 * 
 * Zorgt ervoor dat alle segmenten (branche + regio combinaties) 
 * die nodig zijn op basis van capacity (actieve partners met leads) bestaan in de database.
 * 
 * DESIGN DECISIONS:
 * - HARDE REGEL: Alleen betalende partners (payment_methods.status = 'active') tellen mee
 * - HARDE REGEL: Segmenten worden NOOIT verwijderd, alleen gedeactiveerd (is_active = false)
 * - Bulk operations: gebruikt SQL functies voor performance (geen loops met queries)
 * 
 * NOTE: capacity-based segment sync — we only create/keep segments where capacity > 0.
 * This keeps the system scalable and avoids thousands of unused segments.
 * 
 * Wordt aangeroepen:
 * - Via cron job (dagelijks) - syncSegmentsFromCapacity()
 * - Handmatig via admin endpoint
 * 
 * Legacy (voor backward compatibility):
 * - syncSegmentsFromUserPreferences() - nog beschikbaar maar niet meer gebruikt in cron
 * - syncSegmentsForUser() - voor per-user sync na preference updates
 */
class SegmentSyncService {
  /**
   * Haal alle (branch, region) combinaties op waar capacity > 0 is
   * Gebruikt bulk SQL query voor performance
   * @returns {Promise<Array>} Array van { branch, region, capacity_partners, capacity_total_leads }
   */
  static async fetchBranchRegionCapacityCombos() {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_branch_region_capacity_combos')

      if (error) {
        throw new Error(`Error fetching branch/region capacity combos: ${error.message}`)
      }

      return data || []
    } catch (error) {
      logger.error('Error in fetchBranchRegionCapacityCombos:', error)
      throw error
    }
  }

  /**
   * Haal alle bestaande segmenten op
   * @returns {Promise<Array>} Array van segmenten met { id, code, branch, region, is_active }
   */
  static async fetchAllSegments() {
    try {
      const { data, error } = await supabaseAdmin
        .from('lead_segments')
        .select('id, code, branch, region, is_active')

      if (error) {
        throw new Error(`Error fetching all segments: ${error.message}`)
      }

      return data || []
    } catch (error) {
      logger.error('Error in fetchAllSegments:', error)
      throw error
    }
  }

  /**
   * Maak een segment aan op basis van capacity combo
   * @param {Object} combo - { branch, region, capacity_partners, capacity_total_leads }
   * @returns {Promise<Object>} Aangemaakt segment
   */
  static async createSegmentFromCapacityCombo(combo) {
    try {
      const normalizedBranch = combo.branch.toLowerCase().trim()
      const normalizedRegion = combo.region.toLowerCase().trim()
      
      const segment = await LeadSegmentService.findOrCreateSegment(
        normalizedBranch,
        normalizedRegion,
        'NL'
      )

      return segment
    } catch (error) {
      logger.error(`Error creating segment for ${combo.branch}/${combo.region}:`, error)
      throw error
    }
  }

  /**
   * Activeer een segment (zet is_active = true)
   * @param {string} segmentId - UUID van het segment
   * @returns {Promise<void>}
   */
  static async activateSegment(segmentId) {
    try {
      const { error } = await supabaseAdmin
        .from('lead_segments')
        .update({ is_active: true })
        .eq('id', segmentId)

      if (error) {
        throw new Error(`Error activating segment: ${error.message}`)
      }
    } catch (error) {
      logger.error(`Error activating segment ${segmentId}:`, error)
      throw error
    }
  }

  /**
   * Deactiveer een segment (zet is_active = false)
   * @param {string} segmentId - UUID van het segment
   * @returns {Promise<void>}
   */
  static async deactivateSegment(segmentId) {
    try {
      const { error } = await supabaseAdmin
        .from('lead_segments')
        .update({ is_active: false })
        .eq('id', segmentId)

      if (error) {
        throw new Error(`Error deactivating segment: ${error.message}`)
      }
    } catch (error) {
      logger.error(`Error deactivating segment ${segmentId}:`, error)
      throw error
    }
  }

  /**
   * Sync alle segmenten op basis van capacity (actieve partners met leads)
   * 
   * Dit is de nieuwe, primaire sync methode die alleen segmenten aanmaakt/behoudt
   * waar daadwerkelijk capacity is (partners die leads willen).
   * 
   * @returns {Promise<Object>} Sync resultaat met statistieken
   */
  static async syncSegmentsFromCapacity() {
    try {
      logger.info('🔄 Starting capacity-based segment sync...')

      // 1. Haal alle (branch, region) combinaties op waar capacity > 0 (1 bulk query)
      const combos = await this.fetchBranchRegionCapacityCombos()
      logger.info(`Found ${combos.length} (branch, region) combinations with capacity > 0`)

      if (combos.length === 0) {
        logger.warn('No capacity combinations found - no segments will be created')
        return {
          success: true,
          segmentsCreated: 0,
          segmentsActivated: 0,
          segmentsDeactivated: 0,
          segmentsExisting: 0,
          totalCombinations: 0
        }
      }

      // 2. Haal alle bestaande segmenten op (1 bulk query)
      const existingSegments = await this.fetchAllSegments()
      logger.info(`Found ${existingSegments.length} existing segments in database`)

      // 3. Bouw lookup maps in memory voor snelle access
      const existingByKey = new Map()
      for (const seg of existingSegments) {
        const key = `${seg.branch}|${seg.region}`
        existingByKey.set(key, seg)
      }

      const capacityKeys = new Set()
      const segmentsToCreate = []
      const segmentsToActivate = []

      // 4. Loop over capacity combos en bepaal welke segmenten nodig zijn
      for (const combo of combos) {
        const key = `${combo.branch}|${combo.region}`
        capacityKeys.add(key)

        const existing = existingByKey.get(key)

        if (!existing) {
          // Segment bestaat niet → aanmaken
          segmentsToCreate.push(combo)
        } else if (existing.is_active === false) {
          // Segment bestaat maar is inactief → activeren
          segmentsToActivate.push(existing.id)
        }
        // Als segment bestaat en actief is → niets doen
      }

      // 5. Maak nieuwe segmenten aan (batch processing voor performance)
      let segmentsCreated = 0
      const createErrors = []

      for (const combo of segmentsToCreate) {
        try {
          await this.createSegmentFromCapacityCombo(combo)
          segmentsCreated++
        } catch (error) {
          logger.error(`Error creating segment for ${combo.branch}/${combo.region}:`, error)
          createErrors.push({ combo, error: error.message })
        }
      }

      // 6. Activeer inactieve segmenten (batch update voor performance)
      let segmentsActivated = 0
      const activateErrors = []

      if (segmentsToActivate.length > 0) {
        // Bulk update voor betere performance
        const { error: bulkError } = await supabaseAdmin
          .from('lead_segments')
          .update({ is_active: true })
          .in('id', segmentsToActivate)

        if (bulkError) {
          logger.error('Error in bulk activate:', bulkError)
          // Fallback: individueel activeren
          for (const segmentId of segmentsToActivate) {
            try {
              await this.activateSegment(segmentId)
              segmentsActivated++
            } catch (error) {
              activateErrors.push({ segmentId, error: error.message })
            }
          }
        } else {
          segmentsActivated = segmentsToActivate.length
        }
      }

      // 7. Deactiveer segmenten zonder capacity
      const segmentsToDeactivate = existingSegments
        .filter(seg => {
          const key = `${seg.branch}|${seg.region}`
          return !capacityKeys.has(key) && seg.is_active === true
        })
        .map(seg => seg.id)

      let segmentsDeactivated = 0
      const deactivateErrors = []

      if (segmentsToDeactivate.length > 0) {
        // Bulk update voor betere performance
        const { error: bulkError } = await supabaseAdmin
          .from('lead_segments')
          .update({ is_active: false })
          .in('id', segmentsToDeactivate)

        if (bulkError) {
          logger.error('Error in bulk deactivate:', bulkError)
          // Fallback: individueel deactiveren
          for (const segmentId of segmentsToDeactivate) {
            try {
              await this.deactivateSegment(segmentId)
              segmentsDeactivated++
            } catch (error) {
              deactivateErrors.push({ segmentId, error: error.message })
            }
          }
        } else {
          segmentsDeactivated = segmentsToDeactivate.length
        }
      }

      const segmentsExisting = combos.length - segmentsCreated - segmentsToActivate.length

      logger.info(`✅ Capacity-based segment sync completed:`)
      logger.info(`   - ${combos.length} combinations with capacity`)
      logger.info(`   - ${segmentsCreated} new segments created`)
      logger.info(`   - ${segmentsActivated} segments activated`)
      logger.info(`   - ${segmentsDeactivated} segments deactivated`)
      logger.info(`   - ${segmentsExisting} segments already existed and active`)

      return {
        success: true,
        segmentsCreated,
        segmentsActivated,
        segmentsDeactivated,
        segmentsExisting,
        totalCombinations: combos.length,
        errors: (createErrors.length + activateErrors.length + deactivateErrors.length > 0)
          ? { create: createErrors, activate: activateErrors, deactivate: deactivateErrors }
          : undefined
      }

    } catch (error) {
      logger.error('Error in syncSegmentsFromCapacity:', error)
      throw error
    }
  }

  /**
   * Sync alle segmenten op basis van actieve user preferences
   * 
   * LEGACY: Deze functie wordt niet meer gebruikt in de cron job.
   * Blijft beschikbaar voor backward compatibility en handmatige calls.
   * 
   * @returns {Promise<Object>} Sync resultaat met statistieken
   */
  static async syncSegmentsFromUserPreferences() {
    try {
      logger.info('🔄 Starting segment sync from user preferences...')
      
      // 1. Haal alle actieve users op
      const { data: activeUsers, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('is_active_for_routing', true)
        .eq('is_admin', false)
      
      if (usersError) {
        throw new Error(`Error fetching active users: ${usersError.message}`)
      }
      
      if (!activeUsers || activeUsers.length === 0) {
        logger.warn('No active users found for segment sync')
        return {
          success: true,
          usersProcessed: 0,
          segmentsCreated: 0,
          segmentsExisting: 0,
          totalCombinations: 0
        }
      }
      
      logger.info(`Found ${activeUsers.length} active users`)
      
      // 2. Haal alle enabled industry preferences op
      const { data: industryPrefs, error: industryError } = await supabaseAdmin
        .from('user_industry_preferences')
        .select(`
          user_id,
          industry_id,
          is_enabled,
          industries!inner (
            id,
            name
          )
        `)
        .eq('is_enabled', true)
      
      if (industryError) {
        throw new Error(`Error fetching industry preferences: ${industryError.message}`)
      }
      
      // 3. Haal alle enabled location preferences op (of gebruik profiles.lead_locations als fallback)
      const { data: locationPrefs, error: locationError } = await supabaseAdmin
        .from('user_location_preferences')
        .select('user_id, location_code, is_enabled')
        .eq('is_enabled', true)
      
      // Fallback naar profiles.lead_locations als user_location_preferences niet bestaat
      let userLocations = {}
      if (locationError && locationError.code === '42P01') {
        // Table doesn't exist, use profiles.lead_locations
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('id, lead_locations')
          .not('lead_locations', 'is', null)
        
        if (!profilesError && profiles) {
          profiles.forEach(profile => {
            if (profile.lead_locations && profile.lead_locations.length > 0) {
              userLocations[profile.id] = profile.lead_locations
            }
          })
        }
      } else if (!locationError && locationPrefs) {
        // Use user_location_preferences
        locationPrefs.forEach(pref => {
          if (!userLocations[pref.user_id]) {
            userLocations[pref.user_id] = []
          }
          userLocations[pref.user_id].push(pref.location_code)
        })
      }
      
      // 4. Maak een Set van alle unieke (industry, location) combinaties
      const combinations = new Set()
      const industryMap = {}
      
      // Map industries
      if (industryPrefs) {
        industryPrefs.forEach(pref => {
          if (!industryMap[pref.user_id]) {
            industryMap[pref.user_id] = []
          }
          if (pref.industries) {
            industryMap[pref.user_id].push(pref.industries.name)
          }
        })
      }
      
      // Combine industries met locations
      Object.keys(industryMap).forEach(userId => {
        const industries = industryMap[userId]
        const locations = userLocations[userId] || []
        
        industries.forEach(industry => {
          if (locations.length > 0) {
            locations.forEach(location => {
              // Normalize industry name (plural -> singular)
              const normalizedIndustry = this.normalizeIndustryName(industry)
              const combination = `${normalizedIndustry}|${location.toLowerCase()}`
              combinations.add(combination)
            })
          } else {
            // Als user geen locations heeft, skip (of gebruik default?)
            logger.debug(`User ${userId} has industry ${industry} but no locations`)
          }
        })
      })
      
      logger.info(`Found ${combinations.size} unique (industry, location) combinations`)
      
      // 5. Haal eerst alle bestaande segmenten op om te checken welke nieuw zijn
      const { data: existingSegments, error: existingError } = await supabaseAdmin
        .from('lead_segments')
        .select('code')
        .eq('is_active', true)
      
      const existingSegmentCodes = new Set((existingSegments || []).map(s => s.code))
      
      // 6. Voor elke combinatie: findOrCreateSegment
      let segmentsCreated = 0
      let segmentsExisting = 0
      const errors = []
      
      for (const combination of combinations) {
        try {
          const [industryName, region] = combination.split('|')
          
          // Generate expected code
          const expectedCode = `${industryName}_${region}`.replace(/[^a-z0-9_]/g, '_')
          
          // Check if segment already exists
          const segmentExists = existingSegmentCodes.has(expectedCode)
          
          const segment = await LeadSegmentService.findOrCreateSegment(
            industryName,
            region,
            'NL'
          )
          
          if (segmentExists) {
            segmentsExisting++
          } else {
            segmentsCreated++
            // Add to set for next iterations
            existingSegmentCodes.add(segment.code)
          }
          
        } catch (error) {
          logger.error(`Error creating segment for ${combination}:`, error)
          errors.push({ combination, error: error.message })
        }
      }
      
      logger.info(`✅ Segment sync completed: ${combinations.size} combinations processed, ${segmentsCreated} new segments created, ${segmentsExisting} already existed`)
      
      return {
        success: true,
        usersProcessed: activeUsers.length,
        segmentsCreated: segmentsCreated,
        segmentsExisting: segmentsExisting,
        totalCombinations: combinations.size,
        errors: errors.length > 0 ? errors : undefined
      }
      
    } catch (error) {
      logger.error('Error in syncSegmentsFromUserPreferences:', error)
      throw error
    }
  }
  
  /**
   * Normalize industry name (plural -> singular)
   * Bijv. "Schilders" -> "schilder", "Dakdekkers" -> "dakdekker"
   */
  static normalizeIndustryName(industryName) {
    if (!industryName) return ''
    
    const name = industryName.toLowerCase().trim()
    
    // Common plural -> singular mappings
    const mappings = {
      'schilders': 'schilder',
      'dakdekkers': 'dakdekker',
      'loodgieters': 'loodgieter',
      'elektriciens': 'electricien',
      'glaszetters': 'glaszetter',
      'timmermannen': 'timmerman',
      'metselaars': 'metselaar',
      'stukadoors': 'stukadoor',
      'verwarmingsmonteurs': 'verwarmingsmonteur',
      'cv-monteurs': 'cv-monteur'
    }
    
    return mappings[name] || name
  }
  
  /**
   * Sync segmenten voor een specifieke user
   * Wordt aangeroepen na het updaten van user preferences
   * @param {string} userId - User ID
   */
  /**
   * Sync segmenten voor een specifieke gebruiker
   * 
   * NOTE: Deze functie wordt aangeroepen wanneer een gebruiker zijn voorkeuren update.
   * We gebruiken nu capacity-based logica: alleen segmenten aanmaken als de gebruiker
   * een actieve betaalmethode heeft EN capacity > 0.
   * 
   * @param {string} userId - UUID van de gebruiker
   * @returns {Promise<Object>} Sync resultaat
   */
  static async syncSegmentsForUser(userId) {
    try {
      logger.info(`🔄 Syncing segments for user ${userId}...`)
      
      // CRITICAL: Check eerst of gebruiker een actieve betaalmethode heeft
      // Alleen betalende partners mogen segmenten aanmaken
      const { data: paymentMethods, error: pmError } = await supabaseAdmin
        .from('payment_methods')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
      
      if (pmError) {
        logger.warn(`Error checking payment methods for user ${userId}:`, pmError)
      }
      
      if (!paymentMethods || paymentMethods.length === 0) {
        logger.info(`⏭️ Skipping segment sync for user ${userId}: no active payment method`)
        return {
          success: true,
          segmentsCreated: 0,
          segmentCodes: [],
          reason: 'no_payment_method'
        }
      }
      
      // Check ook of gebruiker capacity heeft (subscription of max_open_leads > 0)
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('max_open_leads')
        .eq('id', userId)
        .single()
      
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('leads_per_month')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('is_paused', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      const capacity = subscription?.leads_per_month || profile?.max_open_leads || 0
      
      if (capacity <= 0) {
        logger.info(`⏭️ Skipping segment sync for user ${userId}: no capacity (${capacity})`)
        return {
          success: true,
          segmentsCreated: 0,
          segmentCodes: [],
          reason: 'no_capacity'
        }
      }
      
      // Haal user's enabled industry preferences op
      const { data: industryPrefs, error: industryError } = await supabaseAdmin
        .from('user_industry_preferences')
        .select(`
          industry_id,
          is_enabled,
          industries!inner (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .eq('is_enabled', true)
      
      if (industryError) {
        throw new Error(`Error fetching industry preferences: ${industryError.message}`)
      }
      
      // Haal user's enabled location preferences op
      const { data: locationPrefs, error: locationError } = await supabaseAdmin
        .from('user_location_preferences')
        .select('location_code, is_enabled')
        .eq('user_id', userId)
        .eq('is_enabled', true)
      
      // Fallback naar profiles.lead_locations
      let locations = []
      if (locationError && locationError.code === '42P01') {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('lead_locations')
          .eq('id', userId)
          .single()
        
        if (!profileError && profile?.lead_locations) {
          locations = profile.lead_locations
        }
      } else if (!locationError && locationPrefs) {
        locations = locationPrefs.map(pref => pref.location_code)
      }
      
      // Maak segmenten voor alle combinaties
      const segmentsCreated = []
      
      if (industryPrefs && industryPrefs.length > 0 && locations.length > 0) {
        for (const industryPref of industryPrefs) {
          const industryName = industryPref.industries?.name
          if (!industryName) continue
          
          const normalizedIndustry = this.normalizeIndustryName(industryName)
          
          for (const location of locations) {
            try {
              const segment = await LeadSegmentService.findOrCreateSegment(
                normalizedIndustry,
                location.toLowerCase(),
                'NL'
              )
              segmentsCreated.push(segment.code)
            } catch (error) {
              logger.error(`Error creating segment for user ${userId}, industry ${industryName}, location ${location}:`, error)
            }
          }
        }
      }
      
      logger.info(`✅ Synced ${segmentsCreated.length} segments for user ${userId}`)
      
      return {
        success: true,
        segmentsCreated: segmentsCreated.length,
        segmentCodes: segmentsCreated
      }
      
    } catch (error) {
      logger.error(`Error syncing segments for user ${userId}:`, error)
      throw error
    }
  }
}

module.exports = SegmentSyncService

