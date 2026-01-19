const OpenAI = require('openai');

class AICustomerSummaryService {
  getClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
  }

  isAvailable() {
    return !!process.env.OPENAI_API_KEY;
  }

  buildPrompt(input) {
    const {
      customer,
      computed,
      stats,
      invoices = [],
      tickets = [],
      tasks = [],
      emails = [],
      responsibleEmployees = []
    } = input || {};

    const safeJson = (obj) => {
      try { return JSON.stringify(obj, null, 2); } catch { return '{}'; }
    };

    return `Maak een korte, actiegerichte CRM-samenvatting in het Nederlands voor een interne medewerker.

REGELS:
- Schrijf als vloeiende, natuurlijke tekst (geen genummerde lijsten zoals "1) ...", "2) ...").
- Schrijf compact en concreet in lopende zinnen.
- Gebruik GEEN bullets, nummers of lijstjes - alleen vloeiende tekst.
- Geen gevoelige data die niet nodig is.
- Als data ontbreekt: zeg "Onbekend" of laat weg.
- Antwoord ALS PLAIN TEXT (geen markdown fences).
- Schrijf alsof je een collega informeert: natuurlijk en vloeiend.

GEGEVENS (customer):
${safeJson({
  id: customer?.id,
  name: customer?.name,
  company_name: customer?.company_name,
  email: customer?.email,
  phone: customer?.phone,
  website: customer?.website,
  domain: customer?.domain,
  city: customer?.city,
  postal_code: customer?.postal_code,
  status: customer?.status,
  priority: customer?.priority,
  hubspot_owner: customer?.hubspot_owner,
  hubspot_lifecycle_stage: customer?.hubspot_lifecycle_stage,
  hubspot_lead_status: customer?.hubspot_lead_status,
  hubspot_lead_source: customer?.hubspot_lead_source,
  hubspot_industry: customer?.hubspot_industry,
  hubspot_employee_count: customer?.hubspot_employee_count,
  hubspot_last_interaction_at: customer?.hubspot_last_interaction_at,
  hubspot_next_activity_at: customer?.hubspot_next_activity_at,
  hubspot_times_contacted: customer?.hubspot_times_contacted
})}

GEGEVENS (computed):
${safeJson({
  company_display_name: computed?.company_display_name,
  normalized_domain: computed?.normalized_domain,
  normalized_phone: computed?.normalized_phone,
  normalized_website_url: computed?.normalized_website_url,
  dedupe_key_primary: computed?.dedupe_key_primary,
  dedupe_key_secondary: computed?.dedupe_key_secondary,
  days_since_last_interaction: computed?.days_since_last_interaction,
  has_overdue_next_activity: computed?.has_overdue_next_activity,
  activity_bucket: computed?.activity_bucket,
  contact_pressure: computed?.contact_pressure,
  is_contactable: computed?.is_contactable,
  data_quality_score: computed?.data_quality_score,
  is_duplicate_candidate: computed?.is_duplicate_candidate
})}

STATS:
${safeJson(stats || {})}

ALLE FACTUREN (${invoices.length} totaal):
${safeJson(invoices)}

ALLE TICKETS (${tickets.length} totaal):
${safeJson(tickets)}

ALLE TAKEN (${tasks.length} totaal):
${safeJson(tasks)}

RECENTE EMAILS (${emails.length} totaal, laatste ${Math.min(emails.length, 20)}):
${safeJson(emails.slice(0, 20))}

VERANTWOORDELIJKE MEDEWERKERS:
${safeJson(responsibleEmployees.slice(0, 10).map(re => ({
  employee: re.employee ? {
    id: re.employee.id,
    first_name: re.employee.first_name,
    last_name: re.employee.last_name,
    email: re.employee.email,
    role_name: re.employee.role_name
  } : null,
  assigned_at: re.assigned_at
})))}

OUTPUT STRUCTUUR (vloeiende tekst, GEEN genummerde lijsten):
Begin met een korte conclusie over de klant (1-2 zinnen). Beschrijf daarna de belangrijkste context, risico's en aandachtspunten, en volgende acties - alles in vloeiende, natuurlijke tekst zonder nummers of bullets. Eindig met eventuele data-kwaliteit opmerkingen indien relevant.`;
  }

  buildFallbackSummary(input) {
    const c = input?.customer || {};
    const computed = input?.computed || {};
    const stats = input?.stats || {};
    const invoices = input?.invoices || [];
    const tickets = input?.tickets || [];
    const tasks = input?.tasks || [];
    const emails = input?.emails || [];
    const responsibleEmployees = input?.responsibleEmployees || [];

    const name = computed.company_display_name || c.company_name || c.name || 'Onbekend';
    const owner = c.hubspot_owner || 'Onbekend';
    const domain = computed.normalized_domain || c.domain || c.website || 'Onbekend';
    const phone = computed.normalized_phone || c.phone || 'Onbekend';
    const city = c.city || '';
    const postalCode = c.postal_code || '';
    const address = c.address || '';
    const status = c.status || 'Onbekend';
    const priority = c.priority || 'normaal';
    const industry = c.hubspot_industry || c.industry || 'Onbekend';
    
    const last = computed.days_since_last_interaction ?? null;
    const overdue = computed.has_overdue_next_activity ? 'Ja' : 'Nee';
    const quality = computed.data_quality_score ?? null;

    const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const unreadEmails = emails.filter(e => !e.read_at).length;
    
    const responsibleNames = responsibleEmployees
      .map(re => {
        const emp = re.employee;
        if (!emp) return null;
        return emp.first_name && emp.last_name 
          ? `${emp.first_name} ${emp.last_name}` 
          : emp.email || 'Onbekend';
      })
      .filter(Boolean);

    const parts = [];
    
    // Start met conclusie
    let conclusion = `${name} is een ${status === 'active' ? 'actieve' : status === 'inactive' ? 'inactieve' : status} klant met ${priority === 'high' ? 'hoge' : priority === 'low' ? 'lage' : 'normale'} prioriteit.`;
    if (owner && owner !== 'Onbekend') {
      conclusion += ` De eigenaar is ${owner}.`;
    }
    parts.push(conclusion);
    
    // Belangrijkste context
    const contextParts = [];
    if (domain && domain !== 'Onbekend') {
      contextParts.push(`website ${domain}`);
    }
    if (phone && phone !== 'Onbekend') {
      contextParts.push(`telefoonnummer ${phone}`);
    }
    if (address || city || postalCode) {
      const location = [address, postalCode, city].filter(Boolean).join(', ');
      if (location) contextParts.push(`locatie ${location}`);
    }
    if (industry && industry !== 'Onbekend') {
      contextParts.push(`branche ${industry}`);
    }
    if (contextParts.length > 0) {
      parts.push(`De klant heeft ${contextParts.join(', ')}.`);
    }
    
    if (last !== null) {
      parts.push(`De laatste interactie was ${last === 0 ? 'vandaag' : last === 1 ? 'gisteren' : `${last} dagen geleden`}.`);
    }
    
    if (typeof stats.total_revenue !== 'undefined' && stats.total_revenue > 0) {
      parts.push(`De totale omzet bedraagt €${stats.total_revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
    }
    if (typeof stats.total_outstanding !== 'undefined' && stats.total_outstanding > 0) {
      parts.push(`Er staat nog €${stats.total_outstanding.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} open.`);
    }
    
    // Actuele status
    const statusParts = [];
    if (openTickets > 0) {
      statusParts.push(`${openTickets} open ${openTickets === 1 ? 'ticket' : 'tickets'}`);
    }
    if (openTasks > 0) {
      statusParts.push(`${openTasks} open ${openTasks === 1 ? 'taak' : 'taken'}`);
    }
    if (unreadEmails > 0) {
      statusParts.push(`${unreadEmails} ongelezen ${unreadEmails === 1 ? 'e-mail' : 'e-mails'}`);
    }
    if (invoices.length > 0) {
      const paidCount = invoices.filter(i => i.status === 'paid').length;
      const overdueCount = invoices.filter(i => i.status === 'overdue').length;
      let invoiceText = `${invoices.length} factuur${invoices.length === 1 ? '' : 'en'}`;
      if (paidCount > 0 || overdueCount > 0) {
        const details = [];
        if (paidCount > 0) details.push(`${paidCount} betaald`);
        if (overdueCount > 0) details.push(`${overdueCount} achterstallig`);
        invoiceText += ` (${details.join(', ')})`;
      }
      statusParts.push(invoiceText);
    }
    if (statusParts.length > 0) {
      parts.push(`Er ${statusParts.length === 1 ? 'is' : 'zijn'} ${statusParts.join(', ')}.`);
    } else {
      parts.push('Er zijn geen openstaande items.');
    }
    
    // Risico's en aandachtspunten
    const riskParts = [];
    if (computed.is_duplicate_candidate) {
      riskParts.push('mogelijk een duplicaat');
    }
    if (!computed.is_contactable) {
      riskParts.push('niet volledig contacteerbaar');
    }
    if (quality !== null && quality < 50) {
      riskParts.push(`lage data kwaliteit (${quality}/100)`);
    }
    if (overdue === 'Ja') {
      riskParts.push('een overdue volgende activiteit');
    }
    if (last !== null && last > 90) {
      riskParts.push(`geen interactie in ${last} dagen`);
    }
    if (riskParts.length > 0) {
      parts.push(`Aandachtspunten: ${riskParts.join(', ')}.`);
    }
    
    // Volgende acties
    const actionParts = [];
    if (openTickets > 0) {
      actionParts.push('openstaande tickets behandelen');
    }
    if (openTasks > 0) {
      actionParts.push('openstaande taken afwerken');
    }
    if (unreadEmails > 0) {
      actionParts.push('ongelezen e-mails beantwoorden');
    }
    if (overdue === 'Ja') {
      actionParts.push('volgende activiteit plannen of bevestigen');
    }
    if (!computed.is_contactable) {
      actionParts.push('contactgegevens verrijken');
    }
    if (quality !== null && quality < 50) {
      actionParts.push('data kwaliteit verbeteren');
    }
    if (computed.is_duplicate_candidate) {
      actionParts.push('eventuele duplicaten controleren en mergen');
    }
    if (actionParts.length > 0) {
      parts.push(`Volgende acties: ${actionParts.join(', ')}.`);
    }
    
    // Data kwaliteit (alleen als relevant)
    if (quality !== null && quality < 50) {
      parts.push(`De data kwaliteit score is ${quality}/100.`);
    }

    return parts.join(' ');
  }

  async generateCustomerSummary(input) {
    const openai = this.getClient();
    if (!openai) {
      return { summary: this.buildFallbackSummary(input), model: null };
    }

    const prompt = this.buildPrompt(input);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Je bent een CRM assistent. Schrijf compact, professioneel en actiegericht als vloeiende tekst. Gebruik GEEN genummerde lijsten (zoals "1)", "2)") of bullets - schrijf alles in natuurlijke, lopende zinnen.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    });

    const summary = completion.choices?.[0]?.message?.content?.trim() || this.buildFallbackSummary(input);
    return { summary, model: 'gpt-4o-mini' };
  }
}

module.exports = new AICustomerSummaryService();

