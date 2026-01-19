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
- Schrijf compact en concreet.
- Gebruik bullets en korte kopjes.
- Geen gevoelige data die niet nodig is.
- Als data ontbreekt: zeg "Onbekend" of laat weg.
- Antwoord ALS PLAIN TEXT (geen markdown fences).

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

RECENTE FACTUREN (max 10):
${safeJson(invoices.slice(0, 10))}

RECENTE TICKETS (max 10):
${safeJson(tickets.slice(0, 10))}

RECENTE TAKEN (max 10):
${safeJson(tasks.slice(0, 10))}

RECENTE EMAILS (max 5):
${safeJson(emails.slice(0, 5))}

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

OUTPUT STRUCTUUR (plain text):
1) Korte conclusie (1-2 zinnen)
2) Belangrijkste context (bullets)
3) Risico's / aandachtspunten (bullets)
4) Volgende acties (max 5 bullets, concreet)
5) Data-kwaliteit & dedupe (1-2 bullets)`;
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

    const lines = [];
    lines.push(`1) Korte conclusie`);
    lines.push(`${name} is een ${status === 'active' ? 'actieve' : status === 'inactive' ? 'inactieve' : status} klant met ${priority === 'high' ? 'hoge' : priority === 'low' ? 'lage' : 'normale'} prioriteit.`);
    if (owner && owner !== 'Onbekend') {
      lines.push(`Eigenaar: ${owner}.`);
    }
    lines.push('');
    
    lines.push(`2) Belangrijkste context`);
    if (domain && domain !== 'Onbekend') {
      lines.push(`• Website: ${domain}`);
    }
    if (phone && phone !== 'Onbekend') {
      lines.push(`• Telefoon: ${phone}`);
    }
    if (address || city || postalCode) {
      const location = [address, postalCode, city].filter(Boolean).join(', ');
      if (location) lines.push(`• Locatie: ${location}`);
    }
    if (industry && industry !== 'Onbekend') {
      lines.push(`• Branche: ${industry}`);
    }
    if (last !== null) {
      lines.push(`• Laatste interactie: ${last === 0 ? 'Vandaag' : last === 1 ? 'Gisteren' : `${last} dagen geleden`}`);
    }
    if (typeof stats.total_revenue !== 'undefined' && stats.total_revenue > 0) {
      lines.push(`• Totale omzet: €${stats.total_revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    if (typeof stats.total_outstanding !== 'undefined' && stats.total_outstanding > 0) {
      lines.push(`• Openstaand bedrag: €${stats.total_outstanding.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    if (responsibleNames.length > 0) {
      lines.push(`• Verantwoordelijke(n): ${responsibleNames.join(', ')}`);
    }
    lines.push('');
    
    lines.push(`3) Actuele status`);
    if (openTickets > 0) {
      lines.push(`• ${openTickets} open ticket(s)`);
    }
    if (openTasks > 0) {
      lines.push(`• ${openTasks} open taak/taken`);
    }
    if (unreadEmails > 0) {
      lines.push(`• ${unreadEmails} ongelezen e-mail(s)`);
    }
    if (invoices.length > 0) {
      const paidCount = invoices.filter(i => i.status === 'paid').length;
      const overdueCount = invoices.filter(i => i.status === 'overdue').length;
      lines.push(`• ${invoices.length} factuur/facturen (${paidCount} betaald${overdueCount > 0 ? `, ${overdueCount} achterstallig` : ''})`);
    }
    if (openTickets === 0 && openTasks === 0 && unreadEmails === 0 && invoices.length === 0) {
      lines.push(`• Geen openstaande items`);
    }
    lines.push('');
    
    lines.push(`4) Risico's / aandachtspunten`);
    if (computed.is_duplicate_candidate) {
      lines.push(`• Mogelijk duplicaat - controleer dedupe keys`);
    }
    if (!computed.is_contactable) {
      lines.push(`• Niet volledig contacteerbaar - mist telefoon of website`);
    }
    if (quality !== null && quality < 50) {
      lines.push(`• Lage data kwaliteit score (${quality}/100) - verrijk gegevens`);
    }
    if (overdue === 'Ja') {
      lines.push(`• Overdue volgende activiteit - actie vereist`);
    }
    if (last !== null && last > 90) {
      lines.push(`• Geen interactie in ${last} dagen - mogelijk inactief`);
    }
    if (!computed.is_duplicate_candidate && computed.is_contactable && (quality === null || quality >= 50) && overdue === 'Nee' && (last === null || last <= 90)) {
      lines.push(`• Geen specifieke risico's geïdentificeerd`);
    }
    lines.push('');
    
    lines.push(`5) Volgende acties`);
    if (openTickets > 0) {
      lines.push(`• Behandel openstaande tickets`);
    }
    if (openTasks > 0) {
      lines.push(`• Werk openstaande taken af`);
    }
    if (unreadEmails > 0) {
      lines.push(`• Beantwoord ongelezen e-mails`);
    }
    if (overdue === 'Ja') {
      lines.push(`• Plan/bevestig volgende activiteit`);
    }
    if (!computed.is_contactable) {
      lines.push(`• Verrijk contactgegevens (telefoon/website/adres)`);
    }
    if (quality !== null && quality < 50) {
      lines.push(`• Verbeter data kwaliteit`);
    }
    if (computed.is_duplicate_candidate) {
      lines.push(`• Controleer en merge eventuele duplicaten`);
    }
    if (openTickets === 0 && openTasks === 0 && unreadEmails === 0 && overdue === 'Nee' && computed.is_contactable && (quality === null || quality >= 50) && !computed.is_duplicate_candidate) {
      lines.push(`• Geen specifieke acties vereist - klant is up-to-date`);
    }
    lines.push('');
    
    lines.push(`6) Data-kwaliteit & technisch`);
    lines.push(`• Data quality score: ${quality !== null ? `${quality}/100` : 'Onbekend'}`);
    if (computed.dedupe_key_primary) {
      lines.push(`• Dedupe key (primary): ${computed.dedupe_key_primary}`);
    }
    if (computed.dedupe_key_secondary) {
      lines.push(`• Dedupe key (secondary): ${computed.dedupe_key_secondary}`);
    }

    return lines.join('\n');
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
          content: 'Je bent een CRM assistent. Schrijf compact, professioneel en actiegericht. Antwoord als plain text.'
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

