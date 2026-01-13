-- ============================================
-- Insert Spotlight Mini-Square Bug
-- ============================================
-- Run this SQL in your Supabase SQL Editor to add the spotlight bug

INSERT INTO bugs (
  bug_id,
  title,
  description,
  priority,
  status,
  area,
  url,
  reporter,
  tags,
  created_at
) VALUES (
  'BUG-101',
  'Spotlight mini-square at (0,0) on step navigation',
  'Tiny highlight appears top-left for a split second when switching steps in the onboarding tour. This causes a visible flicker where a small square (~16-40px) appears at coordinates (0,0) before the correct highlight is rendered.',
  'urgent',
  'open',
  'Onboarding Tour',
  '/dashboard/leads?tour=true&step=3',
  'QA - Laura',
  ARRAY['UI', 'Overlay', 'Mask', 'Flicker'],
  NOW()
)
ON CONFLICT (bug_id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  area = EXCLUDED.area,
  url = EXCLUDED.url,
  reporter = EXCLUDED.reporter,
  tags = EXCLUDED.tags,
  updated_at = NOW();

