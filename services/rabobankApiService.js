'use strict'

const https = require('https')

/**
 * Rabobank API Service
 * 
 * Handles interactions with the Rabobank PSD2 API for account information and payment initiation.
 * Implements OAuth 2.0 authorization code flow for secure access to banking data.
 * 
 * Documentation: https://developer.rabobank.nl/
 */
class RabobankApiService {
  // API Configuration
  static getApiBaseUrl() {
    const sandboxMode = process.env.RABOBANK_SANDBOX_MODE === 'true'
    return sandboxMode
      ? 'https://api-sandbox.rabobank.nl/openapi' // Sandbox environment
      : 'https://api.rabobank.nl/openapi' // Production environment
  }

  static getAuthBaseUrl() {
    const sandboxMode = process.env.RABOBANK_SANDBOX_MODE === 'true'
    return sandboxMode
      ? 'https://api-sandbox.rabobank.nl/oauth' // Sandbox OAuth
      : 'https://api.rabobank.nl/oauth' // Production OAuth
  }

  /**
   * Get API credentials from environment
   * @returns {Object|null} { clientId, clientSecret }
   */
  static getCredentials() {
    const clientId = process.env.RABOBANK_CLIENT_ID
    const clientSecret = process.env.RABOBANK_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return null
    }

    return { clientId, clientSecret }
  }

  /**
   * Check if Rabobank API is configured
   * @returns {boolean}
   */
  static isAvailable() {
    return !!this.getCredentials()
  }

  /**
   * Returns a short reason when not configured (for UI/redirect messages).
   * @returns {string|null} null when configured, otherwise a message like "RABOBANK_CLIENT_ID ontbreekt"
   */
  static getConfigError() {
    const clientId = process.env.RABOBANK_CLIENT_ID
    const clientSecret = process.env.RABOBANK_CLIENT_SECRET
    if (!clientId) return 'RABOBANK_CLIENT_ID ontbreekt in .env'
    if (!clientSecret) return 'RABOBANK_CLIENT_SECRET ontbreekt in .env'
    return null
  }

  /**
   * Get fetch function (native fetch or node-fetch)
   * @returns {Function}
   */
  static getFetchFunction() {
    if (typeof fetch !== 'undefined') {
      return fetch
    }
    try {
      return require('node-fetch')
    } catch (e) {
      throw new Error('fetch is not available. Install node-fetch or use Node.js 18+')
    }
  }

  /**
   * Generate OAuth 2.0 authorization URL
   * @param {string} redirectUri - Callback URL after authorization
   * @param {string} state - State parameter for CSRF protection
   * @param {string[]} scopes - Requested scopes (default: account information)
   * @returns {string} Authorization URL
   */
  static getAuthorizationUrl(redirectUri, state, scopes = ['aisp']) {
    const credentials = this.getCredentials()
    if (!credentials) {
      throw new Error('Rabobank API credentials not configured. Set RABOBANK_CLIENT_ID and RABOBANK_CLIENT_SECRET environment variables.')
    }

    const authBaseUrl = this.getAuthBaseUrl()
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state: state
    })

    return `${authBaseUrl}/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from callback
   * @param {string} redirectUri - Same redirect URI used in authorization
   * @returns {Promise<Object>} { access_token, refresh_token, expires_in, token_type }
   */
  static async exchangeCodeForToken(code, redirectUri) {
    const credentials = this.getCredentials()
    if (!credentials) {
      throw new Error('Rabobank API credentials not configured')
    }

    const authBaseUrl = this.getAuthBaseUrl()
    const tokenUrl = `${authBaseUrl}/token`

    const fetchFunction = this.getFetchFunction()

    // Basic Auth header (client_id:client_secret base64 encoded)
    const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')

    try {
      console.log(`[Rabobank API] Exchanging authorization code for token`)
      
      const response = await fetchFunction(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        }).toString()
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        const status = response.status

        console.error(`[Rabobank API] Token exchange failed: ${status} - ${errorText}`)

        if (status === 401) {
          throw new Error('Rabobank API: Invalid credentials')
        } else if (status === 400) {
          throw new Error(`Rabobank API: Invalid authorization code or redirect URI: ${errorText}`)
        } else {
          throw new Error(`Rabobank API: Token exchange failed (${status}): ${errorText}`)
        }
      }

      const data = await response.json()
      console.log(`[Rabobank API] Token exchange successful`)
      
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        token_type: data.token_type || 'Bearer',
        scope: data.scope
      }
    } catch (error) {
      if (error.message && error.message.startsWith('Rabobank API:')) {
        throw error
      }

      console.error('[Rabobank API] Token exchange error:', error)
      throw new Error(`Rabobank API: ${error.message || 'Unknown error during token exchange'}`)
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} { access_token, refresh_token, expires_in, token_type }
   */
  static async refreshAccessToken(refreshToken) {
    const credentials = this.getCredentials()
    if (!credentials) {
      throw new Error('Rabobank API credentials not configured')
    }

    const authBaseUrl = this.getAuthBaseUrl()
    const tokenUrl = `${authBaseUrl}/token`

    const fetchFunction = this.getFetchFunction()
    const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')

    try {
      console.log(`[Rabobank API] Refreshing access token`)
      
      const response = await fetchFunction(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }).toString()
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        const status = response.status

        console.error(`[Rabobank API] Token refresh failed: ${status} - ${errorText}`)

        if (status === 401) {
          throw new Error('Rabobank API: Invalid refresh token')
        } else {
          throw new Error(`Rabobank API: Token refresh failed (${status}): ${errorText}`)
        }
      }

      const data = await response.json()
      console.log(`[Rabobank API] Token refresh successful`)
      
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // Use new refresh token if provided
        expires_in: data.expires_in,
        token_type: data.token_type || 'Bearer',
        scope: data.scope
      }
    } catch (error) {
      if (error.message && error.message.startsWith('Rabobank API:')) {
        throw error
      }

      console.error('[Rabobank API] Token refresh error:', error)
      throw new Error(`Rabobank API: ${error.message || 'Unknown error during token refresh'}`)
    }
  }

  /**
   * Make authenticated API request
   * @param {string} endpoint - API endpoint path
   * @param {string} accessToken - Access token
   * @param {Object} options - Request options
   * @returns {Promise<Object>}
   */
  static async makeRequest(endpoint, accessToken, options = {}) {
    if (!accessToken) {
      throw new Error('Access token is required')
    }

    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}${endpoint}`

    const fetchFunction = this.getFetchFunction()

    const defaultHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      },
      ...(options.body && { body: JSON.stringify(options.body) })
    }

    try {
      console.log(`[Rabobank API] Making request to: ${url}`)
      
      const response = await fetchFunction(url, requestOptions)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        const status = response.status

        console.error(`[Rabobank API] Request failed: ${status} - ${errorText}`)

        if (status === 401) {
          throw new Error('Rabobank API: Invalid or expired access token')
        } else if (status === 403) {
          throw new Error('Rabobank API: Insufficient permissions')
        } else if (status === 404) {
          throw new Error('Rabobank API: Resource not found')
        } else if (status === 429) {
          throw new Error('Rabobank API: Rate limit exceeded')
        } else if (status >= 500) {
          throw new Error(`Rabobank API: Server error (${status})`)
        } else {
          throw new Error(`Rabobank API: Request failed (${status}): ${errorText}`)
        }
      }

      const data = await response.json()
      return data
    } catch (error) {
      if (error.message && error.message.startsWith('Rabobank API:')) {
        throw error
      }

      console.error('[Rabobank API] Request error:', error)
      throw new Error(`Rabobank API: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Get account information
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} Account information
   */
  static async getAccountInformation(accessToken) {
    try {
      const data = await this.makeRequest('/psd2/account-information/v3/accounts', accessToken)
      return data
    } catch (error) {
      console.error('[Rabobank API] Error fetching account information:', error)
      throw error
    }
  }

  /**
   * Get account balances
   * @param {string} accessToken - Access token
   * @param {string} accountId - Account ID (optional, if not provided returns all accounts)
   * @returns {Promise<Object>} Account balances
   */
  static async getAccountBalances(accessToken, accountId = null) {
    try {
      const endpoint = accountId 
        ? `/psd2/account-information/v3/accounts/${accountId}/balances`
        : '/psd2/account-information/v3/balances'
      
      const data = await this.makeRequest(endpoint, accessToken)
      return data
    } catch (error) {
      console.error('[Rabobank API] Error fetching account balances:', error)
      throw error
    }
  }

  /**
   * Get account transactions
   * @param {string} accessToken - Access token
   * @param {string} accountId - Account ID
   * @param {Object} options - Query options (dateFrom, dateTo, bookingStatus, etc.)
   * @returns {Promise<Object>} Account transactions
   */
  static async getAccountTransactions(accessToken, accountId, options = {}) {
    try {
      const params = new URLSearchParams()
      
      if (options.dateFrom) {
        params.append('dateFrom', options.dateFrom)
      }
      if (options.dateTo) {
        params.append('dateTo', options.dateTo)
      }
      if (options.bookingStatus) {
        params.append('bookingStatus', options.bookingStatus)
      }
      if (options.limit) {
        params.append('limit', options.limit.toString())
      }

      const queryString = params.toString()
      const endpoint = `/psd2/account-information/v3/accounts/${accountId}/transactions${queryString ? `?${queryString}` : ''}`
      
      const data = await this.makeRequest(endpoint, accessToken)
      return data
    } catch (error) {
      console.error('[Rabobank API] Error fetching account transactions:', error)
      throw error
    }
  }

  /**
   * Get mTLS credentials from environment (PEM strings).
   * Env: RABOBANK_MTLS_CLIENT_KEY, RABOBANK_MTLS_FULLCHAIN (or RABOBANK_MTLS_CLIENT_CERT).
   * @returns {{ key: string, cert: string } | null}
   */
  static getMtlsCredentials() {
    const key = process.env.RABOBANK_MTLS_CLIENT_KEY
    const cert = process.env.RABOBANK_MTLS_FULLCHAIN || process.env.RABOBANK_MTLS_CLIENT_CERT
    if (!key || !cert) return null
    return { key, cert }
  }

  /**
   * Check if mTLS is configured (key + cert in env).
   * @returns {boolean}
   */
  static isMtlsConfigured() {
    return !!this.getMtlsCredentials()
  }

  /**
   * Test mTLS connection: one GET to Rabobank API base URL with client cert.
   * Use this to verify cert chain and key before enabling sync.
   * @returns {Promise<{ ok: boolean, statusCode?: number, message?: string }>}
   */
  static testMtlsConnection() {
    const creds = this.getMtlsCredentials()
    if (!creds) {
      return Promise.resolve({
        ok: false,
        message: 'mTLS not configured. Set RABOBANK_MTLS_CLIENT_KEY and RABOBANK_MTLS_FULLCHAIN.'
      })
    }

    const baseUrl = this.getApiBaseUrl()
    const url = new URL(baseUrl)
    const agent = new https.Agent({
      key: creds.key,
      cert: creds.cert,
      rejectUnauthorized: true
    })

    return new Promise((resolve) => {
      const req = https.get(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname || '/',
          method: 'GET',
          agent
        },
        (res) => {
          agent.destroy()
          resolve({
            ok: true,
            statusCode: res.statusCode,
            message: `Connected (HTTP ${res.statusCode}). mTLS handshake succeeded.`
          })
        }
      )
      req.on('error', (err) => {
        agent.destroy()
        resolve({
          ok: false,
          message: err.message || 'Connection failed. Check cert chain, key match, SNI, and portal status.'
        })
      })
      req.setTimeout(15000, () => {
        req.destroy()
        agent.destroy()
        resolve({ ok: false, message: 'Request timeout' })
      })
    })
  }
}

module.exports = RabobankApiService
