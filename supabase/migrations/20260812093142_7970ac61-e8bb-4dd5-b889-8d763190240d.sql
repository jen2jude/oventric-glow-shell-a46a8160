-- Add collapsible product fields to support detailed information tabs
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS basic_info text,
ADD COLUMN IF NOT EXISTS activation_guide text;

GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;
