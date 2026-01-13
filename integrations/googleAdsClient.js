'use strict'

// Only load dotenv locally (Vercel uses environment variables directly)
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  require('dotenv').config()
}
const { GoogleAdsApi } = require('google-ads-api')
const { supabaseAdmin } = require('../config/supabase')

/**
 * Google Ads API Client
 * 
 * Echte Google Ads API integratie voor budget management en campaign stats
 * Met retry logic, error handling en campaign mapping support
 */
class GoogleAdsClient {
  static client = null
  static customerId = null
  static MAX_RETRIES = 3
  static RETRY_DELAY = 1000 // ms

  /**
   * Get active customer account from database
   * @returns {Promise<string|null>} Customer ID or null
   */
  static async getActiveCustomerAccount() {
    try {
      const { data: accounts, error } = await supabaseAdmin
        .from('google_ads_accounts')
        .select('customer_id, is_manager_account')
        .eq('is_active', true)
        .eq('is_manager_account', false) // Get customer accounts, not MCC
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error || !accounts || accounts.length === 0) {
        return null
      }
      
      return accounts[0].customer_id
    } catch (error) {
      console.error('❌ Error fetching customer account from database:', error)
      return null
    }
  }

  /**
   * Get Manager Account (MCC) ID from database or env
   * @param {boolean} skipEnvFallback - If true, don't fallback to env var (for checking if MCC exists in DB)
   * @returns {Promise<string|null>} MCC ID or null
   */
  static async getManagerAccountId(skipEnvFallback = false) {
    try {
      // First try to get from database
      const { data: accounts, error } = await supabaseAdmin
        .from('google_ads_accounts')
        .select('customer_id')
        .eq('is_active', true)
        .eq('is_manager_account', true)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (!error && accounts && accounts.length > 0) {
        return accounts[0].customer_id
      }
      
      // Only fallback to env var if skipEnvFallback is false
      if (!skipEnvFallback) {
      return process.env.GOOGLE_ADS_CUSTOMER_ID || null
      }
      
      return null
    } catch (error) {
      console.error('❌ Error fetching manager account from database:', error)
      // Only fallback to env var if skipEnvFallback is false
      if (!skipEnvFallback) {
      return process.env.GOOGLE_ADS_CUSTOMER_ID || null
      }
      return null
    }
  }

  /**
   * Initialize Google Ads API client
   * @param {string} customerId - Optional customer ID (defaults to database or env var)
   * @returns {Object|null} Customer instance or null
   */
  static async initialize(customerId = null) {
    if (this.client && !customerId) {
      return this.getCustomer()
    }

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

    if (!developerToken || !clientId || !clientSecret || !refreshToken) {
      console.warn('⚠️ Google Ads API credentials not configured. Using placeholder mode.')
      return null
    }

    try {
      // Initialize client (singleton)
      if (!this.client) {
        this.client = new GoogleAdsApi({
          client_id: clientId,
          client_secret: clientSecret,
          developer_token: developerToken,
        })
      }

      // Determine customer ID and manager account ID
      let targetCustomerId = customerId
      let managerAccountId = null

      console.log(`🔍 Initializing Google Ads client - customerId param: ${customerId}`)

      if (!targetCustomerId) {
        // Try to get customer account from database first
        targetCustomerId = await this.getActiveCustomerAccount()
        console.log(`🔍 Customer account from DB: ${targetCustomerId}`)
        
        // If no customer account found, use env var (might be MCC)
        if (!targetCustomerId) {
          targetCustomerId = process.env.GOOGLE_ADS_CUSTOMER_ID
          console.log(`🔍 Using env var GOOGLE_ADS_CUSTOMER_ID as customer: ${targetCustomerId}`)
        }
      }

      // Get manager account ID (MCC) for login_customer_id
      managerAccountId = await this.getManagerAccountId()
      console.log(`🔍 Manager Account from getManagerAccountId(): ${managerAccountId}`)
      
      // CRITICAL: Check if we actually have a Manager Account in the database
      // If not, and the customer ID is from env var, it might be a Manager Account
      // But if customer ID is from database (client customer), we MUST have a separate Manager Account
      const customerIdFromDb = await this.getActiveCustomerAccount()
      const managerIdFromDb = await this.getManagerAccountId(true) // Skip env fallback to check DB only
      
      console.log(`🔍 Customer from DB: ${customerIdFromDb}, Manager from DB (no env): ${managerIdFromDb}`)
      
      if (customerIdFromDb && !managerIdFromDb) {
        // We have a customer account from DB but no Manager Account
        // This will likely fail - warn the user
        console.error(`❌ WARNING: Customer Account found in database (${customerIdFromDb}) but no Manager Account (MCC) found in database`)
        console.error(`❌ Google Ads requires a Manager Account (MCC) to access client customer accounts`)
        console.error(`❌ Please add a Manager Account to google_ads_accounts table with is_manager_account=true`)
      }
      
      // If we have a customer account but no MCC in DB, try env var as fallback
      // BUT: Only if the customer ID is NOT from env var (to avoid using same ID)
      if (!managerAccountId && targetCustomerId !== process.env.GOOGLE_ADS_CUSTOMER_ID) {
        managerAccountId = process.env.GOOGLE_ADS_CUSTOMER_ID
        if (managerAccountId) {
          console.log(`ℹ️ Using env var GOOGLE_ADS_CUSTOMER_ID as Manager Account fallback: ${managerAccountId}`)
        }
      }
      
      console.log(`🔍 Final: targetCustomerId=${targetCustomerId}, managerAccountId=${managerAccountId}`)

      if (!targetCustomerId) {
        console.warn('⚠️ No customer account found. Please add a customer account via the admin panel.')
        return null
      }

      const customerIdClean = targetCustomerId.replace(/-/g, ''); // Remove dashes
      const managerIdClean = managerAccountId ? managerAccountId.replace(/-/g, '') : null
      
      // Create customer instance
      // CRITICAL: For Manager Accounts (MCC), we need to set login_customer_id
      // - customer_id: The actual customer account where we create campaigns
      // - login_customer_id: The Manager Account (MCC) that has access to the customer account
      const customerConfig = {
        customer_id: customerIdClean,
        refresh_token: refreshToken
      }
      
      // CRITICAL: Set login_customer_id when using a client customer account
      // Google Ads requires the manager account ID in login_customer_id header when accessing client accounts
      // - customer_id: The actual customer account where we create campaigns
      // - login_customer_id: The Manager Account (MCC) that has access to the customer account
      
      console.log(`🔍 Debug: targetCustomerId=${targetCustomerId}, managerAccountId=${managerAccountId}`)
      console.log(`🔍 Debug: customerIdClean=${customerIdClean}, managerIdClean=${managerIdClean}`)
      
      // Decide whether to force MCC login_customer_id (default OFF to match earlier working behavior)
      const forceMcc = process.env.GOOGLE_ADS_FORCE_MCC === 'true'

      if (managerIdClean) {
        if (forceMcc && managerIdClean !== customerIdClean) {
          customerConfig.login_customer_id = managerIdClean
          console.log(`✅ Using Manager Account (MCC) ${managerIdClean} as login_customer_id for Customer Account ${customerIdClean}`)
      } else {
          console.log(`ℹ️ MCC found (${managerIdClean}) but not forcing login_customer_id (GOOGLE_ADS_FORCE_MCC=${process.env.GOOGLE_ADS_FORCE_MCC || 'false'})`)
          console.log(`ℹ️ Using direct access to Customer Account ${customerIdClean}`)
        }
      } else {
        // No manager account found - log but continue direct (to match previous behavior)
        const msg = [
          'No Manager Account (MCC) found in database or env.',
          `Customer Account: ${customerIdClean}.`,
          'Proceeding without login_customer_id (direct access).'
        ].join(' ')
        console.warn(`⚠️ ${msg}`)
      }
      
      const customer = this.client.Customer(customerConfig)

      // Store customer ID for future use
      if (!customerId) {
        this.customerId = customerIdClean
      }

      console.log(`✅ Google Ads Customer instance created:`)
      console.log(`   - customer_id: ${customerIdClean}`)
      console.log(`   - login_customer_id: ${customerConfig.login_customer_id || 'not set'}`)

      return customer
    } catch (error) {
      console.error('❌ Error initializing Google Ads API client:', error)
      return null
    }
  }

  /**
   * Get customer instance
   * @param {string} customerId - Optional customer ID
   * @returns {Promise<Object|null>} Customer instance or null
   */
  static async getCustomer(customerId = null) {
    // If no customerId provided and client is already initialized, use existing customer
    if (!customerId && this.client && this.customerId) {
      // Re-initialize to ensure we have the latest Manager Account setup
      return await this.initialize(this.customerId)
    }
    
    // Otherwise, initialize with the provided customerId
    return await this.initialize(customerId)
  }

  /**
   * Retry wrapper voor API calls
   * @param {Function} fn - Async function to retry
   * @param {number} retries - Number of retries
   * @returns {Promise} Result
   */
  static async retry(fn, retries = this.MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn()
      } catch (error) {
        if (i === retries - 1) throw error
        
        // Exponential backoff
        const delay = this.RETRY_DELAY * Math.pow(2, i)
        console.warn(`⚠️ Retry ${i + 1}/${retries} after ${delay}ms:`, error.message)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Get campaign ID from database for a segment
   * @param {string} segmentId - Segment UUID
   * @returns {Promise<Object|null>} Campaign info or null
   */
  static async getCampaignFromDatabase(segmentId) {
    try {
      const { data: segment, error } = await supabaseAdmin
        .from('lead_segments')
        .select('google_ads_campaign_id, google_ads_customer_id, code')
        .eq('id', segmentId)
        .single()

      if (error || !segment) {
        return null
      }

      return {
        campaignId: segment.google_ads_campaign_id,
        customerId: segment.google_ads_customer_id,
        segmentCode: segment.code
      }
    } catch (error) {
      console.error('❌ Error getting campaign from database:', error)
      return null
    }
  }

  /**
   * Update campaign budget voor een segment
   * @param {string} segmentId - Segment UUID (preferred) of segmentCode
   * @param {number} dailyBudget - Dagelijks budget in EUR (wordt omgezet naar micros)
   * @param {string} segmentCode - Segment code (fallback if segmentId not provided)
   * @returns {Promise<Object>} Result met success/error
   */
  static async updateCampaignBudget(segmentId, dailyBudget, segmentCode = null) {
    try {
      let campaignId = null
      let customerId = null
      let code = segmentCode

      // Try to get campaign ID from database first
      if (segmentId && segmentId.length > 20) { // Likely a UUID
        const campaignInfo = await this.getCampaignFromDatabase(segmentId)
        if (campaignInfo) {
          campaignId = campaignInfo.campaignId
          customerId = campaignInfo.customerId
          code = campaignInfo.segmentCode
        }
      }

      const customer = await this.getCustomer(customerId)
      
      if (!customer) {
        console.log(`[PLACEHOLDER] Google Ads budget update (API not configured):`)
        console.log(`  Segment: ${code || segmentId}`)
        console.log(`  Daily budget: €${dailyBudget.toFixed(2)}`)
        return {
          success: true,
          campaignId: campaignId || `campaign_${code || segmentId}`,
          message: 'Budget update logged (API not configured)'
        }
      }

      // Convert EUR to micros (1 EUR = 1,000,000 micros)
      const budgetAmountMicros = Math.round(dailyBudget * 1000000)

      // If we have campaign ID from database, use it directly
      if (campaignId) {
        try {
          // Get campaign to find budget ID
          const campaigns = await this.retry(async () => {
            return await customer.query(`
              SELECT 
                campaign.id,
                campaign.campaign_budget
              FROM campaign
              WHERE campaign.id = ${campaignId}
            `)
          })

          if (!campaigns || campaigns.length === 0) {
            throw new Error('Campaign not found')
          }

          const campaign = campaigns[0]
          const budgetId = campaign.campaign.campaign_budget?.split('/').pop()

          // Update budget
          await this.retry(async () => {
            await customer.campaignBudgets.update({
              resource_name: `customers/${customerId || this.customerId}/campaignBudgets/${budgetId}`,
              amount_micros: budgetAmountMicros,
              delivery_method: 'STANDARD'
            })
          })

          console.log(`✅ Google Ads budget updated:`)
          console.log(`   Campaign ID: ${campaignId}`)
          console.log(`   Budget: €${dailyBudget.toFixed(2)} (${budgetAmountMicros} micros)`)

          return {
            success: true,
            campaignId: campaignId,
            budgetId: budgetId,
            message: 'Budget updated successfully'
          }
        } catch (error) {
          console.warn(`⚠️ Failed to update using campaign ID, trying name search:`, error.message)
          // Fall through to name search
        }
      }

      // Fallback: Find campaign by segment code in name
      if (!code) {
        return {
          success: false,
          error: 'No campaign ID or segment code provided'
        }
      }

      const campaigns = await this.retry(async () => {
        return await customer.query(`
          SELECT 
            campaign.id,
            campaign.name,
            campaign.campaign_budget
          FROM campaign
          WHERE campaign.name LIKE '%${code}%'
            AND campaign.status = 'ENABLED'
          LIMIT 1
        `)
      })

      if (!campaigns || campaigns.length === 0) {
        console.warn(`⚠️ No campaign found for segment: ${code}`)
        return {
          success: false,
          error: `No campaign found for segment: ${code}`
        }
      }

      const campaign = campaigns[0]
      const budgetId = campaign.campaign.campaign_budget?.split('/').pop()
      const targetCustomerId = customerId || this.customerId

      // Update budget
      await this.retry(async () => {
        await customer.campaignBudgets.update({
          resource_name: `customers/${targetCustomerId}/campaignBudgets/${budgetId}`,
          amount_micros: budgetAmountMicros,
          delivery_method: 'STANDARD'
        })
      })

      console.log(`✅ Google Ads budget updated:`)
      console.log(`   Campaign: ${campaign.campaign.name} (ID: ${campaign.campaign.id})`)
      console.log(`   Budget: €${dailyBudget.toFixed(2)} (${budgetAmountMicros} micros)`)

      // Update database with campaign ID if we found it
      if (segmentId && segmentId.length > 20 && !campaignId) {
        await supabaseAdmin
          .from('lead_segments')
          .update({
            google_ads_campaign_id: campaign.campaign.id.toString(),
            google_ads_customer_id: targetCustomerId,
            google_ads_last_synced_at: new Date().toISOString()
          })
          .eq('id', segmentId)
      }

      return {
        success: true,
        campaignId: campaign.campaign.id.toString(),
        budgetId: budgetId,
        message: 'Budget updated successfully'
      }
    } catch (error) {
      console.error('❌ Error updating Google Ads budget:', error)
      return {
        success: false,
        error: error.message || 'Failed to update budget'
      }
    }
  }

  /**
   * Haal campaign budget op
   * @param {string} segmentCode - Segment code
   * @returns {Promise<number>} Huidig budget in EUR
   */
  static async getCampaignBudget(segmentCode) {
    try {
      const customer = await this.getCustomer()
      
      if (!customer) {
        return 0
      }

      // Find campaign by segment code
      const campaigns = await this.retry(async () => {
        return await customer.query(`
          SELECT 
            campaign.id,
            campaign.campaign_budget
          FROM campaign
          WHERE campaign.name LIKE '%${segmentCode}%'
            AND campaign.status = 'ENABLED'
          LIMIT 1
        `)
      })

      if (!campaigns || campaigns.length === 0) {
        return 0
      }

      const campaign = campaigns[0]
      const budgetId = campaign.campaign.campaign_budget?.split('/').pop()

      if (!budgetId) {
        return 0
      }

      // Get budget
      const budgets = await this.retry(async () => {
        return await customer.query(`
          SELECT 
            campaign_budget.id,
            campaign_budget.amount_micros
          FROM campaign_budget
          WHERE campaign_budget.id = ${budgetId}
        `)
      })

      if (!budgets || budgets.length === 0) {
        return 0
      }

      const budget = budgets[0]
      // Convert micros to EUR
      return (budget.campaign_budget?.amount_micros || 0) / 1000000
    } catch (error) {
      console.error('❌ Error getting Google Ads budget:', error)
      return 0
    }
  }

  /**
   * Haal campaign stats op (spend, clicks, impressions)
   * @param {string} segmentCode - Segment code
   * @param {Date} date - Datum
   * @returns {Promise<Object>} Stats object
   */
  static async getCampaignStats(segmentCode, date) {
    try {
      const customer = await this.getCustomer()
      
      if (!customer) {
        return {
          spend: 0,
          clicks: 0,
          impressions: 0
        }
      }

      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD

      // Find campaign by segment code
      const campaigns = await this.retry(async () => {
        return await customer.query(`
          SELECT 
            campaign.id,
            campaign.name
          FROM campaign
          WHERE campaign.name LIKE '%${segmentCode}%'
            AND campaign.status = 'ENABLED'
          LIMIT 1
        `)
      })

      if (!campaigns || campaigns.length === 0) {
        return {
          spend: 0,
          clicks: 0,
          impressions: 0
        }
      }

      const campaign = campaigns[0]

      // Get metrics for the date
      const report = await this.retry(async () => {
        return await customer.query(`
          SELECT 
            campaign.id,
            campaign.name,
            metrics.cost_micros,
            metrics.clicks,
            metrics.impressions
          FROM campaign
          WHERE campaign.id = ${campaign.campaign.id}
            AND segments.date = '${dateStr}'
        `)
      })

      if (!report || report.length === 0) {
        return {
          spend: 0,
          clicks: 0,
          impressions: 0
        }
      }

      const row = report[0]
      
      return {
        spend: (row.metrics?.cost_micros || 0) / 1000000, // Convert micros to EUR
        clicks: row.metrics?.clicks || 0,
        impressions: row.metrics?.impressions || 0
      }
    } catch (error) {
      console.error('❌ Error getting Google Ads stats:', error)
      return {
        spend: 0,
        clicks: 0,
        impressions: 0
      }
    }
  }

  /**
   * Get all campaigns (ENABLED and PAUSED, excluding REMOVED)
   * @param {string} customerId - Optional customer ID
   * @returns {Promise<Array>} Array of campaigns
   */
  static async getActiveCampaigns(customerId = null) {
    try {
      const customer = await this.getCustomer(customerId)
      
      if (!customer) {
        return []
      }

      const campaigns = await this.retry(async () => {
        return await customer.query(`
          SELECT 
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.campaign_budget
          FROM campaign
          WHERE campaign.status IN ('ENABLED', 'PAUSED')
        `)
      })

      return campaigns.map(campaign => ({
        id: campaign.campaign.id.toString(),
        name: campaign.campaign.name,
        budgetId: campaign.campaign.campaign_budget?.split('/').pop(),
        status: campaign.campaign.status,
        resourceName: `customers/${customerId || this.customerId}/campaigns/${campaign.campaign.id}`
      }))
    } catch (error) {
      console.error('❌ Error getting campaigns:', error)
      return []
    }
  }

  /**
   * Sync campaigns from Google Ads to database
   * Maps campaigns to segments based on campaign name containing segment code
   * @param {string} customerId - Optional customer ID
   * @returns {Promise<Object>} Sync result
   */
  static async syncCampaignsToDatabase(customerId = null) {
    try {
      const campaigns = await this.getActiveCampaigns(customerId)
      
      if (campaigns.length === 0) {
        return {
          success: true,
          synced: 0,
          message: 'No active campaigns found'
        }
      }

      // Get all active segments
      const { data: segments, error: segmentsError } = await supabaseAdmin
        .from('lead_segments')
        .select('id, code, branch, region')
        .eq('is_active', true)

      if (segmentsError) {
        throw new Error(`Error fetching segments: ${segmentsError.message}`)
      }

      let synced = 0
      const targetCustomerId = customerId || this.customerId
      const syncedCampaigns = []
      const unlinkedCampaigns = []
      const errors = []

      // Match campaigns to segments
      for (const campaign of campaigns) {
        // Try to find matching segment by code in campaign name
        const matchingSegment = segments.find(segment => 
          campaign.name.toLowerCase().includes(segment.code.toLowerCase())
        )

        if (matchingSegment) {
          // Update segment with campaign info
          const { error: updateError } = await supabaseAdmin
            .from('lead_segments')
            .update({
              google_ads_campaign_id: campaign.id.toString(),
              google_ads_campaign_name: campaign.name,
              google_ads_budget_id: campaign.budgetId,
              google_ads_customer_id: targetCustomerId,
              google_ads_last_synced_at: new Date().toISOString()
            })
            .eq('id', matchingSegment.id)

          if (!updateError) {
            synced++
            syncedCampaigns.push({
              campaignId: campaign.id,
              campaignName: campaign.name,
              segmentId: matchingSegment.id,
              segmentCode: matchingSegment.code
            })
            console.log(`✅ Synced campaign "${campaign.name}" to segment "${matchingSegment.code}"`)
          } else {
            errors.push({
              campaignId: campaign.id,
              campaignName: campaign.name,
              error: updateError.message
            })
            console.warn(`⚠️ Error syncing campaign "${campaign.name}":`, updateError.message)
          }
        } else {
          unlinkedCampaigns.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            reason: 'No matching segment found (campaign name does not contain segment code)'
          })
        }
      }

      return {
        success: true,
        synced,
        totalCampaigns: campaigns.length,
        totalSegments: segments.length,
        syncedCampaigns,
        unlinkedCampaigns,
        errors,
        message: `Synced ${synced} of ${campaigns.length} campaigns to segments`
      }
    } catch (error) {
      console.error('❌ Error syncing campaigns:', error)
      return {
        success: false,
        error: error.message || 'Failed to sync campaigns'
      }
    }
  }

  /**
   * Get campaign budget by campaign ID
   * @param {string} campaignId - Campaign ID
   * @param {string} customerId - Optional customer ID
   * @returns {Promise<number>} Budget in EUR
   */
  static async getCampaignBudgetById(campaignId, customerId = null) {
    try {
      const customer = await this.getCustomer(customerId)
      
      if (!customer) {
        return 0
      }

      const targetCustomerId = customerId || this.customerId

      const campaigns = await this.retry(async () => {
        return await customer.query(`
          SELECT 
            campaign.id,
            campaign.campaign_budget
          FROM campaign
          WHERE campaign.id = ${campaignId}
        `)
      })

      if (!campaigns || campaigns.length === 0 || !campaigns[0].campaign.campaign_budget) {
        return 0
      }

      const campaign = campaigns[0]
      const budgetId = campaign.campaign.campaign_budget.split('/').pop()
      
      const budgets = await this.retry(async () => {
        return await customer.query(`
          SELECT 
            campaign_budget.id,
            campaign_budget.amount_micros
          FROM campaign_budget
          WHERE campaign_budget.id = ${budgetId}
        `)
      })

      if (!budgets || budgets.length === 0) {
        return 0
      }

      const budget = budgets[0]
      // Convert micros to EUR
      return (budget.campaign_budget?.amount_micros || 0) / 1000000
    } catch (error) {
      console.error('❌ Error getting campaign budget by ID:', error)
      return 0
    }
  }

  /**
   * Create a new Google Ads campaign
   * @param {Object} config - Campaign configuration
   * @param {string} config.campaignName - Campaign name (should include segment code)
   * @param {number} config.dailyBudget - Daily budget in EUR
   * @param {string} config.customerId - Optional customer ID
   * @param {string} config.advertisingChannelType - Campaign type (default: 'SEARCH')
   * @param {Array} config.targetLocations - Array of location codes (e.g., ['NL'])
   * @param {string} config.landingPageUrl - Landing page URL
   * @returns {Promise<Object>} Created campaign info
   */
  static async createCampaign(config) {
    try {
      const {
        campaignName,
        dailyBudget,
        customerId = null,
        advertisingChannelType = 'SEARCH',
        targetLocations = ['NL'],
        landingPageUrl = null
      } = config

      if (!campaignName || !dailyBudget) {
        throw new Error('Campaign name and daily budget are required')
      }

      const customer = await this.getCustomer(customerId)
      if (!customer) {
        throw new Error('Google Ads API client not initialized')
      }

      const targetCustomerId = customerId || this.customerId

      // Convert budget to micros
      const budgetAmountMicros = Math.round(dailyBudget * 1000000)

      // Create campaign budget first
      const budgetResourceName = await this.retry(async () => {
        const budgetResult = await customer.campaignBudgets.create({
          name: `Budget ${campaignName}`,
          amount_micros: budgetAmountMicros,
          delivery_method: 'STANDARD'
        })
        return budgetResult.resource_name
      })

      console.log(`✅ Created campaign budget: ${budgetResourceName}`)

      // Create campaign
      const campaignResourceName = await this.retry(async () => {
        const campaignResult = await customer.campaigns.create({
          name: campaignName,
          advertising_channel_type: advertisingChannelType,
          status: 'PAUSED', // Start paused, activate after setup
          campaign_budget: budgetResourceName,
          manual_cpc: {
            enhanced_cpc_enabled: true
          },
          // Target locations
          geo_target_type_setting: {
            positive_geo_target_type: 'PRESENCE_OR_INTEREST',
            negative_geo_target_type: 'PRESENCE'
          }
        })
        return campaignResult.resource_name
      })

      console.log(`✅ Created campaign: ${campaignResourceName}`)

      // Extract campaign ID from resource name
      const campaignId = campaignResourceName.split('/').pop()
      const budgetId = budgetResourceName.split('/').pop()

      // Add location targeting if specified
      if (targetLocations && targetLocations.length > 0) {
        // Note: Location targeting requires additional setup with geo_target_constants
        // For now, we'll create the campaign and location targeting can be added manually
        // or via a separate method
        console.log(`ℹ️ Location targeting for ${targetLocations.join(', ')} should be configured separately`)
      }

      return {
        success: true,
        campaignId: campaignId,
        campaignName: campaignName,
        budgetId: budgetId,
        resourceName: campaignResourceName,
        budgetResourceName: budgetResourceName,
        dailyBudget: dailyBudget,
        status: 'PAUSED',
        message: 'Campaign created successfully (paused - activate after setup)'
      }
    } catch (error) {
      console.error('❌ Error creating Google Ads campaign:', error)
      return {
        success: false,
        error: error.message || 'Failed to create campaign'
      }
    }
  }

  /**
   * Update campaign status (PAUSED, ENABLED, REMOVED)
   * @param {string} campaignId - Campaign ID
   * @param {string} status - New status ('PAUSED', 'ENABLED', 'REMOVED')
   * @param {string} customerId - Optional customer ID
   * @returns {Promise<Object>} Update result
   */
  static async updateCampaignStatus(campaignId, status, customerId = null) {
    try {
      if (!['PAUSED', 'ENABLED', 'REMOVED'].includes(status)) {
        throw new Error('Invalid status. Must be PAUSED, ENABLED, or REMOVED')
      }

      const customer = await this.getCustomer(customerId)
      if (!customer) {
        throw new Error('Google Ads API client not initialized')
      }

      const targetCustomerId = customerId || this.customerId
      const campaignResourceName = `customers/${targetCustomerId}/campaigns/${campaignId}`

      // Update campaign status
      await this.retry(async () => {
        await customer.campaigns.update({
          resource_name: campaignResourceName,
          status: status
        })
      })

      console.log(`✅ Campaign ${campaignId} status updated to ${status}`)

      return {
        success: true,
        campaignId: campaignId,
        status: status,
        message: `Campaign status updated to ${status}`
      }
    } catch (error) {
      console.error('❌ Error updating campaign status:', error)
      return {
        success: false,
        error: error.message || 'Failed to update campaign status'
      }
    }
  }
}

module.exports = GoogleAdsClient
