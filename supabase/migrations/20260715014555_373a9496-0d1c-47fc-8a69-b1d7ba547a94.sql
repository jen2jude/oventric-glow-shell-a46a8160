
-- Grant Data API access on academy tables (missing since creation).
GRANT SELECT ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;

GRANT SELECT ON public.course_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_enrollments TO authenticated;
GRANT ALL ON public.course_enrollments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_progress TO authenticated;
GRANT ALL ON public.course_progress TO service_role;

-- Extend courses for the new publish wizard.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS long_description text,
  ADD COLUMN IF NOT EXISTS require_linear boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS issue_certificate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_template text,
  ADD COLUMN IF NOT EXISTS quizzes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Extend course_modules to support sections + multiple lesson types.
ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS section_title text,
  ADD COLUMN IF NOT EXISTS section_position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS content_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Loosen video_url NOT NULL (text and pdf lessons don't have one).
ALTER TABLE public.course_modules ALTER COLUMN video_url DROP NOT NULL;

-- Valid lesson types.
ALTER TABLE public.course_modules DROP CONSTRAINT IF EXISTS course_modules_content_type_chk;
ALTER TABLE public.course_modules
  ADD CONSTRAINT course_modules_content_type_chk
  CHECK (content_type IN ('video','text','pdf'));
