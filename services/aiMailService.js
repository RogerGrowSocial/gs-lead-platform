'use strict'

const OpenAI = require('openai')

class AiMailService {
  // Initialize OpenAI client (only if API key is available)
  static getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return null
    }
    return new OpenAI({ apiKey })
  }

  // Check if OpenAI is configured
  static isOpenAIAvailable() {
    return !!process.env.OPENAI_API_KEY
  }
  static inferLabels(mail) {
    const labels = []
    const text = `${mail.subject || ''} ${mail.body_text || ''}`.toLowerCase()
    const from = (mail.from_email || '').toLowerCase()

    const push = (label, confidence) => labels.push({ label, confidence })

    // Newsletter/Spam detection - mark as junk for easy filtering
    if (from.includes('news@') || from.includes('newsletter') || from.includes('noreply') || from.includes('no-reply') ||
        text.includes('unsubscribe') || text.includes('afmelden') || text.includes('uitschrijven') ||
        text.includes('newsletter') || text.includes('nieuwsbrief') || text.includes('marketing') ||
        text.includes('promotie') || text.includes('aanbieding') || text.includes('korting')) {
      push('junk', 0.95) // Mark as junk/spam instead of just newsletter
      push('newsletter', 0.90) // Also keep newsletter label for filtering
    }
    // Lead detection: new business opportunities, pricing questions, new website requests
    if (text.includes('nieuwe website') || text.includes('website laten maken') || 
        text.includes('hoeveel kost') || text.includes('prijs') || text.includes('kosten') ||
        text.includes('offerte') || text.includes('interesse') || text.includes('mogelijkheden') ||
        text.includes('graag een') || text.includes('wil graag')) {
      push('lead', 0.90)
    }
    // Order confirmations / Payment confirmations (bevestiging)
    if (text.includes('order confirmation') || text.includes('orderbevestiging') || text.includes('bestelling verzonden') ||
        text.includes('bestelling ontvangen') || text.includes('your order') || text.includes('uw bestelling') ||
        text.includes('payment received') || text.includes('betaling ontvangen') || text.includes('payment completed') ||
        text.includes('betaling voltooid') || text.includes('payment successful') || text.includes('betaling geslaagd') ||
        text.includes('verzendbevestiging') || text.includes('shipping confirmation') || text.includes('is verzonden') ||
        from.includes('klarna') || from.includes('paypal') || from.includes('stripe') || from.includes('mollie') ||
        text.includes('klarna') || text.includes('paypal') || text.includes('stripe')) {
      push('bevestiging', 0.95)
      // Don't mark as customer_request if it's just a confirmation
      if (!text.includes('vraag') && !text.includes('probleem') && !text.includes('help')) {
        return labels.length > 0 ? labels : [{ label: 'bevestiging', confidence: 0.95 }]
      }
    }
    
    // Invoices / Facturen
    if (text.includes('factuur') || text.includes('invoice') || text.includes('rekening') ||
        text.includes('te betalen') || text.includes('payment due') || text.includes('amount due') ||
        text.includes('bill') || text.includes('betalingsverzoek') || text.includes('payment request') ||
        (text.includes('€') && (text.includes('betaling') || text.includes('payment')) && text.includes('vervalt'))) {
      push('factuur', 0.95)
    }
    
    // Customer request: support for existing services (but not confirmations/invoices)
    if (!text.includes('order confirmation') && !text.includes('payment received') && !text.includes('factuur') &&
        (text.includes('aanvraag') || text.includes('support') || text.includes('help') || text.includes('probleem'))) {
      push('customer_request', 0.85)
      // Also add support label if it's clearly a support request
      if (text.includes('aanpassing') || text.includes('aanpassen') || text.includes('wijzigen') || 
          text.includes('toevoegen') || text.includes('verwijderen') || text.includes('probleem') ||
          text.includes('fout') || text.includes('werkt niet') || text.includes('kapot') ||
          text.includes('support') || text.includes('help') || text.includes('hulp')) {
        push('support', 0.80)
      }
    }
    if (text.includes('dringend') || text.includes('urgent') || text.includes('asap')) {
      push('urgent', 0.80)
    }
    if (text.includes('introductie') || text.includes('samenwerking') && !text.includes('nieuwe')) {
      push('cold_mail', 0.70)
    }
    if (text.includes('lottery') || text.includes('bitcoin') || text.includes('casino')) {
      push('junk', 0.90)
    }

    if (labels.length === 0) push('other', 0.50)
    return labels
  }

  /**
   * Analyze email to determine if it needs a ticket and what priority
   * @param {Object} mail - Mail object with subject, body_text, from_email, labels
   * @returns {Object} - { shouldCreateTicket: boolean, priority: string, reason: string }
   */
  static analyzeTicketNeeds(mail) {
    const text = `${mail.subject || ''} ${mail.body_text || ''}`.toLowerCase()
    const labels = mail.labels || []
    const hasCustomerRequest = labels.includes('customer_request') || labels.includes('support')
    
    // If not a customer request, don't create ticket
    if (!hasCustomerRequest) {
      return {
        shouldCreateTicket: false,
        priority: 'normal',
        reason: 'Not a customer request'
      }
    }

    // Check for questions/issues
    const questionPatterns = [
      /\?/g, // Has question mark
      /(hoe|wat|waar|wanneer|waarom|wie|kan|kunnen|wil|willen|moet|moeten|zou|zouden)/i,
      /(vraag|vragen|probleem|problemen|fout|fouten|werkt niet|werkt niet goed|kapot|breekt|crash|error|foutmelding)/i,
      /(aanpassen|aanpassing|wijzigen|wijziging|veranderen|verandering|toevoegen|toevoeging|verwijderen|verwijdering)/i,
      /(help|hulp|assistentie|support|ondersteuning|advies|raad)/i
    ]

    const hasQuestion = questionPatterns.some(pattern => pattern.test(text))
    
    if (!hasQuestion) {
      return {
        shouldCreateTicket: false,
        priority: 'normal',
        reason: 'No clear question or issue detected'
      }
    }

    // Determine priority based on urgency indicators
    let priority = 'normal'
    let reason = 'Customer question detected'

    // HIGH PRIORITY: Critical issues, errors, broken functionality
    const highPriorityPatterns = [
      /(fout|fouten|error|foutmelding|werkt niet|werkt niet goed|kapot|breekt|crash|down|niet bereikbaar|niet beschikbaar)/i,
      /(dringend|urgent|asap|zo snel mogelijk|meteen|direct|onmiddellijk|spoed)/i,
      /(kritiek|kritisch|belangrijk|essentieel|noodzakelijk)/i,
      /(klant|klanten|gebruiker|gebruikers).*(kan|kunnen).*(niet|geen)/i,
      /(website|site|systeem|platform).*(werkt|functioneert|bereikbaar).*(niet|geen)/i
    ]

    if (highPriorityPatterns.some(pattern => pattern.test(text))) {
      priority = 'high'
      reason = 'Critical issue or urgent request detected'
    }

    // URGENT: System down, security issues, payment problems
    const urgentPatterns = [
      /(volledig|helemaal|totaal).*(down|offline|niet bereikbaar|niet beschikbaar)/i,
      /(betalen|betaling|factuur|invoice|rekening).*(niet|geen|fout|probleem)/i,
      /(veiligheid|security|hack|gehackt|lek|lekken)/i,
      /(data|gegevens|informatie).*(verloren|weg|verwijderd|gewist)/i
    ]

    if (urgentPatterns.some(pattern => pattern.test(text))) {
      priority = 'urgent'
      reason = 'Urgent issue detected (system down, security, payment)'
    }

    // LOW PRIORITY: General questions, feature requests, non-critical
    const lowPriorityPatterns = [
      /(vraag|vragen|informatie|info|meer weten|uitleg|uitleggen)/i,
      /(mogelijk|mogelijkheid|kunnen|zouden).*(toevoegen|aanpassen|wijzigen|veranderen)/i,
      /(suggestie|idee|voorstel|advies)/i
    ]

    // Only set low if not already high/urgent
    if (priority === 'normal' && lowPriorityPatterns.some(pattern => pattern.test(text))) {
      // Check if it's a simple question without urgency
      const isSimpleQuestion = text.split(/[.!?]/).length < 5 && 
                               !highPriorityPatterns.some(p => p.test(text)) &&
                               !urgentPatterns.some(p => p.test(text))
      
      if (isSimpleQuestion) {
        priority = 'low'
        reason = 'Simple question or information request'
      }
    }

    return {
      shouldCreateTicket: true,
      priority,
      reason
    }
  }

  static async labelMail(mailContent) {
    // Try OpenAI first if available
    if (this.isOpenAIAvailable()) {
      try {
        const openai = this.getOpenAIClient()
        const labels = await this.labelMailWithOpenAI(openai, mailContent)
        if (labels) return labels
      } catch (error) {
        console.error('OpenAI labeling error, falling back to keyword-based:', error.message)
        // Fall through to keyword-based labeling
      }
    }
    
    // Fallback to keyword-based labeling
    const mail = {
      subject: mailContent.subject || '',
      body_text: mailContent.body || '',
      from_email: mailContent.from || ''
    }
    
    const labels = this.inferLabels(mail)
    const confidence = labels.length > 0 ? Math.max(...labels.map(l => l.confidence)) : 0.5
    
    return {
      labels: labels.map(l => l.label),
      confidence
    }
  }

  static async labelMailWithOpenAI(openai, mailContent) {
    const subject = mailContent.subject || ''
    const body = (mailContent.body || '').substring(0, 2000) // Limit to 2000 chars
    const from = mailContent.from || ''
    
    const prompt = `Analyseer deze e-mail en geef labels. Beantwoord ALLEEN met een JSON array van labels.

Mogelijke labels:
- "junk": Spam, phishing, verdachte emails, nieuwsbrieven, marketing emails, ongevraagde promoties
- "newsletter": Nieuwsbrieven, marketing emails (gebruik ook "junk" label voor deze)
- "lead": NIEUWE verkoopkansen, interesse in producten/diensten, vragen over prijzen, offerte aanvragen, nieuwe website/website laten maken, interesse in samenwerking, sales inquiries
- "customer_request": Vragen van BESTAANDE klanten, support verzoeken voor bestaande diensten, hulp vragen van klanten
- "bevestiging": Orderbevestigingen, verzendbevestigingen, betalingsbevestigingen (zoals Klarna, PayPal, Stripe), bestellingen die zijn ontvangen/verzonden, "your order", "your payment", "order confirmation", "payment received", "bestelling verzonden", "betaling ontvangen"
- "factuur": Facturen, invoices, rekeningen, betalingsverzoeken, "invoice", "factuur", "rekening", "te betalen", "payment due", "amount due"
- "urgent": Dringende berichten die snel aandacht nodig hebben
- "cold_mail": Ongevraagde sales/marketing emails van anderen (NIET van klanten)
- "follow-up": Opvolging van eerdere correspondentie
- "feedback": Feedback of reviews
- "support": Technische support vragen voor bestaande diensten
- "other": Alles anders

BELANGRIJK: 
- Nieuwsbrieven, marketing emails, en promoties moeten ALTIJD "junk" label krijgen (en optioneel ook "newsletter").
- Als iemand vraagt naar een nieuwe website, prijzen, offerte, of interesse toont in je diensten, gebruik "lead" NIET "customer_request". "customer_request" is alleen voor bestaande klanten.
- Betalingsbevestigingen (Klarna, PayPal, Stripe, etc.), orderbevestigingen, en verzendbevestigingen moeten "bevestiging" krijgen, NIET "customer_request" of "lead".
- Facturen en rekeningen moeten "factuur" krijgen met een duidelijke kleur.
- Als een bestaande klant vraagt om aanpassingen, wijzigingen, hulp, of support voor hun bestaande dienst, gebruik ZOWEL "customer_request" ALS "support" labels.

E-mail:
Van: ${from}
Onderwerp: ${subject}
Inhoud: ${body}

Format: ["label1", "label2"] - geef alleen de labels, geen uitleg.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using mini for cost efficiency
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert e-mail categorisatie systeem. Geef alleen JSON arrays terug, geen andere tekst.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent labeling
        max_tokens: 150
      })

      const responseText = completion.choices[0].message.content.trim()
      
      // Try to parse JSON array
      let labels = []
      try {
        // Remove markdown code blocks if present
        const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim()
        labels = JSON.parse(cleaned)
      } catch (parseError) {
        // If parsing fails, try to extract labels from text
        const validLabels = ['junk', 'newsletter', 'lead', 'customer_request', 'urgent', 'cold_mail', 'follow-up', 'feedback', 'support', 'ticket', 'bevestiging', 'factuur', 'other']
        labels = validLabels.filter(label => responseText.toLowerCase().includes(label))
      }

      // Validate labels
      const validLabels = ['junk', 'newsletter', 'lead', 'customer_request', 'urgent', 'cold_mail', 'follow-up', 'feedback', 'support', 'ticket', 'bevestiging', 'factuur', 'other']
      labels = labels.filter(label => validLabels.includes(label))
      
      // Ensure we have at least one label
      if (labels.length === 0) {
        labels = ['other']
      }

      return {
        labels,
        confidence: 0.85 // AI labels have higher confidence
      }
    } catch (error) {
      console.error('OpenAI API error:', error)
      throw error
    }
  }

  static async generateReplyDraft(mail, style = { tone: 'professional', language: 'nl', formality: 'formal', length: 'medium' }, signature = null) {
    const tone = style.tone || 'professional'
    const language = style.language || 'nl'
    const formality = style.formality || 'formal'
    const length = style.length || 'medium'
    const customInstructions = style.custom_instructions || ''

    const effectiveSignature = this.ensureSignature(signature)

    // Greeting based on formality and language
    let greeting = ''
    if (language === 'nl') {
      greeting = formality === 'formal' ? 'Beste' : formality === 'casual' ? 'Hoi' : 'Geachte'
    } else {
      greeting = formality === 'formal' ? 'Dear' : formality === 'casual' ? 'Hi' : 'Hello'
    }
    
    const name = mail.from_name || 'relatie'
    
    // Subject context
    const subjectContext = mail.subject || 'uw bericht'
    
    // Build reply based on mail type
    let replyBody = ''
    
    // Try OpenAI first if available
    if (this.isOpenAIAvailable()) {
      try {
        const openai = this.getOpenAIClient()
        replyBody = await this.generateReplyWithOpenAI(openai, mail, style)
        // Successfully generated with OpenAI
      } catch (error) {
        console.error('OpenAI generation error, falling back to template:', error.message)
        // Fall through to template-based generation
      }
    }
    
    // If OpenAI wasn't used or failed, use template-based generation
    if (!replyBody || replyBody.trim() === '') {
      // Custom instructions as template (only if OpenAI not used)
      if (customInstructions && customInstructions.trim()) {
        replyBody = customInstructions
          .replace('{{greeting}}', greeting)
          .replace('{{name}}', name)
          .replace('{{subject}}', subjectContext)
          .replace('{{mail_body}}', (mail.body_text || '').slice(0, 500))
      } else {
        // Generate based on tone and length
        if (tone === 'professional') {
          if (length === 'short') {
            replyBody = `${greeting} ${name},\n\nBedankt voor uw bericht. We komen hier zo spoedig mogelijk op terug.`
          } else if (length === 'long') {
            replyBody = `${greeting} ${name},\n\nDank voor uw bericht over "${subjectContext}".\n\n` +
              `Wij hebben uw vraag/opmerking ontvangen en nemen deze serieus. ` +
              `Ons team zal uw bericht grondig bestuderen en u zo spoedig mogelijk een uitgebreid antwoord toesturen. ` +
              `Als u aanvullende informatie heeft die relevant kan zijn, kunt u deze gerust aanleveren.\n\n` +
              `Blijf u tot die tijd vragen hebben, aarzel dan niet om contact op te nemen.`
          } else {
            // Medium length (default)
            replyBody = `${greeting} ${name},\n\nDank voor uw bericht over "${subjectContext}".\n\n` +
              `Wij hebben dit ontvangen en komen hier zo snel mogelijk op terug. ` +
              `Als u aanvullende informatie heeft, kunt u deze per omgaande aanleveren.`
          }
        } else if (tone === 'friendly') {
          replyBody = `${greeting} ${name},\n\nBedankt voor je bericht over "${subjectContext}"!\n\n` +
            `We hebben het ontvangen en kijken er naar uit om hier op terug te komen. ` +
            `Als je nog vragen hebt, laat het vooral weten.`
        } else if (tone === 'casual') {
          replyBody = `${greeting} ${name},\n\nThanks voor je bericht!\n\n` +
            `We hebben het gezien en komen er snel op terug. Laat het weten als je nog vragen hebt.`
        }
      }
    }

    // Replace any remaining placeholders with actual signature values first
    replyBody = this.replaceSignaturePlaceholders(replyBody, effectiveSignature)

    // Return both text body and HTML signature separately
    // The signature will be appended when sending email (as HTML)
    // For textarea display, we'll only show the reply body (without signature)
    const htmlSignature = this.formatSignature(effectiveSignature)
    
    return {
      textBody: replyBody, // Only the reply body, signature is separate
      htmlBody: replyBody + '\n\n' + htmlSignature, // Full HTML with signature
      signature: htmlSignature
    }
  }

  static formatSignatureAsText(signature) {
    if (!signature || !signature.display_name) {
      return 'GrowSocial\ninfo@growsocialmedia.nl\nhttps://growsocialmedia.nl'
    }

    const lines = [signature.display_name]
    if (signature.job_title) lines.push(signature.job_title)
    if (signature.company) lines.push(signature.company)
    if (signature.email) lines.push(signature.email)
    if (signature.phone) lines.push(signature.phone)
    if (signature.website) lines.push(signature.website)

    return lines.filter(Boolean).join('\n')
  }

  static formatSignature(signature) {
    if (!signature || !signature.display_name) {
      // Return basic HTML fallback
      return `<div style="margin-top: 24px; padding-top: 24px; border-top: 3px solid #ea5d0d;">
  <div style="font-weight: 600; font-size: 16px; color: #111827; margin-bottom: 6px;">GrowSocial</div>
  <div style="font-size: 14px; color: #6b7280;">
    <a href="https://growsocialmedia.nl" style="color: #ea5d0d; text-decoration: none; font-weight: 500;">growsocialmedia.nl</a>
  </div>
</div>`
    }

    const photo = signature.photo_url 
      ? `<img src="${signature.photo_url}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-right: 12px; border: 2px solid #ea5d0d;" alt="${signature.display_name}">` 
      : ''

    const phoneLine = signature.phone 
      ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px;"><a href="tel:${signature.phone}" style="color: #6b7280; text-decoration: none;">${signature.phone}</a></div>` 
      : ''

    const jobTitleLine = signature.job_title 
      ? `<div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">${signature.job_title}</div>` 
      : ''

    const companyLine = signature.company 
      ? `<div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">${signature.company}</div>` 
      : ''

    // Email-safe HTML signature with GrowSocial branding
    // Using table layout for better email client compatibility
    return `
<div style="margin-top: 32px; padding-top: 24px; border-top: 3px solid #ea5d0d;">
  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <tr>
      ${photo ? `
      <td style="vertical-align: top; padding-right: 16px; padding-bottom: 12px; width: 50px;">
        ${photo}
      </td>
      ` : '<td style="width: 0;"></td>'}
      <td style="vertical-align: top;">
        <div style="font-weight: 600; font-size: 16px; color: #111827; margin-bottom: 6px; line-height: 1.4;">${signature.display_name}</div>
        ${jobTitleLine}
        ${companyLine}
        <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px; line-height: 1.5;">
          <a href="mailto:${signature.email || ''}" style="color: #ea5d0d; text-decoration: none; font-weight: 500;">${signature.email || ''}</a>
        </div>
        ${phoneLine}
        ${signature.website ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px;"><a href="${signature.website}" style="color: #6b7280; text-decoration: none;">${signature.website}</a></div>` : ''}
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding-top: 20px; border-top: 1px solid #f3f4f6;">
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr>
            <td style="vertical-align: middle; width: auto;">
              <a href="https://growsocialmedia.nl" style="text-decoration: none; display: inline-block;">
                <img src="https://growsocialmedia.nl/img/gs-logo-oranje.jpg" alt="GrowSocial" style="height: 28px; width: auto; max-width: 140px; display: block; border: none;" onerror="this.style.display='none';" />
              </a>
            </td>
            <td style="vertical-align: middle; text-align: right; width: 100%;">
              <div style="font-size: 12px; color: #9ca3af; padding-left: 12px;">
                <a href="https://growsocialmedia.nl" style="color: #ea5d0d; text-decoration: none; font-weight: 600;">growsocialmedia.nl</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`
  }

  static removeSignatureFromBody(body) {
    if (!body) return body
    
    // Split into lines for better processing
    const lines = body.split('\n')
    const resultLines = []
    let foundSignatureStart = false
    
    // Common signature indicators
    const signatureIndicators = [
      /^Rogier Schoenmakers/i,
      /^GrowSocial/i,
      /Marketing\s*[&\u2013\u2014-]\s*Media/i,
      /info@growsocialmedia/i,
      /\{\{company_address\}\}/i,
      /^\(\d{3}\)\s*\d{2,4}/, // Phone format like (013) 23 40 434
      /\d{3}\s*\d{2}\s*\d{2}\s*\d{3}/, // Phone format like 013 23 40 434
    ]
    
    // Check each line from the end, removing signature-like content
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      
      // Skip if line matches signature patterns
      const isSignatureLine = signatureIndicators.some(pattern => pattern.test(line))
      
      // Also check if line contains email or phone after the greeting/closing
      const hasEmail = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(line) && !line.toLowerCase().includes('hello') && !line.toLowerCase().includes('hallo')
      const hasPhone = /\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/.test(line)
      
      // If we found signature content, mark start
      if (isSignatureLine || (hasEmail && i > lines.length - 5) || (hasPhone && i > lines.length - 5)) {
        foundSignatureStart = true
        continue // Skip this line
      }
      
      // If we're past the signature section, keep the line
      if (!foundSignatureStart) {
        resultLines.unshift(lines[i])
      } else {
        // If current line is just whitespace or closing greeting, we might be past signature
        if (line && !/^(Met vriendelijke groet|Groeten|Groet|Best regards|Regards|Bedankt|Hartelijke groet)/i.test(line)) {
          resultLines.unshift(lines[i]) // Keep non-signature lines
        }
        foundSignatureStart = false // Reset if we found normal content again
      }
    }
    
    let result = resultLines.join('\n')
    
    // Remove {{company_address}} placeholder anywhere
    result = result.replace(/\{\{company_address\}\}.*/gi, '')
    
    // Remove multiple blank lines at the end
    result = result.replace(/\n{3,}$/, '\n\n')
    
    return result.trim()
  }

  static replaceSignaturePlaceholders(body, signature) {
    if (!body) return body

    const fallbackName = signature?.display_name || 'GrowSocial'
    const replacements = {
      '\\[Uw Naam\\]': fallbackName,
      '\\[Uw Functie\\]': signature?.job_title || '',
      '\\[Uw Bedrijf\\]': signature?.company || 'GrowSocial',
      '\\[Uw Telefoonnummer\\]': signature?.phone || '',
      '\\[Uw E-mailadres\\]': signature?.email || '',
      '\\[Naam\\]': fallbackName,
      '\\[Bedrijf\\]': signature?.company || 'GrowSocial',
      '\\[Telefoon\\]': signature?.phone || '',
      '\\[E-mailadres\\]': signature?.email || '',
      '\\[Website\\]': signature?.website || 'https://growsocialmedia.nl'
    }

    let result = body
    Object.entries(replacements).forEach(([pattern, value]) => {
      const regex = new RegExp(pattern, 'gi')
      result = result.replace(regex, value || '')
    })

    // Remove empty lines that only contained placeholders
    result = result.replace(/^(\s*\n){2,}/gm, '\n')
    
    // Remove any signature content that might have been added
    result = this.removeSignatureFromBody(result)

    return result.trim()
  }

  static async generateReplyWithOpenAI(openai, mail, style) {
    const tone = style.tone || 'professional'
    const language = style.language || 'nl'
    const formality = style.formality || 'formal'
    const length = style.length || 'medium'
    const customInstructions = style.custom_instructions || ''
    
    const fromName = mail.from_name || 'relatie'
    const subject = mail.subject || 'uw bericht'
    const bodyText = (mail.body_text || '').substring(0, 3000) // Limit body text
    
    // Build style instructions
    let styleInstructions = ''
    if (language === 'nl') {
      styleInstructions = `Schrijf in het Nederlands. `
    } else {
      styleInstructions = `Write in English. `
    }
    
    if (formality === 'formal') {
      styleInstructions += 'Gebruik formele taal (Geachte, Met vriendelijke groet). '
    } else if (formality === 'casual') {
      styleInstructions += 'Gebruik informele taal (Hoi, Groetjes). '
    } else {
      styleInstructions += 'Gebruik neutrale taal (Beste, Groeten). '
    }
    
    if (tone === 'professional') {
      styleInstructions += 'Toon professionaliteit en expertise. '
    } else if (tone === 'friendly') {
      styleInstructions += 'Wees vriendelijk en benaderbaar. '
    } else {
      styleInstructions += 'Wees casual en direct. '
    }
    
    if (length === 'short') {
      styleInstructions += 'Houd het antwoord kort en bondig (2-3 zinnen). '
    } else if (length === 'long') {
      styleInstructions += 'Schrijf een uitgebreid antwoord met context en details. '
    } else {
      styleInstructions += 'Schrijf een medium-lengte antwoord (4-6 zinnen). '
    }

    if (customInstructions && customInstructions.trim()) {
      styleInstructions += `\nAanvullende instructies: ${customInstructions}`
    }

    // Enforce pronoun style for Dutch: je/jouw in non-formal modes
    if (language === 'nl') {
      if (formality === 'formal') {
        styleInstructions += '\nGebruik formele aanspreekvormen (u/uw).'
      } else {
        styleInstructions += '\nGebruik uitsluitend informele aanspreekvormen (je/jouw), NOOIT u/uw.'
      }
    }

    const prompt = `Je bent een e-mail assistent voor GrowSocial. Schrijf een antwoord op deze e-mail.

Originele e-mail:
Van: ${fromName}
Onderwerp: ${subject}
Inhoud:
${bodyText}

${styleInstructions}

Begin met een gepaste begroeting (${formality === 'formal' ? 'Geachte' : formality === 'casual' ? 'Hoi' : 'Beste'} ${fromName}).

Schrijf een professioneel, nuttig en persoonlijk antwoord dat relevant is voor de inhoud van de e-mail. Sluit af met een gepaste afsluiting (zoals "Met vriendelijke groet" of "Groeten").

BELANGRIJK: Voeg GEEN handtekening, naam, bedrijfsgegevens, telefoonnummer, e-mailadres of adres toe. De handtekening wordt automatisch toegevoegd bij verzenden.

Stuur alleen de e-mail tekst terug, zonder extra uitleg of markdown formatting.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using mini for cost efficiency
        messages: [
          {
            role: 'system',
            content: 'Je bent een professionele e-mail assistent voor GrowSocial. Schrijf duidelijke, professionele e-mails in de gevraagde stijl. NOOIT een handtekening toevoegen - deze wordt automatisch toegevoegd.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7, // Slightly creative for more natural responses
        max_tokens: 500
      })

      let reply = completion.choices[0].message.content.trim()
      
      // Clean up if markdown formatting is present
      reply = reply.replace(/^```.*\n?/gm, '').replace(/\n?```$/gm, '').trim()
      
      // Enforce pronoun policy post-processing (safety net)
      if (language === 'nl' && formality !== 'formal') {
        reply = reply
          .replace(/\bU\b/g, 'je')
          .replace(/\bu\b/g, 'je')
          .replace(/\bUw\b/g, 'jouw')
          .replace(/\buw\b/g, 'jouw')
      }

      // Remove any signature-related content that AI might have added
      // Remove patterns like name, email, phone, company address that shouldn't be in the body
      reply = this.removeSignatureFromBody(reply)
      
      return reply
    } catch (error) {
      console.error('OpenAI API error:', error)
      throw error
    }
  }

  static ensureSignature(signature) {
    if (signature && signature.display_name) {
      return {
        display_name: signature.display_name,
        email: signature.email || '',
        phone: signature.phone || '',
        company: signature.company || 'GrowSocial',
        job_title: signature.job_title || '',
        website: signature.website || 'https://growsocialmedia.nl',
      }
    }

    return {
      display_name: 'GrowSocial',
      email: 'info@growsocialmedia.nl',
      phone: '',
      company: 'GrowSocial',
      job_title: '',
      website: 'https://growsocialmedia.nl'
    }
  }

  /**
   * Estimate the potential value of an opportunity based on email content
   * Uses keyword-based analysis first, then OpenAI if available for better accuracy
   * @param {Object} mail - Mail object with subject, body_text, from_email, from_name
   * @returns {Promise<number>} Estimated value in EUR
   */
  static async estimateOpportunityValue(mail) {
    const text = `${mail.subject || ''} ${mail.body_text || ''}`.toLowerCase()
    const fromEmail = (mail.from_email || '').toLowerCase()
    const fromName = (mail.from_name || '').toLowerCase()
    
    // Try OpenAI first if available for more accurate estimation
    if (this.isOpenAIAvailable()) {
      try {
        const openai = this.getOpenAIClient()
        const aiValue = await this.estimateValueWithOpenAI(openai, mail)
        if (aiValue !== null && aiValue > 0) {
          return Math.round(aiValue)
        }
      } catch (error) {
        console.error('OpenAI value estimation error, falling back to keyword-based:', error.message)
        // Fall through to keyword-based estimation
      }
    }
    
    // Fallback to keyword-based estimation
    return this.estimateValueWithKeywords(text, fromEmail, fromName)
  }

  /**
   * Estimate value using OpenAI for better context understanding
   */
  static async estimateValueWithOpenAI(openai, mail) {
    const subject = mail.subject || ''
    const body = (mail.body_text || '').substring(0, 3000)
    const fromEmail = mail.from_email || ''
    const fromName = mail.from_name || ''
    
    const prompt = `Analyseer deze e-mail en schat de potentiële waarde van deze verkoopkans in euro's. 

Overweeg:
- Bedrijfsgrootte (grote makelaar, groot bedrijf = hoog, eenpitter, kleine zaak = laag)
- Project omvang (enterprise, grote website, complex = hoog, kleine website, simpel = laag)
- Budget indicatoren (€100/maand = laag, €10.000+ = hoog)
- Bedrijfstype (makelaar, vastgoed, MKB = vaak hoger, zzp'er, kleine zaak = vaak lager)

E-mail:
Van: ${fromName} <${fromEmail}>
Onderwerp: ${subject}
Inhoud: ${body}

Geef ALLEEN een getal in euro's terug (geen tekst, geen uitleg). Bijvoorbeeld: 15000 of 2500 of 500.

Schatting op basis van context:
- Kleine eenpitter met simpele vraag (bijv. SEO voor €100/maand): 500-1500
- MKB bedrijf met standaard website: 2500-7500
- Groot bedrijf / makelaar met grote website: 10000-25000
- Enterprise project met complexe eisen: 30000-100000`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het inschatten van verkoopkansen. Geef alleen een getal in euro\'s terug, geen andere tekst.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      })

      const responseText = completion.choices[0].message.content.trim()
      
      // Extract number from response (handle various formats)
      const numberMatch = responseText.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+)/)
      if (numberMatch) {
        let value = numberMatch[1].replace(/[.,]/g, '')
        // If value is very large (> 1M), might be in thousands, adjust
        const numValue = parseInt(value, 10)
        if (numValue > 1000000) {
          return Math.round(numValue / 1000) // Probably meant in thousands
        }
        return numValue
      }
      
      return null
    } catch (error) {
      console.error('OpenAI value estimation API error:', error)
      return null
    }
  }

  /**
   * Estimate value using keyword-based analysis
   */
  static estimateValueWithKeywords(text, fromEmail, fromName) {
    let value = 2500 // Default MKB value
    let multiplier = 1.0
    
    // HIGH VALUE INDICATORS (increase value)
    // Enterprise / Large company indicators
    if (text.includes('enterprise') || text.includes('groot bedrijf') || text.includes('multinational') ||
        text.includes('filialen') || text.includes('meerdere locaties') || text.includes('keten')) {
      multiplier *= 2.5
      value = 15000
    }
    
    // Large real estate / makelaar indicators
    if (text.includes('makelaar') || text.includes('makelaarskantoor') || text.includes('vastgoed') ||
        text.includes('real estate') || fromEmail.includes('makelaar') || fromEmail.includes('realestate')) {
      multiplier *= 2.0
      if (value < 10000) value = 12000
    }
    
    // Professional services (advocaten, notarissen, accountants, etc.) - HIGH VALUE
    // Check for professional firm indicators FIRST (before checking for simple keywords)
    const isProfessionalFirm = text.includes('advocaten') || text.includes('advocaat') || text.includes('law firm') || 
        text.includes('advocatenbureau') || text.includes('notaris') || text.includes('notariskantoor') ||
        text.includes('accountant') || text.includes('accountantskantoor') || text.includes('accountancy') ||
        text.includes('consultancy') || text.includes('consultant') || text.includes('adviesbureau') ||
        text.includes('bureau') || text.includes('firm') ||
        fromEmail.includes('law') || fromEmail.includes('advocat') || fromEmail.includes('notaris') ||
        fromEmail.includes('accountant') || fromEmail.includes('consultant');
    
    const hasCompanySuffix = text.includes(' b.v.') || text.includes(' bv') || text.includes(' B.V.') || 
        text.includes(' BV') || text.includes(' n.v.') || text.includes(' nv') || text.includes(' N.V.') || 
        text.includes(' NV') || text.includes('.bv') || text.includes('.nv') || 
        fromName.includes('BV') || fromName.includes('NV') || fromName.includes('b.v.') || fromName.includes('n.v.');
    
    if (isProfessionalFirm || hasCompanySuffix) {
      multiplier *= 3.0 // Higher multiplier for professional services
      if (value < 15000) value = 18000 // Professional services typically pay premium
      
      // If it's also a "nieuwe website" request, increase further
      if (text.includes('nieuwe website') || text.includes('nieuwe site') || text.includes('website laten maken')) {
        value = Math.max(value, 20000) // Professional firm + new website = premium project
      }
    }
    
    // Special case: "Amsterdam Law Firm International B.V." or similar - should be very high value
    if ((fromName.includes('Law Firm') || fromName.includes('Advocaten') || fromName.includes('Advocat')) &&
        (text.includes('nieuwe website') || text.includes('website'))) {
      value = Math.max(value, 25000) // International law firms pay premium
      multiplier = 3.5
    }
    
    // High budget mentions
    const highBudgetPattern = /(€|euro|prijs|budget|budget.*?(\d+)[kkm]|\d+\s*(duizend|k)\s*(euro|€))/gi
    if (highBudgetPattern.test(text)) {
      const budgetMatch = text.match(/(\d+)\s*(duizend|k|000)/i)
      if (budgetMatch) {
        const budget = parseInt(budgetMatch[1]) * 1000
        if (budget > 5000) {
          value = budget * 0.8 // Use 80% of mentioned budget as estimate
          multiplier = 1.0
        }
      } else {
        multiplier *= 1.8
        if (value < 8000) value = 8000
      }
    }
    
    // "Nieuwe website" standalone - should be decent value (unless it's clearly a small request)
    if ((text.includes('nieuwe website') || text.includes('nieuwe site') || text.includes('website laten maken')) &&
        !text.includes('klein') && !text.includes('simpel') && !text.includes('basis') && 
        !text.includes('100 per maand') && !text.includes('€100')) {
      // If no other indicators set a higher value, set reasonable default for new website
      if (value < 5000 && !isProfessionalFirm && !hasCompanySuffix) {
        value = 6000 // Standard new website for MKB
        multiplier = 1.2
      }
    }
    
    // Large website / complex project
    if (text.includes('grote website') || text.includes('veel pagina') || text.includes('100+ pagina') ||
        text.includes('complex') || text.includes('geavanceerd') || text.includes('custom') ||
        text.includes('maatwerk') || text.includes('integratie')) {
      multiplier *= 1.5
      if (value < 8000) value = 8000
    }
    
    // E-commerce / webshop
    if (text.includes('webshop') || text.includes('e-commerce') || text.includes('online shop') ||
        text.includes('verkoop online') || text.includes('betaalsysteem')) {
      multiplier *= 1.6
      if (value < 7000) value = 7000
    }
    
    // CRM / software development
    if (text.includes('crm') || text.includes('software') || text.includes('applicatie') ||
        text.includes('systeem') || text.includes('platform')) {
      multiplier *= 1.7
      if (value < 10000) value = 10000
    }
    
    // Multiple services
    if ((text.match(/website|seo|adwords|social media|marketing/gi) || []).length >= 3) {
      multiplier *= 1.3
    }
    
    // LOW VALUE INDICATORS (decrease value)
    // Small business / solo indicators
    if (text.includes('eenpitter') || text.includes('zzp') || text.includes('zelfstandige') ||
        text.includes('particulier') || text.includes('persoonlijk') || text.includes('klein bedrijf')) {
      multiplier *= 0.4
      value = 1500
    }
    
    // Very low budget mentions
    if (text.includes('100 per maand') || text.includes('€100/maand') || text.includes('100 euro per maand') ||
        text.includes('klein budget') || text.includes('beperkt budget') || text.includes('laag budget')) {
      multiplier *= 0.3
      value = 500
    }
    
    // Simple / basic requests
    if (text.includes('simpele website') || text.includes('basis website') || text.includes('eenvoudig') ||
        text.includes('standaard') && !text.includes('groot')) {
      multiplier *= 0.6
      if (value > 5000) value = 2000
    }
    
    // Only SEO / small service
    if (text.includes('seo') && !text.includes('website') && !text.includes('marketing') &&
        !text.includes('100') && !text.includes('1000')) {
      multiplier *= 0.5
      if (value > 3000) value = 1500
    }
    
    // Calculate final value
    let finalValue = Math.round(value * multiplier)
    
    // Apply reasonable bounds
    if (finalValue < 500) finalValue = 500
    if (finalValue > 100000) finalValue = 100000
    
    // Round to nearest 100 or 500
    if (finalValue < 5000) {
      finalValue = Math.round(finalValue / 100) * 100
    } else {
      finalValue = Math.round(finalValue / 500) * 500
    }
    
    return finalValue
  }

  /**
   * Analyze email with AI to determine ticket needs and priority
   * @param {Object} mailContent - Mail content with subject, body, from, labels
   * @returns {Promise<Object>} - { shouldCreateTicket, priority, reason }
   */
  static async analyzeTicketWithOpenAI(openai, mailContent) {
    const subject = mailContent.subject || ''
    const body = (mailContent.body || '').substring(0, 3000)
    const from = mailContent.from || ''
    const labels = mailContent.labels || []
    
    // Only analyze if it's a customer request or support
    if (!labels.includes('customer_request') && !labels.includes('support') && !labels.includes('ticket')) {
      return {
        shouldCreateTicket: false,
        priority: 'normal',
        reason: 'Not a customer request or support email'
      }
    }

    const prompt = `Analyseer deze e-mail van een klant en bepaal:
1. Of er een ticket aangemaakt moet worden (is het een vraag, probleem, of verzoek?)
2. Wat de prioriteit is (low, normal, high, urgent)

Prioriteit richtlijnen:
- "urgent": Systemen die down zijn, betalingsproblemen, veiligheidsissues, dataverlies, kritieke fouten die klanten blokkeren
- "high": Fouten die iets niet laten werken, dringende verzoeken, problemen die snel opgelost moeten worden
- "normal": Standaard vragen, verzoeken om aanpassingen, vragen over functionaliteit
- "low": Algemene vragen, informatieverzoeken, niet-kritieke suggesties

E-mail:
Van: ${from}
Onderwerp: ${subject}
Inhoud: ${body}

Geef een JSON object terug met:
{
  "shouldCreateTicket": true/false,
  "priority": "low" | "normal" | "high" | "urgent",
  "reason": "korte uitleg waarom"
}`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het analyseren van klantvragen en het bepalen van ticket prioriteiten. Geef alleen JSON terug, geen andere tekst.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      })

      const responseText = completion.choices[0].message.content.trim()
      
      // Try to parse JSON
      try {
        const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim()
        const result = JSON.parse(cleaned)
        
        // Validate priority
        const validPriorities = ['low', 'normal', 'high', 'urgent']
        if (!validPriorities.includes(result.priority)) {
          result.priority = 'normal'
        }
        
        return {
          shouldCreateTicket: result.shouldCreateTicket === true,
          priority: result.priority || 'normal',
          reason: result.reason || 'AI analysis'
        }
      } catch (parseError) {
        // Fallback to keyword-based analysis
        return this.analyzeTicketNeeds(mailContent)
      }
    } catch (error) {
      console.error('OpenAI ticket analysis error:', error)
      // Fallback to keyword-based analysis
      return this.analyzeTicketNeeds(mailContent)
    }
  }

  /**
   * Generate a summary of a support request for ticket description
   * @param {Object} mailContent - Mail content with subject, body_text, from_email, from_name
   * @returns {Promise<string>} - Summary text
   */
  static async generateSupportSummary(mailContent) {
    const openai = this.getOpenAIClient()
    if (!openai) {
      // Fallback: return formatted email content
      return `Ticket automatisch aangemaakt van e-mail:\n\nVan: ${mailContent.from_name || mailContent.from_email}\nE-mail: ${mailContent.from_email}\nOnderwerp: ${mailContent.subject || 'Geen onderwerp'}\n\n${mailContent.body_text || ''}`
    }

    const subject = mailContent.subject || ''
    const body = (mailContent.body_text || '').substring(0, 3000)
    const from = mailContent.from_name || mailContent.from_email || ''

    const prompt = `Maak een korte, professionele samenvatting van deze support vraag van een klant. 
De samenvatting moet:
- Duidelijk beschrijven wat de klant vraagt/wil
- Belangrijke details bevatten (zoals welke aanpassing, welk probleem, etc.)
- Professioneel en beknopt zijn (maximaal 3-4 zinnen)
- In het Nederlands zijn

E-mail:
Van: ${from}
Onderwerp: ${subject}
Inhoud: ${body}

Geef alleen de samenvatting terug, geen andere tekst.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het samenvatten van klantvragen. Geef alleen de samenvatting terug, geen andere tekst.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      })

      const summary = completion.choices[0].message.content.trim()
      
      // Format as ticket description with metadata
      return `Ticket automatisch aangemaakt van e-mail:\n\nVan: ${mailContent.from_name || mailContent.from_email}\nE-mail: ${mailContent.from_email}\nOnderwerp: ${mailContent.subject || 'Geen onderwerp'}\n\n---\n\nSamenvatting:\n${summary}\n\n---\n\nOrigineel bericht:\n${mailContent.body_text || ''}`
    } catch (error) {
      console.error('OpenAI summary generation error:', error)
      // Fallback: return formatted email content
      return `Ticket automatisch aangemaakt van e-mail:\n\nVan: ${mailContent.from_name || mailContent.from_email}\nE-mail: ${mailContent.from_email}\nOnderwerp: ${mailContent.subject || 'Geen onderwerp'}\n\n${mailContent.body_text || ''}`
    }
  }
}

module.exports = AiMailService


