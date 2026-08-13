CREATE TABLE IF NOT EXISTS public.withdrawal_pins (
  user_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  salt text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.withdrawal_pins TO service_role;

ALTER TABLE public.withdrawal_pins ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_withdrawal_pins_updated_at
BEFORE UPDATE ON public.withdrawal_pins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();