const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * SiteService
 * 
 * Service voor het beheren en ophalen van sites (multi-site / multi-brand support)
 * 
 * PLATFORM-FIRST: Deze service is bedoeld voor platform-level site management,
 * niet voor partner-specifieke sites.
 */
class SiteService {
  // In-memory cache voor sites (domain -> site object)
  static cache = new Map();
  
  // Cache TTL: 5 minuten (in milliseconds)
  static CACHE_TTL = 5 * 60 * 1000;
  
  // Default site cache (singleton)
  static defaultSiteCache = null;
  static defaultSiteCacheTime = null;

  /**
   * Normaliseer domain (lowercase, verwijder poort, etc.)
   * @param {string} domain - Domain string (kan hostname zijn met poort)
   * @returns {string} Genormaliseerd domain
   */
  static normalizeDomain(domain) {
    if (!domain) return null;
    
    // Verwijder protocol als aanwezig
    domain = domain.replace(/^https?:\/\//, '');
    
    // Verwijder poort als aanwezig
    domain = domain.split(':')[0];
    
    // Verwijder trailing slash
    domain = domain.replace(/\/$/, '');
    
    // Lowercase
    domain = domain.toLowerCase().trim();
    
    return domain;
  }

  /**
   * Haal site op basis van domain
   * @param {string} domain - Domain of hostname
   * @returns {Promise<Object|null>} Site object of null
   */
  static async getSiteByDomain(domain) {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      if (!normalizedDomain) {
        logger.warn('Invalid domain provided to getSiteByDomain:', domain);
        return await this.getDefaultSite();
      }

      // Check cache
      const cached = this.cache.get(normalizedDomain);
      if (cached) {
        const { site, timestamp } = cached;
        const age = Date.now() - timestamp;
        if (age < this.CACHE_TTL) {
          logger.debug(`Cache hit for domain: ${normalizedDomain}`);
          return site;
        } else {
          // Cache expired, remove
          this.cache.delete(normalizedDomain);
        }
      }

      // Query database
      const { data, error } = await supabaseAdmin
        .from('sites')
        .select('*')
        .eq('domain', normalizedDomain)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          logger.debug(`No site found for domain: ${normalizedDomain}, falling back to default`);
          return await this.getDefaultSite();
        }
        throw error;
      }

      if (!data) {
        logger.debug(`No active site found for domain: ${normalizedDomain}, falling back to default`);
        return await this.getDefaultSite();
      }

      // Cache result
      this.cache.set(normalizedDomain, {
        site: data,
        timestamp: Date.now()
      });

      logger.info(`Site resolved for domain: ${normalizedDomain} -> ${data.name}`);
      return data;

    } catch (error) {
      logger.error('Error in getSiteByDomain:', error);
      // Fallback naar default site bij errors
      return await this.getDefaultSite();
    }
  }

  /**
   * Haal site op basis van ID
   * @param {string} siteId - Site UUID
   * @returns {Promise<Object|null>} Site object of null
   */
  static async getSiteById(siteId) {
    try {
      if (!siteId) {
        logger.warn('No siteId provided to getSiteById');
        return await this.getDefaultSite();
      }

      // Query database
      const { data, error } = await supabaseAdmin
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          logger.debug(`No site found for ID: ${siteId}, falling back to default`);
          return await this.getDefaultSite();
        }
        throw error;
      }

      if (!data) {
        logger.debug(`No active site found for ID: ${siteId}, falling back to default`);
        return await this.getDefaultSite();
      }

      logger.debug(`Site resolved for ID: ${siteId} -> ${data.name}`);
      return data;

    } catch (error) {
      logger.error('Error in getSiteById:', error);
      // Fallback naar default site bij errors
      return await this.getDefaultSite();
    }
  }

  /**
   * Haal default site op (Main Platform)
   * @returns {Promise<Object|null>} Default site object
   */
  static async getDefaultSite() {
    try {
      // Check cache
      if (this.defaultSiteCache && this.defaultSiteCacheTime) {
        const age = Date.now() - this.defaultSiteCacheTime;
        if (age < this.CACHE_TTL) {
          logger.debug('Cache hit for default site');
          return this.defaultSiteCache;
        }
      }

      // Query database: eerst proberen 'Main Platform'
      let { data, error } = await supabaseAdmin
        .from('sites')
        .select('*')
        .eq('name', 'Main Platform')
        .eq('is_active', true)
        .single();

      // Als niet gevonden, pak eerste actieve site
      if (error || !data) {
        logger.debug('Main Platform not found, fetching first active site');
        const { data: firstActive, error: firstError } = await supabaseAdmin
          .from('sites')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (firstError || !firstActive) {
          logger.error('No active sites found in database');
          return null;
        }

        data = firstActive;
      }

      // Cache result
      this.defaultSiteCache = data;
      this.defaultSiteCacheTime = Date.now();

      logger.info(`Default site resolved: ${data.name} (${data.domain})`);
      return data;

    } catch (error) {
      logger.error('Error in getDefaultSite:', error);
      return null;
    }
  }

  /**
   * Lijst alle actieve sites
   * @returns {Promise<Array>} Array van site objects
   */
  static async listActiveSites() {
    try {
      const { data, error } = await supabaseAdmin
        .from('sites')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      logger.debug(`Listed ${data?.length || 0} active sites`);
      return data || [];

    } catch (error) {
      logger.error('Error in listActiveSites:', error);
      return [];
    }
  }

  /**
   * Clear cache (voor testing of manual refresh)
   */
  static clearCache() {
    this.cache.clear();
    this.defaultSiteCache = null;
    this.defaultSiteCacheTime = null;
    logger.debug('Site cache cleared');
  }
}

module.exports = SiteService;

