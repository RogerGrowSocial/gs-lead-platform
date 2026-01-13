'use strict'

const { supabaseAdmin } = require('../config/supabase')
const UserRiskAssessmentService = require('./userRiskAssessmentService')
const { Client } = require('pg')
const logger = require('../utils/logger')

/**
 * Risk Assessment Worker
 * 
 * Listens to PostgreSQL NOTIFY events and executes risk assessments
 * when profiles are created or updated with relevant data.
 */
class RiskAssessmentWorker {
  constructor() {
    this.client = null
    this.isListening = false
    this.processingQueue = new Set() // Track users being processed to avoid duplicates
    this.hasWarnedAboutMissingDbUrl = false // Track if we've already warned about missing DB URL
  }

  /**
   * Initialize PostgreSQL connection for LISTEN
   */
  async initialize() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL environment variable is required')
      }

      // Extract database connection details from Supabase URL
      // Supabase URL format: https://xxx.supabase.co
      // We need to connect to: postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres
      
      // Try to get database URL from multiple sources:
      // 1. SUPABASE_DB_URL (full connection string)
      // 2. DATABASE_URL (full connection string)
      // 3. Construct from SUPABASE_URL + SUPABASE_DB_PASSWORD
      let dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
      
      if (!dbUrl) {
        // Try to construct from SUPABASE_URL and SUPABASE_DB_PASSWORD
        const dbPassword = process.env.SUPABASE_DB_PASSWORD
        if (dbPassword && supabaseUrl) {
          // Extract project reference from SUPABASE_URL
          // Format: https://xxx.supabase.co -> xxx
          const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
          if (urlMatch) {
            const projectRef = urlMatch[1]
            dbUrl = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`
            logger.info('✅ Constructed SUPABASE_DB_URL from SUPABASE_URL and SUPABASE_DB_PASSWORD')
          }
        }
      }
      
      if (!dbUrl) {
        // Only warn once to avoid log spam
        if (!this.hasWarnedAboutMissingDbUrl) {
          logger.warn('⚠️ SUPABASE_DB_URL or DATABASE_URL not set. Risk assessment worker will not start.')
          logger.warn('   Set SUPABASE_DB_URL to enable automatic risk assessments via triggers.')
          logger.warn('   Or set SUPABASE_DB_PASSWORD to auto-construct the connection string.')
          logger.warn('   Note: Risk assessments still work via route handlers.')
          logger.warn('   Get your database password from: Supabase Dashboard → Project Settings → Database')
          this.hasWarnedAboutMissingDbUrl = true
        }
        return false
      }

      this.client = new Client({
        connectionString: dbUrl,
        // Connection pool settings
        max: 1, // Only need one connection for LISTEN
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      })

      await this.client.connect()
      logger.info('✅ Risk Assessment Worker: Connected to PostgreSQL')

      // Set up notification listener
      await this.client.query('LISTEN risk_assessment_needed')
      logger.info('✅ Risk Assessment Worker: Listening for risk_assessment_needed notifications')

      // Handle notifications
      this.client.on('notification', (msg) => {
        this.handleNotification(msg)
      })

      // Handle connection errors
      this.client.on('error', (err) => {
        logger.error('❌ Risk Assessment Worker: PostgreSQL connection error:', err)
        this.isListening = false
        // Attempt to reconnect after delay
        setTimeout(() => this.initialize(), 5000)
      })

      // Handle disconnection
      this.client.on('end', () => {
        logger.warn('⚠️ Risk Assessment Worker: PostgreSQL connection ended')
        this.isListening = false
      })

      this.isListening = true
      return true
    } catch (error) {
      logger.error('❌ Risk Assessment Worker: Failed to initialize:', error)
      this.isListening = false
      return false
    }
  }

  /**
   * Handle incoming notification
   */
  async handleNotification(msg) {
    try {
      if (msg.channel !== 'risk_assessment_needed') {
        return
      }

      const payload = JSON.parse(msg.payload)
      const userId = payload.user_id

      if (!userId) {
        logger.warn('⚠️ Risk Assessment Worker: Received notification without user_id')
        return
      }

      // Prevent duplicate processing
      if (this.processingQueue.has(userId)) {
        logger.debug(`⏭️ Risk Assessment Worker: User ${userId} already being processed, skipping`)
        return
      }

      // Add to processing queue
      this.processingQueue.add(userId)

      logger.info(`🔔 Risk Assessment Worker: Received notification for user ${userId} (${payload.operation})`)

      // Process asynchronously (don't block notification handler)
      this.processRiskAssessment(userId)
        .then(() => {
          this.processingQueue.delete(userId)
        })
        .catch((err) => {
          logger.error(`❌ Risk Assessment Worker: Error processing user ${userId}:`, err)
          this.processingQueue.delete(userId)
        })
    } catch (error) {
      logger.error('❌ Risk Assessment Worker: Error handling notification:', error)
    }
  }

  /**
   * Process risk assessment for a user
   */
  async processRiskAssessment(userId) {
    try {
      // Fetch user profile
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (fetchError) {
        logger.error(`❌ Risk Assessment Worker: Error fetching profile for ${userId}:`, fetchError)
        return
      }

      if (!profile) {
        logger.warn(`⚠️ Risk Assessment Worker: Profile not found for user ${userId}`)
        return
      }

      // Check if we have enough data to assess
      if (!profile.company_name && !profile.email) {
        logger.debug(`⏭️ Risk Assessment Worker: Insufficient data for user ${userId}, skipping`)
        return
      }

      logger.info(`🔄 Risk Assessment Worker: Processing risk assessment for user ${userId}`)

      // Execute risk assessment
      const result = await UserRiskAssessmentService.evaluateAndSaveRisk(supabaseAdmin, profile)

      if (result.success) {
        logger.info(
          `✅ Risk Assessment Worker: Completed assessment for user ${userId} - ` +
          `score=${result.score}, level=${result.risk_level}, requires_review=${result.requires_manual_review}`
        )
      } else {
        logger.warn(`⚠️ Risk Assessment Worker: Assessment failed for user ${userId}:`, result.error)
      }
    } catch (error) {
      logger.error(`❌ Risk Assessment Worker: Error in processRiskAssessment for ${userId}:`, error)
      throw error
    }
  }

  /**
   * Stop listening and close connection
   */
  async stop() {
    try {
      if (this.client) {
        await this.client.query('UNLISTEN risk_assessment_needed')
        await this.client.end()
        logger.info('✅ Risk Assessment Worker: Stopped and disconnected')
      }
      this.isListening = false
    } catch (error) {
      logger.error('❌ Risk Assessment Worker: Error stopping:', error)
    }
  }

  /**
   * Check if worker is listening
   */
  isActive() {
    return this.isListening && this.client && !this.client.ended
  }
}

// Singleton instance
let workerInstance = null

/**
 * Get or create worker instance
 */
function getWorker() {
  if (!workerInstance) {
    workerInstance = new RiskAssessmentWorker()
  }
  return workerInstance
}

/**
 * Start the worker (called from server.js)
 */
async function startWorker() {
  const worker = getWorker()
  const initialized = await worker.initialize()
  
  if (initialized) {
    logger.info('🚀 Risk Assessment Worker: Started successfully')
  }
  // Warning about missing DB URL is already logged in initialize() if needed
  // No need to log again here to avoid duplicate warnings
  
  return initialized
}

/**
 * Stop the worker (called on server shutdown)
 */
async function stopWorker() {
  const worker = getWorker()
  await worker.stop()
}

module.exports = {
  RiskAssessmentWorker,
  getWorker,
  startWorker,
  stopWorker
}

