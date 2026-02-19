-- =====================================================
-- SOP (Standard Operating Procedures) / Handleidingen
-- =====================================================
-- Categories, SOPs, quiz questions, attempts, progress
-- =====================================================

-- Categories (e.g. Processen, Diensten)
CREATE TABLE public.sop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sop_categories_sort ON public.sop_categories(sort_order);
CREATE INDEX idx_sop_categories_slug ON public.sop_categories(slug);

-- SOPs (handleidingen)
CREATE TABLE public.sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category_id UUID NOT NULL REFERENCES public.sop_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  illustration_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(category_id, slug)
);

CREATE INDEX idx_sops_category ON public.sops(category_id);
CREATE INDEX idx_sops_published ON public.sops(published);
CREATE INDEX idx_sops_sort ON public.sops(category_id, sort_order);

-- Quiz questions per SOP
CREATE TABLE public.sop_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sop_id UUID NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (type IN ('multiple_choice', 'true_false')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sop_quiz_questions_sop ON public.sop_quiz_questions(sop_id);

-- Quiz attempts (scores)
CREATE TABLE public.sop_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sop_id UUID NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_percent NUMERIC(5,2) NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB
);

CREATE INDEX idx_sop_quiz_attempts_sop ON public.sop_quiz_attempts(sop_id);
CREATE INDEX idx_sop_quiz_attempts_user ON public.sop_quiz_attempts(user_id);

-- Progress (read + quiz passed)
CREATE TABLE public.sop_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  quiz_passed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sop_id, user_id)
);

CREATE INDEX idx_sop_progress_user ON public.sop_progress(user_id);
CREATE INDEX idx_sop_progress_sop ON public.sop_progress(sop_id);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_sop_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sop_categories_updated_at ON public.sop_categories;
CREATE TRIGGER trigger_sop_categories_updated_at
  BEFORE UPDATE ON public.sop_categories
  FOR EACH ROW EXECUTE FUNCTION update_sop_updated_at();

DROP TRIGGER IF EXISTS trigger_sops_updated_at ON public.sops;
CREATE TRIGGER trigger_sops_updated_at
  BEFORE UPDATE ON public.sops
  FOR EACH ROW EXECUTE FUNCTION update_sop_updated_at();

DROP TRIGGER IF EXISTS trigger_sop_quiz_questions_updated_at ON public.sop_quiz_questions;
CREATE TRIGGER trigger_sop_quiz_questions_updated_at
  BEFORE UPDATE ON public.sop_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION update_sop_updated_at();

DROP TRIGGER IF EXISTS trigger_sop_progress_updated_at ON public.sop_progress;
CREATE TRIGGER trigger_sop_progress_updated_at
  BEFORE UPDATE ON public.sop_progress
  FOR EACH ROW EXECUTE FUNCTION update_sop_updated_at();

-- RLS
ALTER TABLE public.sop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sop_categories_all" ON public.sop_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sops_all" ON public.sops FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sop_quiz_questions_all" ON public.sop_quiz_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sop_quiz_attempts_select_insert" ON public.sop_quiz_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sop_progress_all" ON public.sop_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.sop_categories IS 'SOP categories (processes, services)';
COMMENT ON TABLE public.sops IS 'Standard operating procedures / handleidingen';
COMMENT ON TABLE public.sop_quiz_questions IS 'Quiz questions per SOP';
COMMENT ON TABLE public.sop_quiz_attempts IS 'User quiz attempt scores';
COMMENT ON TABLE public.sop_progress IS 'User read and quiz-passed progress';
