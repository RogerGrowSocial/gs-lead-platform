-- =====================================================
-- SEED DATA FOR SERVICES MODULE
-- =====================================================
-- This seed file creates initial services (master data)
-- NO sales data - sales should be created manually or via invoice/payment integration
-- =====================================================

-- Insert services (master data only, no sales)
INSERT INTO public.services (name, slug, description, service_type, pricing_model, status, price_cents, cost_cents, unit_label, sort_order) VALUES
('Aanvragen service', 'aanvragen-service', 'Lead generatie en aanvragen service voor klanten', 'per_lead', 'per_unit', 'active', 1000, 500, 'lead', 1),
('Website development', 'website-development', 'Ontwikkeling van websites en webapplicaties', 'one_time', 'fixed', 'active', 50000, 30000, 'project', 2),
('Website onderhoud', 'website-onderhoud', 'Maandelijks onderhoud en updates voor websites', 'recurring', 'recurring', 'active', 5000, 2000, 'maand', 3),
('Google Ads', 'google-ads', 'Beheer en optimalisatie van Google Ads campagnes', 'recurring', 'recurring', 'active', 15000, 8000, 'maand', 4),
('SEO', 'seo', 'Search Engine Optimization diensten', 'recurring', 'recurring', 'active', 12000, 6000, 'maand', 5),
('E-mailmarketing', 'emailmarketing', 'E-mailmarketing campagnes en automatisering', 'recurring', 'recurring', 'active', 8000, 4000, 'maand', 6)
ON CONFLICT (slug) DO NOTHING;

-- Note: No service_sales seed data - sales should be created manually or via invoice/payment integration

