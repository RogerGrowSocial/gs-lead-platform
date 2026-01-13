'use strict'

const OpenAI = require('openai')
const { supabaseAdmin } = require('../config/supabase')

/**
 * Scraper Service
 * 
 * Handles web scraping jobs using Tavily API + OpenAI enrichment
 */
class ScraperService {
  /**
   * Get OpenAI client
   */
  static getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return null
    }
    return new OpenAI({ apiKey })
  }

  /**
   * Get Tavily API key
   */
  static getTavilyApiKey() {
    return process.env.TAVILY_API_KEY
  }

  /**
   * Check if APIs are configured
   */
  static isConfigured() {
    return !!process.env.TAVILY_API_KEY && !!process.env.OPENAI_API_KEY
  }

  /**
   * Build Tavily search queries from job config
   */
  static buildTavilyQueries(job, serviceInfo = null, options = {}) {
    const queries = []
    const location = job.location_text
    const branches = Array.isArray(job.branches) ? job.branches : []
    const variation = options.variation || 0
    const includeMoreBranches = options.includeMoreBranches || false

    // Build queries for each branch
    if (branches.length === 0) {
      // No branches specified - general search with variations
      queries.push(`${location} bedrijven`)
      if (variation > 0) {
        queries.push(`${location} bedrijven contact`)
        queries.push(`${location} bedrijven telefoon`)
        queries.push(`${location} bedrijven email`)
      }
    } else {
      for (const branch of branches) {
        queries.push(`${branch} ${location}`)
        queries.push(`${branch} ${location} bedrijf`)
        if (variation > 0) {
          queries.push(`${branch} ${location} contact`)
          queries.push(`${branch} ${location} telefoon`)
        }
      }
    }

    // Add service-specific queries if service is selected
    if (serviceInfo && serviceInfo.name) {
      queries.push(`${serviceInfo.name} ${location}`)
      if (variation > 0) {
        queries.push(`${serviceInfo.name} ${location} contact`)
      }
    }
    
    // Add more general queries if we need more results
    if (includeMoreBranches) {
      queries.push(`${location} bedrijven lijst`)
      queries.push(`${location} bedrijven directory`)
      queries.push(`${location} bedrijven adres`)
      queries.push(`${location} bedrijven telefoon`)
      queries.push(`${location} bedrijven email`)
      queries.push(`${location} bedrijven contactgegevens`)
      queries.push(`${location} bedrijven adresboek`)
      queries.push(`${location} bedrijven register`)
      queries.push(`${location} bedrijven goudengids`)
      queries.push(`${location} bedrijven telefoonboek`)
    }
    
    // Add variation-based queries for more diversity
    if (variation > 0) {
      const variations = [
        'contact',
        'telefoon',
        'email',
        'adres',
        'locatie',
        'vestiging',
        'kantoor',
        'bedrijf',
        'onderneming',
        'zaak',
        'winkel',
        'handel',
        'diensten',
        'service'
      ]
      
      const variationIndex = variation % variations.length
      const variationTerm = variations[variationIndex]
      
      if (branches.length === 0) {
        queries.push(`${location} ${variationTerm}`)
        queries.push(`${location} bedrijven met ${variationTerm}`)
        queries.push(`${location} ${variationTerm} bedrijf`)
      } else {
        branches.forEach(branch => {
          queries.push(`${branch} ${location} ${variationTerm}`)
          queries.push(`${branch} ${location} met ${variationTerm}`)
        })
      }
    }

    return queries
  }

  /**
   * Search using Tavily API
   */
  static async searchWithTavily(query, options = {}) {
    const apiKey = this.getTavilyApiKey()
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY not configured')
    }

    const fetchFunction = typeof fetch !== 'undefined' ? fetch : require('node-fetch')

    const tavilyUrl = 'https://api.tavily.com/search'
    
    const requestBody = {
      api_key: apiKey,
      query: query,
      search_depth: options.search_depth || 'basic',
      max_results: options.max_results || 10,
      include_domains: [],
      exclude_domains: [],
      include_answer: false,
      include_raw_content: true,
      include_images: false
    }

    // Note: Tavily doesn't support TLD filtering via include_domains
    // Instead, we add location context to the query for better NL results
    // The query itself should already contain location info

    try {
      const response = await fetchFunction(tavilyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Tavily API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Tavily search error:', error)
      throw error
    }
  }

  /**
   * Extract structured data using OpenAI
   */
  static async extractWithOpenAI(url, content, desiredFields, serviceInfo = null) {
    const openai = this.getOpenAIClient()
    if (!openai) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Build extraction prompt
    const fieldsList = desiredFields.join(', ')
    let serviceContext = ''
    if (serviceInfo) {
      serviceContext = `\n\nSERVICE CONTEXT:\n- Service: ${serviceInfo.name}\n- Billing model: ${serviceInfo.billing_model || 'N/A'}\n`
    }

    const prompt = `Je bent een expert in het extraheren van bedrijfsgegevens uit webpagina's.

EXTRACTIE TAAK:
Extracteer de volgende velden uit de onderstaande webpagina inhoud: ${fieldsList}

BELANGRIJKE REGELS:
1. Extracteer ALLEEN informatie die daadwerkelijk in de tekst staat - NOOIT hallucineren
2. Voor email/phone: alleen extracten als deze expliciet in de tekst staan
3. Geef voor elk veld een confidence score (0.0-1.0) - hoe zeker ben je dat deze informatie correct is?
4. Als informatie niet gevonden wordt, gebruik null (niet lege string)
5. Company name is verplicht - gebruik de bedrijfsnaam of website domein als fallback
${serviceContext}
WEBPAGINA INHOUD:
${content.substring(0, 8000)}  <!-- Limit to 8000 chars -->

Geef een JSON object terug met deze structuur:
{
  "company_name": "string (verplicht)",
  "website": "string of null",
  "phone": "string of null",
  "email": "string of null",
  "address": "string of null",
  "city": "string of null",
  "postcode": "string of null",
  "contact_person": "string of null",
  "branch": "string of null",
  "confidence": {
    "company_name": 0.0-1.0,
    "website": 0.0-1.0,
    "phone": 0.0-1.0,
    "email": 0.0-1.0,
    "address": 0.0-1.0,
    "city": 0.0-1.0,
    "postcode": 0.0-1.0,
    "contact_person": 0.0-1.0,
    "branch": 0.0-1.0
  },
  "fit_score": 0-100,
  "fit_reason": "string (waarom is dit bedrijf een goede match voor de service?)"
}

fit_score en fit_reason zijn gebaseerd op de service context (als beschikbaar).`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het extraheren van gestructureerde bedrijfsgegevens. Geef altijd een geldig JSON object terug zonder markdown code blocks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      })

      const responseText = completion.choices[0].message.content.trim()
      const cleaned = responseText.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim()
      const extracted = JSON.parse(cleaned)

      return extracted
    } catch (error) {
      console.error('OpenAI extraction error:', error)
      throw error
    }
  }

  /**
   * Get service-aware fit score prompt
   */
  static getServiceFitPrompt(serviceInfo) {
    if (!serviceInfo) {
      return 'Beoordeel of dit bedrijf een goede match is voor onze diensten.'
    }

    const serviceName = serviceInfo.name?.toLowerCase() || ''
    const billingModel = serviceInfo.billing_model || ''

    // Service-specific fit criteria
    if (serviceName.includes('website onderhoud') || serviceName.includes('website-onderhoud')) {
      return `Beoordeel of dit bedrijf een goede match is voor website onderhoud:
- Heeft het bedrijf een bestaande website?
- Zijn er tekenen van verouderde website (oude design, geen HTTPS, traag, verouderde CMS, geen cookie banner)?
- Is het een lokaal bedrijf?
Geef een hoge fit_score (70-100) als: website bestaat + ziet er verouderd uit + lokaal bedrijf.`
    }

    if (serviceName.includes('google ads') || serviceName.includes('google-ads')) {
      return `Beoordeel of dit bedrijf een goede match is voor Google Ads:
- Adverteren ze al online?
- Hebben ze duidelijke lead intent (bijv. "offerte", "contact", "afspraak")?
- Hebben ze diensten met hoge waarde leads?
Geef een hoge fit_score (70-100) als: al adverteren OF duidelijke conversie intent.`
    }

    if (serviceName.includes('seo')) {
      return `Beoordeel of dit bedrijf een goede match is voor SEO:
- Hebben ze een blog/service pagina's maar lage zichtbaarheid?
- Basis heuristiek: zwakke titles, dunne content?
Geef een hoge fit_score (70-100) als: website bestaat maar slechte SEO signalen.`
    }

    if (serviceName.includes('website development') || serviceName.includes('website-development')) {
      return `Beoordeel of dit bedrijf een goede match is voor website development:
- Hebben ze geen website of slechte website aanwezigheid?
- Zijn ze duidelijk aan het uitbreiden/lanceren?
Geef een hoge fit_score (70-100) als: geen website OF slechte website OF duidelijk uitbreiden.`
    }

    if (serviceName.includes('emailmarketing') || serviceName.includes('e-mailmarketing')) {
      return `Beoordeel of dit bedrijf een goede match is voor e-mailmarketing:
- Hebben ze een webshop/nieuwsbrief vermelding?
- Hebben ze meerdere locaties?
- Hebben ze een abonnement model?
Geef een hoge fit_score (70-100) als: webshop/nieuwsbrief OF meerdere locaties OF abonnement model.`
    }

    // Default
    return 'Beoordeel of dit bedrijf een goede match is voor onze diensten. Geef een fit_score (0-100) en fit_reason.'
  }

  /**
   * Normalize dedupe key
   */
  static normalizeDedupeKey(companyName, domain, city) {
    // Use domain if available, otherwise name+city
    if (domain) {
      return domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    }
    if (companyName && city) {
      return `${companyName.toLowerCase().trim()}_${city.toLowerCase().trim()}`.replace(/[^a-z0-9_]/g, '')
    }
    if (companyName) {
      return companyName.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    }
    return null
  }

  /**
   * Run a scraper job
   */
  static async runJob(jobId) {
    try {
      // Fetch job
      const { data: job, error: jobError } = await supabaseAdmin
        .from('scraper_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        throw new Error(`Job not found: ${jobId}`)
      }

      // Check if already running/completed
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        return { success: false, message: `Job already ${job.status}` }
      }

      // Update status to running
      await supabaseAdmin
        .from('scraper_jobs')
        .update({ status: 'running' })
        .eq('id', jobId)

      // Fetch service info if available
      let serviceInfo = null
      if (job.service_id) {
        const { data: service } = await supabaseAdmin
          .from('services')
          .select('id, name, slug, billing_model')
          .eq('id', job.service_id)
          .single()
        serviceInfo = service
      }

      // Build queries (serviceInfo already fetched)
      const queries = this.buildTavilyQueries(job, serviceInfo)

      // Update meta with queries
      await supabaseAdmin
        .from('scraper_jobs')
        .update({ meta: { queries } })
        .eq('id', jobId)

      // Track seen domains to enforce max_pages_per_domain
      const domainPageCount = new Map()
      const seenDedupeKeys = new Set()
      let totalFound = 0
      let totalEnriched = 0
      let totalErrors = 0
      let totalSkipped = 0 // Track skipped (null/null/null) results
      
      // Shared counter object that processQuery can update in real-time
      const sharedCounters = { totalFound: 0, totalEnriched: 0 }

      // Process queries with concurrency limit
      const concurrency = 3
      const allResults = []

      for (let i = 0; i < queries.length; i += concurrency) {
        const batch = queries.slice(i, i + concurrency)
        const batchPromises = batch.map(query => this.processQuery(query, job, serviceInfo, domainPageCount, seenDedupeKeys, jobId, sharedCounters))
        
        const batchResults = await Promise.allSettled(batchPromises)
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            const validResults = result.value.filter(r => r !== null) // Filter out null results
            allResults.push(...validResults)
            // Use shared counters (already updated in real-time by processQuery)
            totalFound = sharedCounters.totalFound
            totalEnriched = sharedCounters.totalEnriched
            totalSkipped += (result.value.length - validResults.length)
          } else {
            console.error('Query processing error:', result.reason)
            totalErrors++
          }
        }

        // Update progress FREQUENTLY (after each batch) - use current counts
        await supabaseAdmin
          .from('scraper_jobs')
          .update({
            progress_total: queries.length,
            progress_done: Math.min(i + concurrency, queries.length),
            progress_found: totalFound,
            progress_enriched: totalEnriched,
            progress_errors: totalErrors,
            meta: { 
              queries,
              skipped: totalSkipped 
            }
          })
          .eq('id', jobId)

        // Check if cancelled
        const { data: checkJob } = await supabaseAdmin
          .from('scraper_jobs')
          .select('status')
          .eq('id', jobId)
          .single()
        
        if (checkJob?.status === 'cancelled') {
          return { success: false, message: 'Job cancelled' }
        }

        // Check actual count in database (not just counter) to ensure we have enough VALID results
        // Many results might be filtered out (no phone/email), so we need to check the actual DB count
        const { data: allResults } = await supabaseAdmin
          .from('scraper_results')
          .select('phone, email')
          .eq('job_id', jobId)
        
        const actualValidCount = allResults ? allResults.filter(r => {
          const hasPhone = r.phone && r.phone.trim() !== '' && r.phone !== 'null'
          const hasEmail = r.email && r.email.trim() !== '' && r.email !== 'null' && r.email.includes('@')
          return hasPhone || hasEmail
        }).length : 0
        
        // Only stop if we have enough VALID results in the database
        if (actualValidCount >= job.max_results) {
          console.log(`✅ Reached target: ${actualValidCount} valid results (target: ${job.max_results})`)
          break
        }
        
        // Log progress every 10 results
        if (actualValidCount > 0 && actualValidCount % 10 === 0) {
          console.log(`📊 Progress: ${actualValidCount}/${job.max_results} valid results found`)
        }
      }
      
      // After initial queries, check if we have enough and continue if needed
      // This ensures we get the requested number of results even if many are filtered
      const { count: finalCount } = await supabaseAdmin
        .from('scraper_results')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .or('phone.not.is.null,email.not.is.null')
        .neq('phone', '')
        .neq('email', '')
      
      let actualValidCount = finalCount || 0
      let attempts = 0
      const maxAttempts = 20 // Maximum attempts to ensure we get enough results
      let noProgressCount = 0 // Track attempts without new results
      const maxNoProgressAttempts = 3 // Stop if no new results after 3 attempts
      
      while (actualValidCount < job.max_results && attempts < maxAttempts) {
        attempts++
        const countBeforeAttempt = actualValidCount
        
        // Generate additional queries with variations
        const additionalQueries = this.buildTavilyQueries(job, serviceInfo, {
          variation: attempts, // Add variation to get different results
          includeMoreBranches: true
        })
        
        if (additionalQueries.length === 0) {
          console.log(`⚠️ No more queries to generate. Stopping at ${actualValidCount} results.`)
          break // No more queries to generate
        }
        
        // Process additional queries
        for (let i = 0; i < additionalQueries.length; i += concurrency) {
          const batch = additionalQueries.slice(i, i + concurrency)
          const batchPromises = batch.map(query => this.processQuery(query, job, serviceInfo, domainPageCount, seenDedupeKeys, jobId, sharedCounters))
          
          const batchResults = await Promise.allSettled(batchPromises)
          
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              const validResults = result.value.filter(r => r !== null)
              allResults.push(...validResults)
              // Use shared counters (already updated in real-time by processQuery)
              totalFound = sharedCounters.totalFound
              totalEnriched = sharedCounters.totalEnriched
              totalSkipped += (result.value.length - validResults.length)
            } else {
              console.error('Query processing error:', result.reason)
              totalErrors++
            }
          }
          
          // Update progress
          await supabaseAdmin
            .from('scraper_jobs')
            .update({
              progress_found: totalFound,
              progress_enriched: totalEnriched,
              progress_errors: totalErrors,
              meta: { 
                queries: [...queries, ...additionalQueries],
                skipped: totalSkipped,
                additional_attempts: attempts
              }
            })
            .eq('id', jobId)
            .then(() => {})
            .catch(err => console.error('Failed to update job progress:', err))
          
          // Check if cancelled
          const { data: checkJob } = await supabaseAdmin
            .from('scraper_jobs')
            .select('status')
            .eq('id', jobId)
            .single()
          
          if (checkJob?.status === 'cancelled') {
            return { success: false, message: 'Job cancelled' }
          }
          
          // Check ACTUAL count in database (not just counter)
          const { data: currentResults } = await supabaseAdmin
            .from('scraper_results')
            .select('phone, email')
            .eq('job_id', jobId)
          
          actualValidCount = currentResults ? currentResults.filter(r => {
            const hasPhone = r.phone && r.phone.trim() !== '' && r.phone !== 'null'
            const hasEmail = r.email && r.email.trim() !== '' && r.email !== 'null' && r.email.includes('@')
            return hasPhone || hasEmail
          }).length : 0
          
          // Only stop if we have enough VALID results in the database
          if (actualValidCount >= job.max_results) {
            console.log(`✅ Reached target after additional queries: ${actualValidCount} valid results (target: ${job.max_results})`)
            break
          }
          
          // Log progress every 5 results
          if (actualValidCount > 0 && actualValidCount % 5 === 0) {
            console.log(`📊 Additional queries progress: ${actualValidCount}/${job.max_results} valid results`)
          }
        }
        
        // Re-check after batch
        const { data: recheckResults } = await supabaseAdmin
          .from('scraper_results')
          .select('phone, email')
          .eq('job_id', jobId)
        
        actualValidCount = recheckResults ? recheckResults.filter(r => {
          const hasPhone = r.phone && r.phone.trim() !== '' && r.phone !== 'null'
          const hasEmail = r.email && r.email.trim() !== '' && r.email !== 'null' && r.email.includes('@')
          return hasPhone || hasEmail
        }).length : 0
        
        if (actualValidCount >= job.max_results) {
          console.log(`✅ Reached target: ${actualValidCount} valid results (target: ${job.max_results})`)
          break
        }
        
        // Check if we made progress
        if (actualValidCount === countBeforeAttempt) {
          noProgressCount++
          console.log(`⚠️ No new results in attempt ${attempts} (${noProgressCount}/${maxNoProgressAttempts} attempts without progress)`)
          
          // Stop if no progress after multiple attempts
          if (noProgressCount >= maxNoProgressAttempts) {
            console.log(`🛑 Stopping: No new results after ${maxNoProgressAttempts} attempts. Found ${actualValidCount} valid results.`)
            break
          }
        } else {
          noProgressCount = 0 // Reset counter if we made progress
        }
        
        // Log progress
        console.log(`📊 Attempt ${attempts}: ${actualValidCount}/${job.max_results} valid results (need ${job.max_results - actualValidCount} more)`)
      }
      
      // Final check - update totalFound to actual count
      const { data: finalResults } = await supabaseAdmin
        .from('scraper_results')
        .select('phone, email')
        .eq('job_id', jobId)
      
      const finalValidCount = finalResults ? finalResults.filter(r => {
        const hasPhone = r.phone && r.phone.trim() !== '' && r.phone !== 'null'
        const hasEmail = r.email && r.email.trim() !== '' && r.email !== 'null' && r.email.includes('@')
        return hasPhone || hasEmail
      }).length : 0
      
      totalFound = finalValidCount
      totalEnriched = totalFound // Each valid result is enriched
      
      console.log(`✅ Final count: ${totalFound} valid results (target was: ${job.max_results})`)

      // Mark as completed (always, even if we didn't reach max_results)
      await supabaseAdmin
        .from('scraper_jobs')
        .update({
          status: 'completed',
          progress_done: queries.length,
          progress_total: queries.length,
          progress_found: totalFound,
          progress_enriched: totalEnriched,
          progress_errors: totalErrors
        })
        .eq('id', jobId)
        .then(() => {
          console.log(`✅ Job marked as completed with ${totalFound} valid results`)
        })
        .catch(err => {
          console.error('Failed to mark job as completed:', err)
        })

      return { success: true, found: totalFound, enriched: totalEnriched, errors: totalErrors }
    } catch (error) {
      console.error('Job runner error:', error)
      
      // Update job status to failed
      await supabaseAdmin
        .from('scraper_jobs')
        .update({
          status: 'failed',
          error: error.message
        })
        .eq('id', jobId)
        .catch(err => console.error('Failed to update job status:', err))

      throw error
    }
  }

  /**
   * Process a single query
   */
  static async processQuery(query, job, serviceInfo, domainPageCount, seenDedupeKeys, jobId, sharedCounters = null) {
    const results = []

    try {
      // Build query with location context for better NL results
      let searchQuery = query
      if (job.only_nl && !query.toLowerCase().includes('nederland') && !query.toLowerCase().includes('netherlands')) {
        searchQuery = `${query} Nederland`
      }

      // Search with Tavily
      const tavilyData = await this.searchWithTavily(searchQuery, {
        max_results: 20
      })

      if (!tavilyData?.results || tavilyData.results.length === 0) {
        return results
      }

      // Process each result
      for (const result of tavilyData.results) {
        // Check domain page limit
        const domain = result.url ? new URL(result.url).hostname : null
        if (domain) {
          const count = domainPageCount.get(domain) || 0
          if (count >= job.max_pages_per_domain) {
            continue
          }
          domainPageCount.set(domain, count + 1)
        }

        // Extract content
        const content = result.content || result.raw_content || ''
        if (!content || content.length < 50) {
          continue
        }

        // Extract with OpenAI
        let extracted
        try {
          extracted = await this.extractWithOpenAI(
            result.url,
            content,
            job.desired_fields,
            serviceInfo
          )
        } catch (extractError) {
          console.error('Extraction error:', extractError)
          continue
        }

        // Validate company_name (required)
        if (!extracted.company_name || extracted.company_name.trim() === '') {
          continue
        }

        // CRITICAL: Skip if all key fields are null (null/null/null results)
        // Require at least phone OR email to be valid
        const hasPhone = extracted.phone && extracted.phone.trim() !== '' && extracted.phone !== 'null'
        const hasEmail = extracted.email && extracted.email.trim() !== '' && extracted.email !== 'null' && extracted.email.includes('@')
        
        if (!hasPhone && !hasEmail) {
          // Skip this result - not enough data, don't count it
          continue
        }

        // Build dedupe key
        const dedupeKey = this.normalizeDedupeKey(
          extracted.company_name,
          domain || extracted.website,
          extracted.city
        )

        // Check for duplicates
        if (dedupeKey && seenDedupeKeys.has(dedupeKey)) {
          continue
        }
        
        // Check if this company/domain is blocked (zwarte lijst)
        if (domain || extracted.company_name) {
          let blockedQuery = supabaseAdmin
            .from('scraper_blocked_domains')
            .select('id')
            .limit(1)
          
          if (domain && extracted.company_name) {
            blockedQuery = blockedQuery.or(`domain.ilike.%${domain}%,company_name.ilike.%${extracted.company_name}%`)
          } else if (domain) {
            blockedQuery = blockedQuery.ilike('domain', `%${domain}%`)
          } else if (extracted.company_name) {
            blockedQuery = blockedQuery.ilike('company_name', `%${extracted.company_name}%`)
          }
          
          const { data: blocked } = await blockedQuery.maybeSingle()
          if (blocked) {
            continue // Skip blocked companies
          }
        }
        
        // Check if already an opportunity (never scrape opportunities again)
        if (extracted.company_name || (extracted.email && extracted.email.includes('@'))) {
          let oppQuery = supabaseAdmin
            .from('opportunities')
            .select('id, company_name, email')
            .limit(1)
          
          if (extracted.company_name && extracted.email && extracted.email.includes('@')) {
            oppQuery = oppQuery.or(`company_name.ilike.%${extracted.company_name}%,email.eq.${extracted.email}`)
          } else if (extracted.company_name) {
            oppQuery = oppQuery.ilike('company_name', `%${extracted.company_name}%`)
          } else if (extracted.email && extracted.email.includes('@')) {
            oppQuery = oppQuery.eq('email', extracted.email)
          }
          
          const { data: existingOpp } = await oppQuery.maybeSingle()
          if (existingOpp) {
            continue // Skip - already an opportunity, never scrape again
          }
        }
        
        seenDedupeKeys.add(dedupeKey)

        // Insert result
        const resultData = {
          job_id: job.id,
          source_url: result.url,
          source_domain: domain,
          company_name: extracted.company_name,
          website: extracted.website || null,
          phone: extracted.phone || null,
          email: extracted.email || null,
          address: extracted.address || null,
          city: extracted.city || null,
          postcode: extracted.postcode || null,
          country: job.only_nl ? 'NL' : 'NL',
          contact_person: extracted.contact_person || null,
          branch: extracted.branch || null,
          service_id: job.service_id,
          fit_score: extracted.fit_score || 0,
          fit_reason: extracted.fit_reason || null,
          confidence: extracted.confidence || {},
          raw_snippets: { content: content.substring(0, 2000) },
          dedupe_key: dedupeKey,
          is_duplicate: false,
          status: 'new'
        }

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('scraper_results')
          .insert(resultData)
          .select()
          .single()

        if (insertError) {
          console.error('Insert error:', insertError)
          continue
        }

        results.push(inserted)
        
        // Update progress IMMEDIATELY after each successful insert (non-blocking)
        // This ensures the frontend sees updates in real-time
        if (sharedCounters) {
          sharedCounters.totalFound++
          sharedCounters.totalEnriched++
          
          // Update database immediately (fire-and-forget to not block processing)
          // Wrap in async function to handle promise properly
          ;(async () => {
            try {
              await supabaseAdmin
                .from('scraper_jobs')
                .update({
                  progress_found: sharedCounters.totalFound,
                  progress_enriched: sharedCounters.totalEnriched
                })
                .eq('id', jobId)
            } catch (err) {
              // Ignore errors - we'll update in batch anyway
            }
          })()
        }
      }
    } catch (error) {
      console.error('Query processing error:', error)
      throw error
    }

    return results
  }
}

module.exports = ScraperService

