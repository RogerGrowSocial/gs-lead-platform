const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate AI-powered ad copy (headlines and descriptions) for Google Ads RSA
 * @param {Object} params
 * @param {string} params.branch - Service branch (e.g., 'timmerman', 'schilder', 'installatiebedrijven')
 * @param {string} params.region - Region name (e.g., 'Noord-Brabant', 'Friesland')
 * @param {string} params.intentType - Ad group intent type ('location', 'intent', 'urgency', 'general')
 * @param {string[]} params.keywordTexts - Array of keyword strings used for the ad group
 * @param {string} params.language - Language code (default: 'nl-NL')
 * @returns {Promise<Object|null>} Object with headlines and descriptions arrays, or null on error
 */
async function generateAdCopy({ branch, region, intentType, keywordTexts = [], language = 'nl-NL' }) {
  if (!process.env.OPENAI_API_KEY) {
    logger?.warn?.('⚠️ OPENAI_API_KEY not set, skipping AI ad copy generation');
    return null;
  }

  try {
    // Normalize and dedupe keyword texts for the prompt
    const normalizedKeywords = [...new Set(
      keywordTexts
        .filter(k => k && typeof k === 'string')
        .map(k => k.replace(/[\[\]"]/g, '').trim())
        .filter(k => k.length > 0)
    )].slice(0, 10); // Limit to top 10 for prompt clarity

    // Build intent context
    let intentContext = '';
    if (intentType === 'intent') {
      intentContext = 'De ad group richt zich op gebruikers met koopintentie (offerte, prijs, kosten).';
    } else if (intentType === 'urgency') {
      intentContext = 'De ad group richt zich op spoedklussen (vandaag, snel, 24u, spoed).';
    } else if (intentType === 'location') {
      intentContext = 'De ad group richt zich op locatie-gerelateerde zoekopdrachten.';
    }

    // Extract key modifiers from keywords
    const keywordText = normalizedKeywords.join(', ');
    const hasOfferte = keywordText.toLowerCase().includes('offerte');
    const hasPrijs = keywordText.toLowerCase().includes('prijs') || keywordText.toLowerCase().includes('tarief');
    const hasKosten = keywordText.toLowerCase().includes('kosten');
    const hasRecensies = keywordText.toLowerCase().includes('recensie') || keywordText.toLowerCase().includes('review') || keywordText.toLowerCase().includes('ervaring');
    const hasSpoed = keywordText.toLowerCase().includes('spoed') || keywordText.toLowerCase().includes('vandaag') || keywordText.toLowerCase().includes('24u');

    const model = process.env.AI_AD_MODEL || 'gpt-4o-mini';

    const systemPrompt = `Je bent een expert in Google Ads copywriting voor lokale dienstverleners in Nederland. 
Je genereert RESPONSIVE SEARCH AD (RSA) copy die:
- Hoog conversiepercentage heeft
- Relevante zoekwoorden bevat
- Natuurlijk en overtuigend Nederlands is
- Verschillende invalshoeken gebruikt

ANTWOORD ALLEEN MET GELDIG JSON, GEEN EXTRA TEKST, GEEN MARKDOWN CODE BLOCKS.`;

    const userPrompt = `Genereer Google Ads RSA copy voor:

BRANCHE: ${branch}
REGIO: ${region}
INTENT TYPE: ${intentType}
${intentContext ? `CONTEXT: ${intentContext}` : ''}
BELANGRIJKE ZOEKWOORDEN: ${normalizedKeywords.length > 0 ? normalizedKeywords.join(', ') : 'Geen specifieke keywords'}

EISEN:
1. Headlines (min 8, max 15):
   - PREFERABLY ≤ 30 karakters (we trimmen later, maar probeer binnen limiet te blijven)
   - Minimaal 70% MOET zowel "${branch}" als "${region}" bevatten
   - Gebruik belangrijke keyword phrases in meerdere headlines: ${hasOfferte ? 'offerte, ' : ''}${hasPrijs ? 'prijs, ' : ''}${hasKosten ? 'kosten, ' : ''}${hasRecensies ? 'recensies/ervaring, ' : ''}${hasSpoed ? 'spoed/snel, ' : ''}
   - Geen afgebroken woorden - elke headline moet een complete, natuurlijke zin zijn
   - Variatie in invalshoeken: directe service, prijs, kwaliteit, snelheid, lokale focus

2. Descriptions (min 3, max 4):
   - 60-90 karakters per description
   - Elke description MOET zowel "${branch}" als "${region}" bevatten
   - 4 verschillende invalshoeken:
     a) Service + regio + CTA (vrijblijvende offerte, snel reactie)
     b) Prijs/kosten/transparante tarieven
     c) Reviews/kwaliteit/9+ beoordeling
     d) Snelheid/spoed/binnen 24u
   - Geen afgebroken woorden - complete zinnen

ANTWOORD ALLEEN MET DIT JSON FORMAAT (geen extra tekst, geen markdown):
{
  "headlines": ["headline 1", "headline 2", ...],
  "descriptions": ["description 1", "description 2", ...]
}`;

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7, // Some creativity for variation
      max_tokens: 1500
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      logger?.warn?.('⚠️ AI ad copy generation returned empty content');
      return null;
    }

    // Parse JSON - handle markdown code blocks if present
    let jsonText = content.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const result = JSON.parse(jsonText);

    // Validate structure
    if (!result || typeof result !== 'object') {
      logger?.warn?.('⚠️ AI ad copy generation returned invalid structure');
      return null;
    }

    // Ensure arrays exist
    if (!Array.isArray(result.headlines)) {
      result.headlines = [];
    }
    if (!Array.isArray(result.descriptions)) {
      result.descriptions = [];
    }

    // Filter out empty/null values
    result.headlines = result.headlines.filter(h => h && typeof h === 'string' && h.trim().length > 0);
    result.descriptions = result.descriptions.filter(d => d && typeof d === 'string' && d.trim().length > 0);

    logger?.info?.(`✅ AI generated ${result.headlines.length} headlines and ${result.descriptions.length} descriptions for ${branch} ${region}`);

    return result;
  } catch (error) {
    logger?.error?.('❌ AI ad copy generation failed:', {
      branch,
      region,
      intentType,
      error: error.message || String(error),
      stack: error.stack
    });
    return null;
  }
}

module.exports = {
  generateAdCopy
};
