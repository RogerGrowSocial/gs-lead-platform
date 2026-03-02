/**
 * Lightweight API router for admin cold start.
 * Only GET /admin/dashboard-bootstrap. Minimal top-level requires.
 * Mount at app.use('/api', requireAuth, adminApiLite).
 */
const express = require('express');
const router = express.Router();

const TIMEOUT_MS = 5000;

router.get('/admin/dashboard-bootstrap', (req, res, next) => {
  const { isEmployeeOrAdmin } = require('../middleware/auth');
  isEmployeeOrAdmin(req, res, async () => {
    const { supabase, supabaseAdmin } = require('../config/supabase');
    const isUserAdmin = req.user?.is_admin === true || req.user?.user_metadata?.is_admin === true;
    const stats = { totalUsers: 0, totalLeads: 0, totalRevenue: 0, pendingLeads: 0 };

    const run = async () => {
      const [profilesRes, leadsRes, paymentsRes, pendingRes, recentUsersRes, recentLeadsRes] = await Promise.all([
        supabase.from('profiles').select('id'),
        supabase.from('leads').select('id'),
        supabase.from('payments').select('amount').eq('status', 'paid'),
        supabase.from('leads').select('id').eq('status', 'new'),
        supabase.from('profiles').select('id, company_name, email, created_at, has_payment_method').order('created_at', { ascending: false }).limit(5),
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(5)
      ]);
      stats.totalUsers = profilesRes?.data?.length ?? 0;
      stats.totalLeads = leadsRes?.data?.length ?? 0;
      stats.totalRevenue = (paymentsRes?.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      stats.pendingLeads = pendingRes?.data?.length ?? 0;
      let employees = [];
      if (isUserAdmin) {
        try {
          const { getRoleMap } = require('../utils/roleCache');
          const { roleMap, roleDisplayMap } = await getRoleMap();
          const { data: allProfiles } = await supabaseAdmin.from('profiles').select('id, email, first_name, last_name, company_name, role_id, is_admin').order('first_name');
          const list = (allProfiles || []).filter(p => {
            if (p.is_admin === true) return true;
            const r = (roleMap && p.role_id && roleMap[String(p.role_id)]) ? String(roleMap[String(p.role_id)]).toLowerCase() : '';
            if (r === 'customer' || r === 'consumer' || r === 'klant') return false;
            return true;
          });
          employees = list.map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            displayName: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.company_name || p.email || p.id,
            roleDisplayName: (roleDisplayMap && p.role_id && roleDisplayMap[String(p.role_id)]) ? roleDisplayMap[String(p.role_id)].trim() : null
          }));
        } catch (e) {
          console.warn('Bootstrap employees fetch failed:', e.message);
        }
      }
      return {
        success: true,
        stats,
        recentUsers: recentUsersRes?.data || [],
        recentLeads: recentLeadsRes?.data || [],
        employees,
        isUserAdmin
      };
    };

    try {
      const result = await Promise.race([
        run(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))
      ]);
      res.json(result);
    } catch (err) {
      if (err.message === 'timeout') {
        res.json({ success: false, error: 'timeout', stats: { totalUsers: 0, totalLeads: 0, totalRevenue: 0, pendingLeads: 0 }, recentUsers: [], recentLeads: [], employees: [] });
      } else {
        console.error('Dashboard bootstrap error:', err);
        res.status(500).json({ success: false, error: err.message || 'Fout bij ophalen data' });
      }
    }
  });
});

router.use((req, res, next) => next());

module.exports = router;
