'use strict'

const { supabaseAdmin } = require('../config/supabase')
const GoogleAdsClient = require('../integrations/googleAdsClient')

/**
 * Aggregate Lead Stats Daily Cronjob
 * 
 * Aggregeert dagelijks leads naar lead_generation_stats per segment
 * Moet dagelijks draaien (bijv. om 01:00)
 */
async function aggregateLeadStatsDaily() {
  try {
    console.log('📊 Starting daily lead stats aggregation...')

    // Bereken gisteren (voor volledige dag data)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const dateStr = yesterday.toISOString().split('T')[0]

    console.log(`📅 Aggregating stats for: ${dateStr}`)

    // Haal alle actieve segmenten op
    const { data: segments, error: segmentsError } = await supabaseAdmin
      .from('lead_segments')
      .select('id, code, branch, region')
      .eq('is_active', true)

    if (segmentsError) {
      throw new Error(`Error fetching segments: ${segmentsError.message}`)
    }

    if (!segments || segments.length === 0) {
      console.log('⚠️ No active segments found')
      return {
        success: true,
        segmentsProcessed: 0,
        message: 'No active segments to process'
      }
    }

    console.log(`📋 Processing ${segments.length} segments...`)

    const results = []

    for (const segment of segments) {
      try {
        // Aggregeer leads voor dit segment op deze datum
        const stats = await aggregateSegmentStats(segment, dateStr)

        // Upsert naar lead_generation_stats
        const { data: upsertedStats, error: upsertError } = await supabaseAdmin
          .from('lead_generation_stats')
          .upsert({
            segment_id: segment.id,
            date: dateStr,
            ...stats,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'segment_id,date'
          })
          .select()
          .single()

        if (upsertError) {
          throw new Error(`Error upserting stats: ${upsertError.message}`)
        }

        results.push({
          segmentId: segment.id,
          segmentCode: segment.code,
          success: true,
          stats
        })

        console.log(`✅ Aggregated stats for ${segment.code}: ${stats.leads_generated} leads`)
      } catch (error) {
        console.error(`❌ Error aggregating stats for segment ${segment.code}:`, error)
        results.push({
          segmentId: segment.id,
          segmentCode: segment.code,
          success: false,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length

    console.log(`✅ Aggregation completed: ${successCount}/${segments.length} segments processed`)

    return {
      success: true,
      date: dateStr,
      segmentsProcessed: successCount,
      totalSegments: segments.length,
      results
    }
  } catch (error) {
    console.error('❌ Error in aggregateLeadStatsDaily:', error)
    throw error
  }
}

/**
 * Aggregeer stats voor een segment op een datum
 * @param {Object} segment - Segment object
 * @param {string} dateStr - Datum string (YYYY-MM-DD)
 * @returns {Promise<Object>} Stats object
 */
async function aggregateSegmentStats(segment, dateStr) {
  // Tel leads per status
  const { data: leads, error: leadsError } = await supabaseAdmin
    .from('leads')
    .select('status, price_at_purchase, created_at')
    .eq('segment_id', segment.id)
    .gte('created_at', `${dateStr}T00:00:00`)
    .lt('created_at', `${dateStr}T23:59:59`)

  if (leadsError) {
    throw new Error(`Error fetching leads: ${leadsError.message}`)
  }

  const leadsList = leads || []

  // Bereken metrics
  const leads_generated = leadsList.length
  const leads_accepted = leadsList.filter(l => l.status === 'accepted').length
  const leads_rejected = leadsList.filter(l => l.status === 'rejected').length
  const leads_pending = leadsList.filter(l => l.status === 'new' || l.status === 'pending').length

  // Bereken average CPL
  const acceptedLeads = leadsList.filter(l => l.status === 'accepted' && l.price_at_purchase)
  const avg_cpl = acceptedLeads.length > 0
    ? acceptedLeads.reduce((sum, l) => sum + parseFloat(l.price_at_purchase || 0), 0) / acceptedLeads.length
    : null

  // Bereken total revenue
  const total_revenue = acceptedLeads.reduce((sum, l) => sum + parseFloat(l.price_at_purchase || 0), 0)

  // Haal capaciteit op (gebruikt bestaande partner data)
  const { data: capacityData, error: capacityError } = await supabaseAdmin.rpc('get_segment_capacity', {
    p_segment_id: segment.id
  })

  const capacity = capacityData && capacityData.length > 0 ? capacityData[0] : {
    capacity_partners: 0,
    capacity_total_leads: 0,
    current_open_leads: 0
  }

  // Haal Google Ads stats op (placeholder voor nu)
  const googleAdsStats = await GoogleAdsClient.getCampaignStats(segment.code, new Date(dateStr))

  // Tel partner leads (leads die toegewezen zijn aan partners)
  const { data: partnerLeads, error: partnerLeadsError } = await supabaseAdmin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('segment_id', segment.id)
    .not('assigned_to', 'is', null)
    .gte('created_at', `${dateStr}T00:00:00`)
    .lt('created_at', `${dateStr}T23:59:59`)

  const partner_leads = partnerLeadsError ? 0 : (partnerLeads || 0)

  return {
    leads_generated,
    leads_accepted,
    leads_rejected,
    leads_pending,
    avg_cpl: avg_cpl ? Math.round(avg_cpl * 100) / 100 : null,
    total_revenue: Math.round(total_revenue * 100) / 100,
    google_ads_spend: googleAdsStats.spend || 0,
    google_ads_clicks: googleAdsStats.clicks || 0,
    google_ads_impressions: googleAdsStats.impressions || 0,
    seo_clicks: 0, // TODO: Implementeer SEO tracking
    seo_visits: 0, // TODO: Implementeer SEO tracking
    microsite_visits: 0, // TODO: Implementeer microsite tracking
    microsite_leads: 0, // TODO: Implementeer microsite tracking
    partner_leads,
    capacity_partners: capacity.capacity_partners || 0,
    capacity_total_leads: capacity.capacity_total_leads || 0
  }
}

// If run directly (not as module)
if (require.main === module) {
  aggregateLeadStatsDaily()
    .then(result => {
      console.log('✅ Cronjob completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Cronjob failed:', error)
      process.exit(1)
    })
}

module.exports = aggregateLeadStatsDaily

