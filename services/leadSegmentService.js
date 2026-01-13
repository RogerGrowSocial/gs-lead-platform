'use strict'

const { supabaseAdmin } = require('../config/supabase')

/**
 * Lead Segment Service
 * 
 * Beheert segmenten (branche + regio combinaties) voor Lead Flow Intelligence
 */
class LeadSegmentService {
  /**
   * Vind of maak een segment op basis van branche en regio
   * @param {string} branch - Branche naam (bijv. 'schilder')
   * @param {string} region - Regio naam (bijv. 'noord-brabant')
   * @param {string} country - Land (default 'NL')
   * @returns {Promise<Object>} Segment object
   */
  /**
   * Vind of maak een segment op basis van branche en regio
   * NOTE: Segmenten worden nooit verwijderd, alleen gedeactiveerd (is_active = false).
   * Als een inactief segment bestaat, wordt het geactiveerd in plaats van een nieuw segment aan te maken.
   * 
   * @param {string} branch - Branche naam (bijv. 'schilder')
   * @param {string} region - Regio naam (bijv. 'noord-brabant')
   * @param {string} country - Land (default 'NL')
   * @returns {Promise<Object>} Segment object
   */
  static async findOrCreateSegment(branch, region, country = 'NL') {
    try {
      const branchLower = branch.toLowerCase().trim()
      const regionLower = region.toLowerCase().trim()
      const code = `${branchLower}_${regionLower}`.replace(/[^a-z0-9_]/g, '_')

      // Zoek eerst actief segment
      const { data: existingActive, error: findActiveError } = await supabaseAdmin
        .from('lead_segments')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single()

      if (existingActive && !findActiveError) {
        return existingActive
      }

      // Als geen actief segment, zoek inactief segment (om te reactiveren)
      const { data: existingInactive, error: findInactiveError } = await supabaseAdmin
        .from('lead_segments')
        .select('*')
        .eq('code', code)
        .eq('is_active', false)
        .single()

      if (existingInactive && !findInactiveError) {
        // Reactiveer bestaand inactief segment (nooit verwijderen!)
        const { data: reactivated, error: reactivateError } = await supabaseAdmin
          .from('lead_segments')
          .update({ is_active: true })
          .eq('id', existingInactive.id)
          .select()
          .single()

        if (reactivateError) {
          throw new Error(`Error reactivating segment: ${reactivateError.message}`)
        }

        return reactivated
      }

      // Maak nieuw segment (als er geen bestaat, actief of inactief)
      const { data: newSegment, error: createError } = await supabaseAdmin
        .from('lead_segments')
        .insert({
          code,
          branch: branchLower,
          region: regionLower,
          country: country.toLowerCase(),
          is_active: true
        })
        .select()
        .single()

      if (createError) {
        throw new Error(`Error creating segment: ${createError.message}`)
      }

      return newSegment
    } catch (error) {
      console.error('Error in findOrCreateSegment:', error)
      throw error
    }
  }

  /**
   * Wijs een segment toe aan een lead op basis van industry en regio
   * @param {string} leadId - UUID van de lead
   * @returns {Promise<Object|null>} Segment object of null als geen match
   */
  static async assignSegmentToLead(leadId) {
    try {
      // Haal lead op
      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('id, industry_id, province, postcode')
        .eq('id', leadId)
        .single()

      if (leadError || !lead) {
        throw new Error(`Lead not found: ${leadId}`)
      }

      // Als lead al een segment heeft, return die
      if (lead.segment_id) {
        const { data: segment } = await supabaseAdmin
          .from('lead_segments')
          .select('*')
          .eq('id', lead.segment_id)
          .single()
        return segment
      }

      // Haal industry op
      let industryName = null
      if (lead.industry_id) {
        const { data: industry } = await supabaseAdmin
          .from('industries')
          .select('name')
          .eq('id', lead.industry_id)
          .single()
        industryName = industry?.name || null
      }

      if (!industryName) {
        return null // Geen industry, geen segment
      }

      // Bepaal regio uit province of postcode
      const region = this.extractRegion(lead.province, lead.postcode)
      if (!region) {
        return null // Geen regio, geen segment
      }

      // Vind of maak segment
      const segment = await this.findOrCreateSegment(industryName, region)

      // Update lead met segment_id
      await supabaseAdmin
        .from('leads')
        .update({ segment_id: segment.id })
        .eq('id', leadId)

      return segment
    } catch (error) {
      console.error('Error in assignSegmentToLead:', error)
      throw error
    }
  }

  /**
   * Extraheer regio uit province of postcode
   * @param {string} province - Provincie naam
   * @param {string} postcode - Postcode
   * @returns {string|null} Regio naam of null
   */
  static extractRegion(province, postcode) {
    if (province) {
      // Normaliseer provincie naam
      const provinceMap = {
        'noord-holland': 'noord-holland',
        'zuid-holland': 'zuid-holland',
        'noord-brabant': 'noord-brabant',
        'gelderland': 'gelderland',
        'utrecht': 'utrecht',
        'friesland': 'friesland',
        'overijssel': 'overijssel',
        'groningen': 'groningen',
        'drenthe': 'drenthe',
        'flevoland': 'flevoland',
        'limburg': 'limburg',
        'zeeland': 'zeeland'
      }

      const provinceLower = province.toLowerCase().trim()
      return provinceMap[provinceLower] || provinceLower
    }

    if (postcode) {
      // Bepaal regio uit postcode prefix
      // Bijv. 1000-1299 = Amsterdam (Noord-Holland)
      // Dit is een vereenvoudigde mapping - kan later uitgebreid worden
      const postcodeNum = parseInt(postcode.replace(/\D/g, ''))
      if (postcodeNum >= 1000 && postcodeNum < 2000) {
        return 'noord-holland'
      } else if (postcodeNum >= 2000 && postcodeNum < 3000) {
        return 'zuid-holland'
      } else if (postcodeNum >= 5000 && postcodeNum < 6000) {
        return 'noord-brabant'
      }
      // etc. - kan uitgebreid worden
    }

    return null
  }

  /**
   * Haal alle actieve segmenten op
   * @returns {Promise<Array>} Array van segmenten
   */
  static async getAllActiveSegments() {
    try {
      const { data: segments, error } = await supabaseAdmin
        .from('lead_segments')
        .select('*')
        .eq('is_active', true)
        .order('branch', { ascending: true })
        .order('region', { ascending: true })

      if (error) {
        throw new Error(`Error fetching segments: ${error.message}`)
      }

      return segments || []
    } catch (error) {
      console.error('Error in getAllActiveSegments:', error)
      throw error
    }
  }

  /**
   * Haal segment op bij ID
   * @param {string} segmentId - UUID van het segment
   * @returns {Promise<Object>} Segment object
   */
  static async getSegmentById(segmentId) {
    try {
      const { data: segment, error } = await supabaseAdmin
        .from('lead_segments')
        .select('*')
        .eq('id', segmentId)
        .single()

      if (error || !segment) {
        throw new Error(`Segment not found: ${segmentId}`)
      }

      return segment
    } catch (error) {
      console.error('Error in getSegmentById:', error)
      throw error
    }
  }

  /**
   * Haal capaciteit op voor een segment (gebruikt bestaande partner data)
   * @param {string} segmentId - UUID van het segment
   * @returns {Promise<Object>} Capaciteit data
   */
  static async getSegmentCapacity(segmentId) {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_segment_capacity', {
        p_segment_id: segmentId
      })

      if (error) {
        throw new Error(`Error getting segment capacity: ${error.message}`)
      }

      return data && data.length > 0 ? data[0] : {
        capacity_partners: 0,
        capacity_total_leads: 0,
        current_open_leads: 0
      }
    } catch (error) {
      console.error('Error in getSegmentCapacity:', error)
      throw error
    }
  }
}

module.exports = LeadSegmentService

