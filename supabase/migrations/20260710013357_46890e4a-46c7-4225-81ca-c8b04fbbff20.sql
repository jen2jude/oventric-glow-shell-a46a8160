
-- System wallets (admin-held revenue buckets)
CREATE TABLE public.system_wallets (
  kind TEXT PRIMARY KEY CHECK (kind IN ('marketplace','bounty','ads')),
  balance_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_wallets TO authenticated;
GRANT ALL ON public.system_wallets TO service_role;
ALTER TABLE public.system_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view system wallets"
  ON public.system_wallets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.system_wallets (kind, balance_usd) VALUES
  ('marketplace', 0),
  ('bounty', 0),
  ('ads', 0);

-- Ledger for system wallet movements (admin visibility)
CREATE TABLE public.system_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL REFERENCES public.system_wallets(kind) ON DELETE CASCADE,
  amount_usd NUMERIC(14,2) NOT NULL,
  source TEXT NOT NULL,
  ref_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_wallet_transactions TO authenticated;
GRANT ALL ON public.system_wallet_transactions TO service_role;
ALTER TABLE public.system_wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view system wallet tx"
  ON public.system_wallet_transactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX system_wallet_tx_kind_idx ON public.system_wallet_transactions (kind, created_at DESC);

-- Credit helper (SECURITY DEFINER so server fns bypass RLS write restrictions)
CREATE OR REPLACE FUNCTION public.system_wallet_credit(
  _kind TEXT,
  _amount NUMERIC,
  _source TEXT,
  _ref UUID DEFAULT NULL,
  _meta JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;
  UPDATE public.system_wallets
     SET balance_usd = balance_usd + _amount,
         updated_at = now()
   WHERE kind = _kind;
  INSERT INTO public.system_wallet_transactions (kind, amount_usd, source, ref_id, meta)
    VALUES (_kind, _amount, _source, _ref, COALESCE(_meta, '{}'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.system_wallet_credit(TEXT, NUMERIC, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- Coupons
CREATE TABLE public.coupons (
  code TEXT PRIMARY KEY,
  discount_pct NUMERIC(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 100),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active coupons"
  ON public.coupons FOR SELECT
  TO anon, authenticated
  USING (active = true);
CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.coupons (code, discount_pct) VALUES ('SAVE2', 2);
