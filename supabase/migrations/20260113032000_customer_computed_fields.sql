-- =====================================================
-- CUSTOMER COMPUTED FIELDS (FUNCTIONS + VIEWS)
-- =====================================================
-- Goal: keep CRM clean by storing raw/source fields, and computing derived fields in functions/views.
-- - Normalization: domain, website url, phone, display name, postcode
-- - Dedupe: primary/secondary keys + duplicate candidate flag
-- - Activity: days since last interaction + overdue next activity + buckets + pressure
-- - Views: customer_enriched + overdue follow-ups (sales)
-- =====================================================

-- -----------------------------------------------------
-- 0) Ensure HubSpot columns exist (idempotent)
-- -----------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS hubspot_company_id TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_company_name TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_primary_domain TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_website_url TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_extra_domains TEXT[],
  ADD COLUMN IF NOT EXISTS hubspot_phone TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_address1 TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_address2 TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_postcode TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_city TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_country TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_country_code TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_industry TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_industry_group TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_employee_count INTEGER,
  ADD COLUMN IF NOT EXISTS hubspot_owner TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lifecycle_stage TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lead_status TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_lead_source TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hubspot_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hubspot_last_interaction_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hubspot_next_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hubspot_times_contacted INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_hubspot_company_id
  ON public.customers (hubspot_company_id)
  WHERE hubspot_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_hubspot_primary_domain
  ON public.customers (lower(hubspot_primary_domain))
  WHERE hubspot_primary_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_hubspot_website_url
  ON public.customers (lower(hubspot_website_url))
  WHERE hubspot_website_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_hubspot_next_activity_at
  ON public.customers (hubspot_next_activity_at)
  WHERE hubspot_next_activity_at IS NOT NULL;

-- -----------------------------------------------------
-- 1) Normalization functions
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.company_display_name(p_raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(btrim(p_raw), '\s+', ' ', 'g'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_postcode(p_postcode TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    upper(regexp_replace(btrim(p_postcode), '\s+', '', 'g')),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_domain(p_input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    NULLIF(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            -- if it's an email, use domain part; else use input
            CASE
              WHEN p_input IS NULL THEN NULL
              WHEN position('@' in p_input) > 0 AND position('/' in p_input) = 0 THEN split_part(lower(btrim(p_input)), '@', 2)
              ELSE lower(btrim(p_input))
            END,
            '^https?://', ''
          ),
          '^www\.', ''
        ),
        '/.*$', ''
      ),
      ''
    );
$$;

CREATE OR REPLACE FUNCTION public.normalize_website_url(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v TEXT;
BEGIN
  v := NULLIF(btrim(p_input), '');
  IF v IS NULL THEN
    RETURN NULL;
  END IF;

  -- remove spaces
  v := regexp_replace(v, '\s+', '', 'g');

  -- if it already has a scheme, keep it
  IF v ~* '^https?://' THEN
    v := v;
  ELSE
    -- if it looks like a domain, prefix https://
    v := 'https://' || v;
  END IF;

  -- strip trailing slash
  v := regexp_replace(v, '/+$', '');

  RETURN v;
END;
$$;

-- NL-focused phone normalizer (good enough for CRM usage)
CREATE OR REPLACE FUNCTION public.normalize_phone_nl(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v TEXT;
  digits TEXT;
BEGIN
  v := NULLIF(btrim(p_input), '');
  IF v IS NULL THEN
    RETURN NULL;
  END IF;

  -- keep + and digits, drop everything else
  v := regexp_replace(v, '[^0-9+]', '', 'g');

  -- convert 00 prefix to +
  IF v LIKE '00%' THEN
    v := '+' || substring(v from 3);
  END IF;

  -- if starts with 31 without +, convert
  IF v ~ '^31[0-9]+' THEN
    v := '+' || v;
  END IF;

  -- if starts with 0, assume NL and convert to +31
  IF v ~ '^0[0-9]{9}$' THEN
    v := '+31' || substring(v from 2);
  END IF;

  -- sanity: require at least 8 digits total
  digits := regexp_replace(v, '[^0-9]', '', 'g');
  IF length(digits) < 8 THEN
    RETURN NULL;
  END IF;

  RETURN v;
END;
$$;

-- -----------------------------------------------------
-- 2) Dedupe functions
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.dedupe_key_primary(
  p_domain TEXT,
  p_website_url TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_domain(COALESCE(p_domain, p_website_url));
$$;

CREATE OR REPLACE FUNCTION public.dedupe_key_secondary(
  p_company_name TEXT,
  p_postal_code TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    NULLIF(
      lower(COALESCE(public.company_display_name(p_company_name), '')) || '|' ||
      COALESCE(public.normalize_postcode(p_postal_code), ''),
      '|'
    );
$$;

CREATE OR REPLACE FUNCTION public.customer_is_duplicate_candidate(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  WITH me AS (
    SELECT
      id,
      public.dedupe_key_primary(
        COALESCE(hubspot_primary_domain, domain),
        COALESCE(hubspot_website_url, website)
      ) AS k1,
      public.dedupe_key_secondary(
        COALESCE(hubspot_company_name, company_name, name),
        COALESCE(hubspot_postcode, postal_code)
      ) AS k2
    FROM public.customers
    WHERE id = p_customer_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN me ON true
    WHERE c.id <> me.id
      AND (
        (me.k1 IS NOT NULL AND public.dedupe_key_primary(COALESCE(c.hubspot_primary_domain, c.domain), COALESCE(c.hubspot_website_url, c.website)) = me.k1)
        OR
        (me.k2 IS NOT NULL AND public.dedupe_key_secondary(COALESCE(c.hubspot_company_name, c.company_name, c.name), COALESCE(c.hubspot_postcode, c.postal_code)) = me.k2)
      )
  );
$$;

-- -----------------------------------------------------
-- 3) Activity functions (computed, never stored)
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.days_since_last_interaction(p_last_interaction TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN p_last_interaction IS NULL THEN NULL
      ELSE floor(extract(epoch from (now() - p_last_interaction)) / 86400)::int
    END;
$$;

CREATE OR REPLACE FUNCTION public.has_overdue_next_activity(p_next_activity TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN p_next_activity IS NULL THEN FALSE
      ELSE p_next_activity < now()
    END;
$$;

CREATE OR REPLACE FUNCTION public.activity_bucket(p_days_since INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN p_days_since IS NULL THEN NULL
      WHEN p_days_since <= 7 THEN '0-7'
      WHEN p_days_since <= 30 THEN '8-30'
      WHEN p_days_since <= 90 THEN '31-90'
      ELSE '90+'
    END;
$$;

CREATE OR REPLACE FUNCTION public.contact_pressure(
  p_times_contacted INTEGER,
  p_last_interaction TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT
    LEAST(
      100,
      COALESCE(p_times_contacted, 0) * 10
      + CASE
          WHEN p_last_interaction IS NULL THEN 0
          WHEN public.days_since_last_interaction(p_last_interaction) <= 7 THEN 40
          WHEN public.days_since_last_interaction(p_last_interaction) <= 30 THEN 20
          WHEN public.days_since_last_interaction(p_last_interaction) <= 90 THEN 10
          ELSE 0
        END
    );
$$;

-- -----------------------------------------------------
-- 4) Quality / contactability functions
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_is_contactable(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    (
      public.normalize_phone_nl(COALESCE(c.hubspot_phone, c.phone)) IS NOT NULL
      OR public.normalize_domain(COALESCE(c.hubspot_primary_domain, c.domain, c.hubspot_website_url, c.website)) IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.customer_id = c.id)
    )
  FROM public.customers c
  WHERE c.id = p_customer_id;
$$;

CREATE OR REPLACE FUNCTION public.customer_data_quality_score(p_customer_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT
    LEAST(100,
      (CASE WHEN public.normalize_domain(COALESCE(c.hubspot_primary_domain, c.domain, c.hubspot_website_url, c.website)) IS NOT NULL THEN 30 ELSE 0 END)
    + (CASE WHEN public.normalize_phone_nl(COALESCE(c.hubspot_phone, c.phone)) IS NOT NULL THEN 20 ELSE 0 END)
    + (CASE WHEN COALESCE(c.hubspot_address1, c.address) IS NOT NULL AND btrim(COALESCE(c.hubspot_address1, c.address)) <> '' THEN 10 ELSE 0 END)
    + (CASE WHEN COALESCE(c.hubspot_postcode, c.postal_code) IS NOT NULL AND btrim(COALESCE(c.hubspot_postcode, c.postal_code)) <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN COALESCE(c.hubspot_city, c.city) IS NOT NULL AND btrim(COALESCE(c.hubspot_city, c.city)) <> '' THEN 5 ELSE 0 END)
    + (CASE WHEN c.hubspot_industry IS NOT NULL AND btrim(c.hubspot_industry) <> '' THEN 10 ELSE 0 END)
    + (CASE WHEN c.hubspot_employee_count IS NOT NULL THEN 10 ELSE 0 END)
    + (CASE WHEN c.hubspot_owner IS NOT NULL AND btrim(c.hubspot_owner) <> '' THEN 10 ELSE 0 END)
    )
  FROM public.customers c
  WHERE c.id = p_customer_id;
$$;

CREATE OR REPLACE FUNCTION public.customer_full_address(p_customer_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      btrim(
        COALESCE(NULLIF(btrim(COALESCE(c.hubspot_address1, c.address)), ''), '') ||
        CASE WHEN COALESCE(c.hubspot_address2, '') <> '' THEN ' ' || btrim(c.hubspot_address2) ELSE '' END ||
        CASE WHEN COALESCE(c.hubspot_postcode, c.postal_code, '') <> '' THEN ', ' || btrim(COALESCE(c.hubspot_postcode, c.postal_code)) ELSE '' END ||
        CASE WHEN COALESCE(c.hubspot_city, c.city, '') <> '' THEN ' ' || btrim(COALESCE(c.hubspot_city, c.city)) ELSE '' END ||
        CASE WHEN COALESCE(c.hubspot_country, c.country, '') <> '' THEN ', ' || btrim(COALESCE(c.hubspot_country, c.country)) ELSE '' END
      ),
      '\s+', ' ', 'g'
    ),
    ''
  )
  FROM public.customers c
  WHERE c.id = p_customer_id;
$$;

-- -----------------------------------------------------
-- 5) Views
-- -----------------------------------------------------

CREATE OR REPLACE VIEW public.customer_enriched AS
SELECT
  c.*,
  public.company_display_name(COALESCE(c.hubspot_company_name, c.company_name, c.name)) AS company_display_name,
  public.normalize_domain(COALESCE(c.hubspot_primary_domain, c.domain, c.hubspot_website_url, c.website)) AS normalized_domain,
  public.normalize_website_url(COALESCE(c.hubspot_website_url, c.website)) AS normalized_website_url,
  public.normalize_phone_nl(COALESCE(c.hubspot_phone, c.phone)) AS normalized_phone,
  public.dedupe_key_primary(COALESCE(c.hubspot_primary_domain, c.domain), COALESCE(c.hubspot_website_url, c.website)) AS dedupe_key_primary,
  public.dedupe_key_secondary(COALESCE(c.hubspot_company_name, c.company_name, c.name), COALESCE(c.hubspot_postcode, c.postal_code)) AS dedupe_key_secondary,
  public.days_since_last_interaction(c.hubspot_last_interaction_at) AS days_since_last_interaction,
  public.has_overdue_next_activity(c.hubspot_next_activity_at) AS has_overdue_next_activity,
  public.activity_bucket(public.days_since_last_interaction(c.hubspot_last_interaction_at)) AS activity_bucket,
  public.contact_pressure(c.hubspot_times_contacted, c.hubspot_last_interaction_at) AS contact_pressure,
  public.customer_is_contactable(c.id) AS is_contactable,
  public.customer_data_quality_score(c.id) AS data_quality_score,
  public.customer_full_address(c.id) AS full_address,
  public.customer_is_duplicate_candidate(c.id) AS is_duplicate_candidate
FROM public.customers c;

COMMENT ON VIEW public.customer_enriched IS 'Customers with computed/normalized fields (no derived data stored).';

CREATE OR REPLACE VIEW public.sales_overdue_followups AS
SELECT
  c.id AS customer_id,
  c.company_display_name,
  c.hubspot_owner AS owner,
  c.hubspot_next_activity_at AS next_activity_at,
  c.days_since_last_interaction,
  c.activity_bucket,
  c.contact_pressure,
  c.data_quality_score,
  c.normalized_domain,
  c.normalized_phone
FROM public.customer_enriched c
WHERE c.hubspot_next_activity_at IS NOT NULL
  AND c.hubspot_next_activity_at < now()
ORDER BY c.hubspot_next_activity_at ASC;

COMMENT ON VIEW public.sales_overdue_followups IS 'Sales overview: customers with overdue next activity, computed fields included.';

