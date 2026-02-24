/**
 * Page Registry — single source of truth for admin/partner pages and RBAC.
 * Used by platformSettingsService to sync app_pages and to build nav + enforce access.
 */

const ROLES = Object.freeze(['admin', 'manager', 'employee', 'partner'])

/** @typedef { 'admin' | 'partner' } Area */
/** @typedef { { key: string, label: string, path: string, area: Area, section: string, defaultAccessRoles: string[], defaultSidebarRoles: string[], defaultSidebarOrder: number, icon?: string, parentKey?: string } } PageDef */

/**
 * All admin pages (mirrors sidebar structure).
 * Defaults: admin = all; manager = all except users/profiles/platform-settings; employee = limited; partner = none (admin area).
 */
const ADMIN_PAGES = Object.freeze([
  // Overzicht
  { key: 'admin.dashboard', label: 'Overzicht', path: '/admin', area: 'admin', section: 'Overzicht', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 100 },
  // Leads
  { key: 'admin.leads', label: 'Aanvragen', path: '/admin/leads', area: 'admin', section: 'Leads', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 200 },
  { key: 'admin.leads.engine', label: 'Leadstroom', path: '/admin/leads/engine', area: 'admin', section: 'Leads', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 201 },
  { key: 'admin.leads.activities', label: 'Activiteiten', path: '/admin/leads/activities', area: 'admin', section: 'Leads', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 202 },
  { key: 'admin.leads.industries', label: 'Branches', path: '/admin/leads/industries', area: 'admin', section: 'Leads', defaultAccessRoles: ['admin', 'manager'], defaultSidebarRoles: ['admin', 'manager'], defaultSidebarOrder: 203 },
  // Sales
  { key: 'admin.opportunities', label: 'Kansen', path: '/admin/opportunities', area: 'admin', section: 'Sales', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 300 },
  { key: 'admin.opportunities.streams', label: 'Kansenstromen', path: '/admin/opportunities/streams', area: 'admin', section: 'Sales', defaultAccessRoles: ['admin', 'manager'], defaultSidebarRoles: ['admin', 'manager'], defaultSidebarOrder: 301 },
  { key: 'admin.opportunities.deals', label: 'Deals', path: '/admin/opportunities/deals', area: 'admin', section: 'Sales', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 302 },
  // CRM
  { key: 'admin.customers', label: 'Klanten', path: '/admin/customers', area: 'admin', section: 'CRM', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 400 },
  { key: 'admin.contacts', label: 'Contactpersonen', path: '/admin/contacts', area: 'admin', section: 'CRM', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 401 },
  // Uitvoering
  { key: 'admin.tasks', label: 'Uitvoering', path: '/admin/tasks', area: 'admin', section: 'Uitvoering', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 500 },
  { key: 'admin.tickets', label: 'Tickets', path: '/admin/tickets', area: 'admin', section: 'Tickets', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 510 },
  // Communicatie
  { key: 'admin.messages', label: 'Chat', path: '/admin/messages', area: 'admin', section: 'Communicatie', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 600 },
  { key: 'admin.mail', label: 'Mail', path: '/admin/mail', area: 'admin', section: 'Communicatie', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 601 },
  { key: 'admin.calendar', label: 'Agenda', path: '/admin/calendar', area: 'admin', section: 'Communicatie', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 602 },
  // Diensten
  { key: 'admin.services', label: 'Diensten overzicht', path: '/admin/services', area: 'admin', section: 'Diensten', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 700 },
  { key: 'admin.services.catalog', label: 'Catalogus', path: '/admin/services/catalog', area: 'admin', section: 'Diensten', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 701 },
  { key: 'admin.services.analytics', label: 'Analytics', path: '/admin/services/analytics', area: 'admin', section: 'Diensten', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 702 },
  { key: 'admin.services.settings', label: 'Diensten instellingen', path: '/admin/services/settings', area: 'admin', section: 'Diensten', defaultAccessRoles: ['admin', 'manager'], defaultSidebarRoles: ['admin', 'manager'], defaultSidebarOrder: 703 },
  // Team
  { key: 'admin.employees', label: 'Werknemers', path: '/admin/employees', area: 'admin', section: 'Team', defaultAccessRoles: ['admin', 'manager'], defaultSidebarRoles: ['admin', 'manager'], defaultSidebarOrder: 800 },
  { key: 'admin.time-entries', label: 'Tijdregistratie', path: '/admin/time-entries', area: 'admin', section: 'Team', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 801 },
  { key: 'admin.payroll', label: 'Payroll', path: '/admin/payroll', area: 'admin', section: 'Team', defaultAccessRoles: ['admin'], defaultSidebarRoles: ['admin'], defaultSidebarOrder: 802 },
  // Facturatie
  { key: 'admin.payments', label: 'Betalingen', path: '/admin/payments', area: 'admin', section: 'Facturatie', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 900 },
  { key: 'admin.payments.invoices', label: 'Facturen', path: '/admin/payments/invoices', area: 'admin', section: 'Facturatie', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 901 },
  { key: 'admin.payments.mandates', label: 'Mandaten', path: '/admin/payments/mandates', area: 'admin', section: 'Facturatie', defaultAccessRoles: ['admin', 'manager'], defaultSidebarRoles: ['admin', 'manager'], defaultSidebarOrder: 902 },
  { key: 'admin.payments.banking', label: 'Bankieren', path: '/admin/payments/banking', area: 'admin', section: 'Facturatie', defaultAccessRoles: ['admin', 'manager'], defaultSidebarRoles: ['admin', 'manager'], defaultSidebarOrder: 903 },
  // Tools
  { key: 'admin.scraper', label: 'Scraper', path: '/admin/scraper', area: 'admin', section: 'Tools', defaultAccessRoles: ['admin', 'manager'], defaultSidebarRoles: ['admin', 'manager'], defaultSidebarOrder: 1000 },
  { key: 'admin.notes', label: 'Notities', path: '/admin/notes', area: 'admin', section: 'Tools', defaultAccessRoles: ['admin', 'manager'], defaultSidebarRoles: ['admin', 'manager'], defaultSidebarOrder: 1001 },
  // Handleidingen
  { key: 'admin.sops', label: 'Handleidingen', path: '/admin/sops', area: 'admin', section: 'Intern', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 1100 },
  // Instellingen
  { key: 'admin.settings', label: 'Instellingen', path: '/admin/settings', area: 'admin', section: 'Instellingen', defaultAccessRoles: ['admin', 'manager', 'employee'], defaultSidebarRoles: ['admin', 'manager', 'employee'], defaultSidebarOrder: 1200 },
  { key: 'admin.platform_settings', label: 'Platform Instellingen', path: '/admin/platform-settings', area: 'admin', section: 'Instellingen', defaultAccessRoles: ['admin'], defaultSidebarRoles: ['admin'], defaultSidebarOrder: 1210 },
  // Gebruikers (admin only - not in sidebar as main item but reachable)
  { key: 'admin.users', label: 'Gebruikers', path: '/admin/users', area: 'admin', section: 'Intern', defaultAccessRoles: ['admin'], defaultSidebarRoles: [], defaultSidebarOrder: 1300 },
  { key: 'admin.profiles', label: 'Profielen', path: '/admin/profiles', area: 'admin', section: 'Intern', defaultAccessRoles: ['admin'], defaultSidebarRoles: [], defaultSidebarOrder: 1301 },
])

/**
 * All pages (admin + partner). Partner pages can be added here later.
 * @type { PageDef[] }
 */
function getAllPages () {
  return [...ADMIN_PAGES]
}

/**
 * Get pages for admin area only.
 * @returns { PageDef[] }
 */
function getAdminPages () {
  return ADMIN_PAGES.filter(p => p.area === 'admin')
}

/**
 * Resolve pageKey from request path (exact match first, then longest prefix).
 * @param { string } path - req.path (e.g. /admin/leads/engine)
 * @param { 'admin' | 'partner' } [area] - optional area filter
 * @returns { string | null } page_key or null
 */
function resolvePageKey (path, area = 'admin') {
  const pages = area === 'admin' ? getAdminPages() : getAllPages().filter(p => p.area === area)
  const normalized = path.replace(/\/$/, '') || '/'
  // Exact match
  const exact = pages.find(p => (p.path.replace(/\/$/, '') || '/') === normalized)
  if (exact) return exact.key
  // Longest prefix match
  const withPrefix = pages
    .filter(p => normalized.startsWith(p.path.replace(/\/$/, '') || '/'))
    .sort((a, b) => (b.path.length - a.path.length))
  return withPrefix[0]?.key ?? null
}

/**
 * Allowed role keys for RBAC.
 * @returns { string[] }
 */
function getRoleKeys () {
  return [...ROLES]
}

module.exports = {
  ROLES: ROLES,
  getAllPages,
  getAdminPages,
  resolvePageKey,
  getRoleKeys,
  ADMIN_PAGES
}
