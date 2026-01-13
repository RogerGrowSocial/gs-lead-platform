-- =====================================================
-- PERFORMANCE SYSTEM - PHASE 2: Partner Performance Stats View Uitbreiding
-- =====================================================
-- Migration: 20250120000001_performance_system_phase2_view.sql
-- Doel: Uitbreiden van partner_performance_stats met alle 8 performance metrics
-- =====================================================

-- =====================================================
-- 1. CHECK OF PHASE 1 TABELLEN BESTAAN
-- =====================================================

-- Check of lead_feedback en support_tickets bestaan (van Phase 1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lead_feedback'
  ) THEN
    RAISE EXCEPTION 'lead_feedback tabel bestaat niet. Voer eerst migration 20250120000000_performance_system_phase1.sql uit.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'support_tickets'
  ) THEN
    RAISE EXCEPTION 'support_tickets tabel bestaat niet. Voer eerst migration 20250120000000_performance_system_phase1.sql uit.';
  END IF;
  
  -- Check of first_contact_at kolom bestaat in leads
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'leads' 
      AND column_name = 'first_contact_at'
  ) THEN
    RAISE EXCEPTION 'first_contact_at kolom bestaat niet in leads tabel. Voer eerst migration 20250120000000_performance_system_phase1.sql uit.';
  END IF;
END $$;

-- =====================================================
-- 2. DROP OUDE VIEW EN MAAK NIEUWE
-- =====================================================

-- Drop de oude materialized view
DROP MATERIALIZED VIEW IF EXISTS public.partner_performance_stats CASCADE;

-- Maak nieuwe uitgebreide materialized view
CREATE MATERIALIZED VIEW public.partner_performance_stats AS
SELECT 
  p.id AS partner_id,
  
  -- =====================================================
  -- BESTAANDE METRICS (behouden voor backward compatibility)
  -- =====================================================
  COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')) AS leads_assigned_30d,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'accepted' AND l.assigned_at >= (NOW() - INTERVAL '30 days')) AS leads_accepted_30d,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'rejected' AND l.assigned_at >= (NOW() - INTERVAL '30 days')) AS leads_rejected_30d,
  CASE
    WHEN COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')) > 0 
    THEN ROUND(
      (COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'accepted' AND l.assigned_at >= (NOW() - INTERVAL '30 days'))::NUMERIC / 
       COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days'))::NUMERIC) * 100, 
      2
    )
    ELSE 0::NUMERIC
  END AS conversion_rate_30d,
  AVG(l.response_time_minutes) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')) AS avg_response_time_minutes,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('new', 'in_progress') AND l.assigned_to = p.id) AS open_leads_count,
  MAX(l.assigned_at) AS last_lead_assigned_at,
  
  -- =====================================================
  -- METRIC 1: REACTIESNELHEID (Response Speed)
  -- =====================================================
  -- Gemiddelde eerste reactietijd (7 dagen)
  AVG(EXTRACT(EPOCH FROM (l.first_contact_at - l.created_at)) / 60) 
    FILTER (WHERE l.first_contact_at IS NOT NULL 
            AND l.assigned_at >= (NOW() - INTERVAL '7 days')) AS avg_first_response_time_minutes_7d,
  
  -- Gemiddelde eerste reactietijd (30 dagen)
  AVG(EXTRACT(EPOCH FROM (l.first_contact_at - l.created_at)) / 60) 
    FILTER (WHERE l.first_contact_at IS NOT NULL 
            AND l.assigned_at >= (NOW() - INTERVAL '30 days')) AS avg_first_response_time_minutes_30d,
  
  -- Percentage leads binnen 1 uur gecontacteerd (30 dagen)
  CASE
    WHEN COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')) > 0
    THEN ROUND(
      (COUNT(DISTINCT l.id) FILTER (
        WHERE l.first_contact_at IS NOT NULL 
        AND l.first_contact_at <= l.created_at + INTERVAL '1 hour'
        AND l.assigned_at >= (NOW() - INTERVAL '30 days')
      )::NUMERIC / 
      COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days'))::NUMERIC) * 100,
      2
    )
    ELSE 0::NUMERIC
  END AS pct_contacted_within_1h_30d,
  
  -- Percentage leads binnen 24 uur gecontacteerd (30 dagen)
  CASE
    WHEN COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')) > 0
    THEN ROUND(
      (COUNT(DISTINCT l.id) FILTER (
        WHERE l.first_contact_at IS NOT NULL 
        AND l.first_contact_at <= l.created_at + INTERVAL '24 hours'
        AND l.assigned_at >= (NOW() - INTERVAL '30 days')
      )::NUMERIC / 
      COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days'))::NUMERIC) * 100,
      2
    )
    ELSE 0::NUMERIC
  END AS pct_contacted_within_24h_30d,
  
  -- =====================================================
  -- METRIC 2: AI TRUST SCORE
  -- =====================================================
  p.ai_risk_score AS ai_trust_score,
  
  -- =====================================================
  -- METRIC 3: DEAL RATE (Won/Lost Leads)
  -- =====================================================
  -- Deal rate 7 dagen
  CASE
    WHEN COUNT(DISTINCT l.id) FILTER (
      WHERE l.status IN ('won', 'lost') 
      AND l.assigned_at >= (NOW() - INTERVAL '7 days')
    ) > 0
    THEN ROUND(
      (COUNT(DISTINCT l.id) FILTER (
        WHERE l.status = 'won' 
        AND l.assigned_at >= (NOW() - INTERVAL '7 days')
      )::NUMERIC / 
      COUNT(DISTINCT l.id) FILTER (
        WHERE l.status IN ('won', 'lost') 
        AND l.assigned_at >= (NOW() - INTERVAL '7 days')
      )::NUMERIC) * 100,
      2
    )
    ELSE NULL::NUMERIC
  END AS deal_rate_7d,
  
  -- Deal rate 30 dagen
  CASE
    WHEN COUNT(DISTINCT l.id) FILTER (
      WHERE l.status IN ('won', 'lost') 
      AND l.assigned_at >= (NOW() - INTERVAL '30 days')
    ) > 0
    THEN ROUND(
      (COUNT(DISTINCT l.id) FILTER (
        WHERE l.status = 'won' 
        AND l.assigned_at >= (NOW() - INTERVAL '30 days')
      )::NUMERIC / 
      COUNT(DISTINCT l.id) FILTER (
        WHERE l.status IN ('won', 'lost') 
        AND l.assigned_at >= (NOW() - INTERVAL '30 days')
      )::NUMERIC) * 100,
      2
    )
    ELSE NULL::NUMERIC
  END AS deal_rate_30d,
  
  -- Won leads 30 dagen
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.status = 'won' 
    AND l.assigned_at >= (NOW() - INTERVAL '30 days')
  ) AS won_leads_30d,
  
  -- Lost leads 30 dagen
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.status = 'lost' 
    AND l.assigned_at >= (NOW() - INTERVAL '30 days')
  ) AS lost_leads_30d,
  
  -- Leads met beslissing (won + lost) 30 dagen
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.status IN ('won', 'lost') 
    AND l.assigned_at >= (NOW() - INTERVAL '30 days')
  ) AS leads_with_decision_30d,
  
  -- =====================================================
  -- METRIC 4: FOLLOW-UP DISCIPLINE
  -- =====================================================
  -- Gemiddeld aantal contactpogingen per lead (30 dagen)
  -- Tel alle contact activiteiten en deel door aantal leads
  CASE
    WHEN COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')) > 0
    THEN ROUND(
      (
        SELECT COUNT(*)::NUMERIC
        FROM lead_activities la2
        JOIN leads l2 ON la2.lead_id = l2.id
        WHERE l2.assigned_to = p.id
          AND l2.assigned_at >= (NOW() - INTERVAL '30 days')
          AND la2.type IN ('phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted')
      ) / 
      COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days'))::NUMERIC,
      2
    )
    ELSE 0::NUMERIC
  END AS avg_contact_attempts_per_lead_30d,
  
  -- Percentage leads met minimaal 2 contactpogingen (30 dagen)
  CASE
    WHEN COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')) > 0
    THEN ROUND(
      (COUNT(DISTINCT l.id) FILTER (
        WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')
        AND (
          SELECT COUNT(*) 
          FROM lead_activities la2 
          WHERE la2.lead_id = l.id 
          AND la2.type IN ('phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted')
        ) >= 2
      )::NUMERIC / 
      COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days'))::NUMERIC) * 100,
      2
    )
    ELSE 0::NUMERIC
  END AS pct_leads_min_2_attempts_30d,
  
  -- =====================================================
  -- METRIC 5: KLANTENFEEDBACK / TEVREDENHEID
  -- =====================================================
  -- Gemiddelde rating (30 dagen)
  AVG(lf.rating) FILTER (
    WHERE lf.created_at >= (NOW() - INTERVAL '30 days')
  ) AS avg_customer_rating_30d,
  
  -- Aantal ratings (30 dagen)
  COUNT(DISTINCT lf.id) FILTER (
    WHERE lf.created_at >= (NOW() - INTERVAL '30 days')
  ) AS num_ratings_30d,
  
  -- =====================================================
  -- METRIC 6: KLACHTEN / COMPLAINTS
  -- =====================================================
  -- Aantal klachten (30 dagen)
  COUNT(DISTINCT st.id) FILTER (
    WHERE st.type = 'complaint' 
    AND st.created_at >= (NOW() - INTERVAL '30 days')
  ) AS complaints_30d,
  
  -- Complaint rate (30 dagen)
  CASE
    WHEN COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days')) > 0
    THEN ROUND(
      (COUNT(DISTINCT st.id) FILTER (
        WHERE st.type = 'complaint' 
        AND st.created_at >= (NOW() - INTERVAL '30 days')
      )::NUMERIC / 
      COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_at >= (NOW() - INTERVAL '30 days'))::NUMERIC) * 100,
      2
    )
    ELSE 0::NUMERIC
  END AS complaint_rate_30d,
  
  -- =====================================================
  -- METRIC 7: DEALWAARDE
  -- =====================================================
  -- Gemiddelde deal waarde (30 dagen) - gebruik deal_value of price_at_purchase
  AVG(COALESCE(l.deal_value, l.price_at_purchase)) FILTER (
    WHERE l.status = 'won' 
    AND l.assigned_at >= (NOW() - INTERVAL '30 days')
    AND (l.deal_value IS NOT NULL OR l.price_at_purchase IS NOT NULL)
  ) AS avg_deal_value_30d,
  
  -- Mediaan deal waarde (30 dagen) - vereist PERCENTILE_CONT functie
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(l.deal_value, l.price_at_purchase)) FILTER (
    WHERE l.status = 'won' 
    AND l.assigned_at >= (NOW() - INTERVAL '30 days')
    AND (l.deal_value IS NOT NULL OR l.price_at_purchase IS NOT NULL)
  ) AS median_deal_value_30d,
  
  -- =====================================================
  -- METRIC 8: CONSISTENTIE SCORE
  -- =====================================================
  -- Consistency score gebaseerd op verschil tussen 7d en 30d metrics
  -- Vereenvoudigde berekening: kleiner verschil = hogere score (0-100)
  -- Bereken direct met dezelfde data als de andere metrics
  GREATEST(0, LEAST(100, 
    100 - (
      -- Penalty voor verschil in deal_rate (max 50 punten penalty)
      COALESCE(
        ABS(
          -- Deal rate 7d
          (CASE
            WHEN COUNT(DISTINCT l.id) FILTER (
              WHERE l.status IN ('won', 'lost') 
              AND l.assigned_at >= (NOW() - INTERVAL '7 days')
            ) > 0
            THEN (COUNT(DISTINCT l.id) FILTER (
              WHERE l.status = 'won' 
              AND l.assigned_at >= (NOW() - INTERVAL '7 days')
            )::NUMERIC / 
            COUNT(DISTINCT l.id) FILTER (
              WHERE l.status IN ('won', 'lost') 
              AND l.assigned_at >= (NOW() - INTERVAL '7 days')
            )::NUMERIC) * 100
            ELSE 0
          END) -
          -- Deal rate 30d (gebruik de al berekende waarde hierboven)
          (CASE
            WHEN COUNT(DISTINCT l.id) FILTER (
              WHERE l.status IN ('won', 'lost') 
              AND l.assigned_at >= (NOW() - INTERVAL '30 days')
            ) > 0
            THEN (COUNT(DISTINCT l.id) FILTER (
              WHERE l.status = 'won' 
              AND l.assigned_at >= (NOW() - INTERVAL '30 days')
            )::NUMERIC / 
            COUNT(DISTINCT l.id) FILTER (
              WHERE l.status IN ('won', 'lost') 
              AND l.assigned_at >= (NOW() - INTERVAL '30 days')
            )::NUMERIC) * 100
            ELSE 0
          END)
        ) * 2,
        0
      ) +
      -- Penalty voor verschil in response_time (max 50 punten penalty)
      COALESCE(
        ABS(
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (l.first_contact_at - l.created_at)) / 60) 
            FILTER (WHERE l.first_contact_at IS NOT NULL 
                    AND l.assigned_at >= (NOW() - INTERVAL '7 days')),
            0
          ) - 
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (l.first_contact_at - l.created_at)) / 60) 
            FILTER (WHERE l.first_contact_at IS NOT NULL 
                    AND l.assigned_at >= (NOW() - INTERVAL '30 days')),
            0
          )
        ) / 10,
        0
      )
    )
  )) AS consistency_score

FROM profiles p
LEFT JOIN leads l ON l.assigned_to = p.id
LEFT JOIN lead_feedback lf ON lf.lead_id = l.id AND lf.partner_id = p.id
LEFT JOIN support_tickets st ON st.lead_id = l.id AND st.partner_id = p.id
WHERE p.is_admin = false
GROUP BY p.id, p.ai_risk_score;

-- =====================================================
-- 3. INDEXEN VOOR PERFORMANCE
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_performance_stats_partner_id 
  ON public.partner_performance_stats (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_performance_stats_leads_assigned_30d 
  ON public.partner_performance_stats (leads_assigned_30d DESC);

CREATE INDEX IF NOT EXISTS idx_partner_performance_stats_deal_rate_30d 
  ON public.partner_performance_stats (deal_rate_30d DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_partner_performance_stats_ai_trust_score 
  ON public.partner_performance_stats (ai_trust_score DESC NULLS LAST);

-- =====================================================
-- 4. REFRESH FUNCTION (update indien nodig)
-- =====================================================

-- Check of refresh functie al bestaat, zo niet maak aan
CREATE OR REPLACE FUNCTION public.refresh_partner_performance_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.partner_performance_stats;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.partner_performance_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_partner_performance_stats() TO authenticated;

-- =====================================================
-- 5. INITIAL REFRESH
-- =====================================================

-- Refresh de view voor het eerst (zonder CONCURRENTLY voor eerste keer)
REFRESH MATERIALIZED VIEW public.partner_performance_stats;

-- =====================================================
-- EINDE MIGRATION
-- =====================================================

