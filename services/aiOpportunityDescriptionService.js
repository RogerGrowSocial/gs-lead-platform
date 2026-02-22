'use strict'

const AiMailService = require('./aiMailService')

/**
 * Genereert automatisch een korte, professionele beschrijving voor een kans op basis van
 * de binnengekomen gegevens (bedrijf, contact, e-mail, telefoon, eventueel payload).
 */
async function generateOpportunityDescription(mapped, rawPayload = {}) {
  const openai = AiMailService.getOpenAIClient()
  if (!openai) return null

  const company = (mapped.company_name || mapped.title || '').trim()
  const contact = (mapped.contact_name || '').trim()
  const email = (mapped.email || '').trim()
  const phone = (mapped.phone || '').trim()
  const notes = (mapped.notes || mapped.description || '').trim()
  const value = mapped.value != null ? String(mapped.value) : ''

  // Bouw een korte context uit payload voor de AI (niet de hele raw dump)
  const payloadSnippet = typeof rawPayload === 'object' && rawPayload !== null
    ? [
        rawPayload.message || rawPayload.bericht || rawPayload.vraag,
        rawPayload.onderwerp || rawPayload.subject,
        rawPayload.opmerkingen || rawPayload.notes,
        rawPayload.description
      ].filter(Boolean).map(s => String(s).slice(0, 300)).join(' ')
    : ''

  const context = [
    company && `Bedrijf: ${company}`,
    contact && `Contact: ${contact}`,
    email && `E-mail: ${email}`,
    phone && `Telefoon: ${phone}`,
    value && `Indicatieve waarde: ${value}`,
    notes && `Notities: ${notes.slice(0, 400)}`,
    payloadSnippet && `Inhoud: ${payloadSnippet.slice(0, 500)}`
  ].filter(Boolean).join('\n')

  if (!context.trim()) return null

  const prompt = `Maak een korte, professionele beschrijving voor deze verkoopkans in het Nederlands.
De beschrijving moet:
- In 2 tot 4 zinnen samenvatten wat de kans inhoudt (bedrijf/contact + eventueel vraag of interesse).
- Geen opsommingen of bullets; gewone lopende tekst.
- Geen placeholdertekst als er geen inhoud is; dan één korte zin op basis van bedrijf/contact.

Gegevens:
${context}

Geef alleen de beschrijving terug, geen andere tekst.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een CRM-assistent. Geef alleen de gevraagde beschrijving terug, in het Nederlands, zonder intro of uitleg.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 300
    })

    const description = completion.choices?.[0]?.message?.content?.trim() || null
    return description || null
  } catch (err) {
    console.warn('AI kansbeschrijving genereren mislukt:', err.message)
    return null
  }
}

/**
 * Schat de waarde van een kans in euro's op basis van context (bedrijf, beschrijving, inhoud).
 * Retourneert een getal (eur) of null bij geen inschatting.
 */
async function estimateOpportunityValue(mapped, rawPayload = {}) {
  const openai = AiMailService.getOpenAIClient()
  if (!openai) return null

  const company = (mapped.company_name || mapped.title || '').trim()
  const contact = (mapped.contact_name || '').trim()
  const description = (
    (typeof rawPayload === 'object' && rawPayload !== null && rawPayload._generatedDescription) ||
    mapped.description ||
    mapped.notes ||
    ''
  ).trim()
  const payloadSnippet = typeof rawPayload === 'object' && rawPayload !== null
    ? [
        rawPayload.message || rawPayload.bericht || rawPayload.vraag,
        rawPayload.onderwerp || rawPayload.subject,
        rawPayload.budget || rawPayload.waarde,
        rawPayload.type || rawPayload.soort
      ].filter(Boolean).map(s => String(s).slice(0, 200)).join(' ')
    : ''

  const context = [
    company && `Bedrijf: ${company}`,
    contact && `Contact: ${contact}`,
    description && `Beschrijving: ${description.slice(0, 400)}`,
    payloadSnippet && `Inhoud aanvraag: ${payloadSnippet}`
  ].filter(Boolean).join('\n')

  if (!context.trim()) return null

  const prompt = `Schat de geschatte dealwaarde in euro's voor deze verkoopkans. Baseer je op type aanvraag, bedrijfsgrootte (als uit tekst blijkt), en context.
Geef ALLEEN een JSON object terug met exact deze velden:
- "value_eur": getal (geheel getal, geschatte omzet in euro's; bij onduidelijkheid een conservatieve inschatting)
- "confidence": getal tussen 0 en 1 (hoe zeker de inschatting)

Gegevens:
${context}

Voorbeelden: kleine website/aanpassing 1500-5000, middelgroot project 5000-15000, grote opdracht 15000+. Geef alleen het JSON object.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een sales expert. Geef alleen een geldig JSON object met value_eur (getal) en confidence (0-1), geen andere tekst.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 80
    })

    const raw = completion.choices?.[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(raw)
    const value = parsed?.value_eur != null ? Number(parsed.value_eur) : null
    if (value === null || Number.isNaN(value) || value < 0) return null
    return Math.round(value)
  } catch (err) {
    console.warn('AI kanswaarde inschatten mislukt:', err.message)
    return null
  }
}

module.exports = {
  generateOpportunityDescription,
  estimateOpportunityValue
}
