const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const AiMailService = require('./aiMailService');

/**
 * PartnerLandingPageService
 * 
 * CRUD operaties voor partner landingspagina's
 * AI-content generatie (later)
 * 
 * PLATFORM-FIRST FLOW:
 * - Nieuwe methodes (createPlatformLandingPage, etc.) maken NOOIT landingspagina's per partner/bedrijf
 * - partner_id blijft ALTIJD null in platform-flow
 * - URLs bevatten GEEN bedrijfs- of persoonsnamen
 */
class PartnerLandingPageService {
  /**
   * @deprecated Use createPlatformLandingPage instead for platform-first flow
   * Maak nieuwe landing page aan (LEGACY - partner-centric)
   */
  static async createLandingPage(partnerId, segmentId, config) {
    try {
      const landingPage = {
        partner_id: partnerId,
        segment_id: segmentId || null,
        path: config.path,
        status: config.status || 'concept',
        source: config.source || 'manual',
        title: config.title || 'Nieuwe Landingspagina',
        subtitle: config.subtitle || null,
        seo_title: config.seo_title || null,
        seo_description: config.seo_description || null,
        content_json: config.content_json || {}
      };
      
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .insert(landingPage)
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Created landing page ${data.id} for partner ${partnerId}`);
      return data;
      
    } catch (error) {
      logger.error('Error creating landing page:', error);
      throw error;
    }
  }
  
  /**
   * Update landing page content
   */
  static async updateLandingPageContent(landingPageId, updates) {
    try {
      const update = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .update(update)
        .eq('id', landingPageId)
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Updated landing page ${landingPageId}`);
      return data;
      
    } catch (error) {
      logger.error('Error updating landing page:', error);
      throw error;
    }
  }
  
  /**
   * Publiceer landing page
   */
  static async publishLandingPage(landingPageId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .update({
          status: 'live',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', landingPageId)
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Published landing page ${landingPageId}`);
      return data;
      
    } catch (error) {
      logger.error('Error publishing landing page:', error);
      throw error;
    }
  }
  
  /**
   * Verplaats naar review status
   */
  static async requestReview(landingPageId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .update({
          status: 'review',
          updated_at: new Date().toISOString()
        })
        .eq('id', landingPageId)
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Landing page ${landingPageId} moved to review`);
      return data;
      
    } catch (error) {
      logger.error('Error requesting review:', error);
      throw error;
    }
  }
  
  /**
   * @deprecated Use getLandingPageCluster instead for platform-first flow
   * Haal landing pages op voor partner (LEGACY - partner-centric)
   */
  static async getPartnerLandingPages(partnerId, filters = {}) {
    try {
      let query = supabaseAdmin
        .from('partner_landing_pages')
        .select(`
          *,
          lead_segments (code, branch, region)
        `)
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      
      if (filters.segment_id) {
        query = query.eq('segment_id', filters.segment_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      logger.error('Error getting partner landing pages:', error);
      throw error;
    }
  }
  
  /**
   * Haal landing page op
   */
  static async getLandingPage(landingPageId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .select(`
          *,
          lead_segments (code, branch, region),
          profiles (id, company_name)
        `)
        .eq('id', landingPageId)
        .single();
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      logger.error('Error getting landing page:', error);
      throw error;
    }
  }
  
  /**
   * Update views count (tracking)
   */
  static async trackView(landingPageId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .update({
          views_count: supabaseAdmin.raw('views_count + 1'),
          last_viewed_at: new Date().toISOString()
        })
        .eq('id', landingPageId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      logger.error('Error tracking view:', error);
      // Don't throw - tracking errors shouldn't break the flow
      return null;
    }
  }
  
  /**
   * Update conversions count
   */
  static async trackConversion(landingPageId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .update({
          conversions_count: supabaseAdmin.raw('conversions_count + 1')
        })
        .eq('id', landingPageId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      logger.error('Error tracking conversion:', error);
      return null;
    }
  }
  
  /**
   * @deprecated Use generateAIContentForPage instead for platform-first flow
   * Genereer AI content (placeholder) - LEGACY
   */
  static async generateAIContent(partnerId, segmentId, toneOfVoice) {
    try {
      // TODO: Implementeer AI content generatie
      // const aiService = require('../services/aiContentService');
      // const content = await aiService.generateLandingPageContent(partnerId, segmentId, toneOfVoice);
      
      logger.info(`Generated AI content for partner ${partnerId}, segment ${segmentId} (placeholder)`);
      
      return {
        title: 'AI Generated Title',
        subtitle: 'AI Generated Subtitle',
        seo_title: 'AI Generated SEO Title',
        seo_description: 'AI Generated SEO Description',
        content_json: {
          hero: {
            headline: 'AI Generated Headline',
            subheadline: 'AI Generated Subheadline'
          },
          features: [],
          testimonials: [],
          cta: {
            text: 'Contacteer Ons',
            button_text: 'Vraag Offerte Aan'
          }
        }
      };
      
    } catch (error) {
      logger.error('Error generating AI content:', error);
      throw error;
    }
  }

  // =====================================================
  // PLATFORM-FIRST METHODS (NEW)
  // =====================================================

  /**
   * Valideer path (geen bedrijfsnamen, e-mails, etc.)
   * @param {string} path - Path string
   * @returns {{valid: boolean, error?: string}}
   */
  static validatePath(path) {
    if (!path || typeof path !== 'string') {
      return { valid: false, error: 'Path must be a non-empty string' };
    }

    // Check: begint met /
    if (!path.startsWith('/')) {
      return { valid: false, error: 'Path must start with /' };
    }

    // Check: geen e-mail patterns
    if (path.includes('@') || path.includes('.com') || path.includes('.nl') || path.includes('.eu')) {
      return { valid: false, error: 'Path cannot contain email-like or domain patterns' };
    }

    // Check: lengte niet > 100
    if (path.length > 100) {
      return { valid: false, error: 'Path too long (max 100 characters)' };
    }

    // TODO: Optioneel - check tegen blacklist van bekende partner-namen
    // Dit kan later worden toegevoegd als er een blacklist is

    return { valid: true };
  }

  /**
   * Genereer path van segment + pageType
   * @param {Object} segment - Segment object met branch en region
   * @param {string} pageType - Page type ('main', 'cost', 'quote', 'spoed', etc.)
   * @returns {string} Generated path
   */
  static generatePathFromSegment(segment, pageType) {
    // Simple slugify helper
    const slugify = (str) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    };

    const branchSlug = slugify(segment.branch || segment.code || '');
    const regionSlug = slugify(segment.region || '');

    if (!branchSlug || !regionSlug) {
      throw new Error('Segment must have branch and region for path generation');
    }

    const pageTypeMap = {
      'main': '',
      'cost': '/kosten',
      'quote': '/offerte',
      'spoed': '/spoed',
      'service_variant': '/variant',
      'info': '/info'
    };

    const pageTypeSuffix = pageTypeMap[pageType] || '';
    return `/${branchSlug}/${regionSlug}${pageTypeSuffix}/`;
  }

  /**
   * Maak platform landing page aan (PLATFORM-FIRST)
   * 
   * BELANGRIJK: Deze methode maakt NOOIT landingspagina's per partner/bedrijf.
   * - partner_id blijft ALTIJD null in deze flow
   * - URLs bevatten GEEN bedrijfs- of persoonsnamen
   * - Gebruik generatePathFromSegment() voor path generatie
   * 
   * @param {Object} options - Landing page options
   * @param {string} options.siteId - Site ID
   * @param {string} options.segmentId - Segment ID
   * @param {string} options.pageType - Page type ('main', 'cost', 'quote', 'spoed', etc.)
   * @param {string} options.path - Path (moet gevalideerd zijn via validatePath())
   * @param {string} options.title - Title
   * @param {string} [options.subtitle] - Subtitle
   * @param {string} [options.seoTitle] - SEO title
   * @param {string} [options.seoDescription] - SEO description
   * @param {Object} [options.contentJson] - Content JSON
   * @param {string} [options.sourceType] - Source type (default: 'platform')
   * @returns {Promise<Object>} Created landing page
   */
  static async createPlatformLandingPage(options) {
    try {
      const {
        siteId,
        segmentId,
        pageType,
        path,
        title,
        subtitle = null,
        seoTitle = null,
        seoDescription = null,
        contentJson = {},
        sourceType = 'platform'
      } = options;

      // Validatie
      if (!siteId || !segmentId || !pageType || !path || !title) {
        throw new Error('siteId, segmentId, pageType, path, and title are required');
      }

      // Valideer pageType
      const allowedPageTypes = ['main', 'cost', 'quote', 'spoed', 'service_variant', 'info'];
      if (!allowedPageTypes.includes(pageType)) {
        throw new Error(`Invalid pageType. Must be one of: ${allowedPageTypes.join(', ')}`);
      }

      // Valideer path
      const pathValidation = this.validatePath(path);
      if (!pathValidation.valid) {
        throw new Error(`Invalid path: ${pathValidation.error}`);
      }

      // Valideer sourceType
      if (sourceType !== 'platform') {
        throw new Error('sourceType must be "platform" for platform-first flow');
      }

      // GUARDRAIL: Check max pages per cluster
      const MAX_PAGES_PER_CLUSTER = 6;
      const cluster = await this.getLandingPageCluster(siteId, segmentId);
      const existingPagesCount = [
        cluster.main,
        cluster.cost,
        cluster.quote,
        cluster.spoed,
        ...(cluster.others || [])
      ].filter(Boolean).length;

      if (existingPagesCount >= MAX_PAGES_PER_CLUSTER) {
        throw new Error(`MAX_PAGES_PER_CLUSTER guardrail: Cluster for site ${siteId}, segment ${segmentId} already has ${existingPagesCount} pages (max: ${MAX_PAGES_PER_CLUSTER})`);
      }

      // Check uniqueness (site_id, path)
      const { data: existing } = await supabaseAdmin
        .from('partner_landing_pages')
        .select('id')
        .eq('site_id', siteId)
        .eq('path', path)
        .single();

      if (existing) {
        throw new Error(`Landing page with path "${path}" already exists for this site`);
      }

      // Create landing page
      const landingPage = {
        partner_id: null, // PLATFORM-FIRST: altijd null
        site_id: siteId,
        segment_id: segmentId,
        page_type: pageType,
        path: path,
        status: 'concept', // Default status
        source_type: sourceType,
        title: title,
        subtitle: subtitle,
        seo_title: seoTitle,
        seo_description: seoDescription,
        content_json: contentJson
      };

      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .insert(landingPage)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Created platform landing page ${data.id} for site ${siteId}, segment ${segmentId}, pageType ${pageType}`);
      return data;

    } catch (error) {
      logger.error('Error creating platform landing page:', error);
      throw error;
    }
  }

  /**
   * Haal landing page op basis van site + path (voor public rendering)
   * @param {string} siteId - Site ID
   * @param {string} path - Path
   * @returns {Promise<Object|null>} Landing page of null
   */
  static async getLandingPageByPath(siteId, path) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .select(`
          *,
          lead_segments (code, branch, region),
          sites (id, name, domain, theme_key, positioning)
        `)
        .eq('site_id', siteId)
        .eq('path', path)
        .eq('status', 'live')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        throw error;
      }

      return data || null;

    } catch (error) {
      logger.error('Error getting landing page by path:', error);
      return null;
    }
  }

  /**
   * Haal landing page cluster op (alle pagina's voor site + segment)
   * @param {string} siteId - Site ID
   * @param {string} segmentId - Segment ID
   * @returns {Promise<Object>} Cluster object
   */
  static async getLandingPageCluster(siteId, segmentId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_landing_pages')
        .select('*')
        .eq('site_id', siteId)
        .eq('segment_id', segmentId)
        .in('status', ['live', 'concept', 'review'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      const cluster = {
        main: null,
        cost: null,
        quote: null,
        spoed: null,
        others: []
      };

      (data || []).forEach(page => {
        switch (page.page_type) {
          case 'main':
            cluster.main = page;
            break;
          case 'cost':
            cluster.cost = page;
            break;
          case 'quote':
            cluster.quote = page;
            break;
          case 'spoed':
            cluster.spoed = page;
            break;
          default:
            cluster.others.push(page);
        }
      });

      logger.debug(`getLandingPageCluster: Found ${(data || []).length} pages for site ${siteId}, segment ${segmentId}. Cluster: main=${!!cluster.main}, cost=${!!cluster.cost}, quote=${!!cluster.quote}, spoed=${!!cluster.spoed}, others=${cluster.others.length}`);

      return cluster;

    } catch (error) {
      logger.error('Error getting landing page cluster:', error);
      return {
        main: null,
        cost: null,
        quote: null,
        spoed: null,
        others: []
      };
    }
  }

  /**
   * Genereer AI content voor landing page (PLATFORM-FIRST)
   * @param {Object} options - Content generation options
   * @param {Object} options.site - Site object
   * @param {Object} options.segment - Segment object
   * @param {string} options.pageType - Page type ('main', 'cost', 'quote', 'spoed', etc.)
   * @param {string} [options.intent] - Intent description
   * @returns {Promise<Object>} Generated content
   */
  static async generateAIContentForPage({ site, segment, pageType, intent }) {
    try {
      if (!AiMailService.isOpenAIAvailable()) {
        logger.warn('OpenAI not available, returning placeholder content');
        return this.getPlaceholderContent(segment, pageType);
      }

      const openai = AiMailService.getOpenAIClient();
      if (!openai) {
        return this.getPlaceholderContent(segment, pageType);
      }

      // Build prompt
      const branch = segment.branch || segment.code || 'vakman';
      const region = segment.region || 'uw regio';
      const positioning = site.positioning || 'professioneel en betrouwbaar';
      
      const pageTypeDescriptions = {
        'main': 'hoofdpagina',
        'cost': 'kostenpagina',
        'quote': 'offertepagina',
        'spoed': 'spoedpagina',
        'service_variant': 'service variant pagina',
        'info': 'informatiepagina'
      };
      const pageTypeDesc = pageTypeDescriptions[pageType] || 'landingspagina';

      const prompt = `Je bent een expert in het schrijven van overtuigende landingspagina's voor lokale dienstverleners.

Context:
- Branche: ${branch}
- Regio: ${region}
- Pagina type: ${pageTypeDesc}
- Tone-of-voice: ${positioning}
- Intent: ${intent || `${branch} ${region} ${pageTypeDesc}`}

BELANGRIJK:
- De bezoeker kiest GEEN bedrijf; ons platform zoekt op de achtergrond de beste vakman uit.
- Gebruik GEEN bedrijfsnamen en beloof NIETS over een specifiek bedrijf.
- Focus op de dienst (${branch}) en de regio (${region}).
- Tone-of-voice: ${positioning}

Genereer een complete landingspagina structuur in JSON formaat met de volgende structuur:
{
  "title": "Hoofdtitel (max 60 karakters)",
  "subtitle": "Ondertitel (max 120 karakters)",
  "seoTitle": "SEO titel (max 60 karakters, bevat ${branch} ${region})",
  "seoDescription": "SEO beschrijving (max 160 karakters)",
  "content_json": {
    "hero": {
      "headline": "Hoofdheadline (max 80 karakters)",
      "subheadline": "Subheadline (max 120 karakters)",
      "cta_text": "Call-to-action tekst"
    },
    "features": [
      {
        "title": "Feature titel",
        "description": "Feature beschrijving"
      }
    ],
    "benefits": [
      {
        "title": "Voordeel titel",
        "description": "Voordeel beschrijving"
      }
    ],
    "cta": {
      "text": "CTA tekst",
      "button_text": "Button tekst"
    }
  }
}

Antwoord ALLEEN met geldige JSON, geen extra tekst.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het schrijven van overtuigende landingspagina\'s. Antwoord altijd in geldige JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated');
      }

      // Parse JSON (remove markdown code blocks if present)
      let parsed;
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        logger.error('Error parsing AI response:', parseError);
        return this.getPlaceholderContent(segment, pageType);
      }

      logger.info(`Generated AI content for ${branch} ${region} ${pageType}`);
      return parsed;

    } catch (error) {
      logger.error('Error generating AI content for page:', error);
      // Fallback naar placeholder
      return this.getPlaceholderContent(segment, pageType);
    }
  }

  /**
   * Placeholder content als AI niet beschikbaar is
   * @private
   */
  static getPlaceholderContent(segment, pageType) {
    const branch = segment.branch || segment.code || 'vakman';
    const region = segment.region || 'uw regio';

    return {
      title: `${branch.charAt(0).toUpperCase() + branch.slice(1)} in ${region}`,
      subtitle: `Vind de beste ${branch} in ${region}`,
      seoTitle: `${branch.charAt(0).toUpperCase() + branch.slice(1)} ${region} | Vraag Offerte Aan`,
      seoDescription: `Vind de beste ${branch} in ${region}. Vraag gratis offertes aan en vergelijk.`,
      content_json: {
        hero: {
          headline: `Beste ${branch} in ${region}`,
          subheadline: `Vind snel en eenvoudig de perfecte ${branch} voor uw project`,
          cta_text: 'Vraag gratis offerte aan'
        },
        features: [
          {
            title: 'Gratis offertes',
            description: 'Vraag gratis en vrijblijvend offertes aan'
          },
          {
            title: 'Betrouwbare vakmensen',
            description: 'Alleen geverifieerde professionals'
          },
          {
            title: 'Snel geregeld',
            description: 'Binnen 24 uur reactie van vakmensen'
          }
        ],
        benefits: [],
        cta: {
          text: 'Klaar om te beginnen?',
          button_text: 'Vraag Offerte Aan'
        }
      }
    };
  }
}

module.exports = PartnerLandingPageService;

