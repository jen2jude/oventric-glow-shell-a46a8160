-- P2P wallet transfer: atomic debit/credit between two users in the same currency.
CREATE OR REPLACE FUNCTION public.wallet_transfer_to_user(
  _recipient_id uuid,
  _currency text,
  _amount numeric,
  _note text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sender uuid := auth.uid();
  _sender_bal numeric;
  _ref text := 'P2P-' || substr(gen_random_uuid()::text, 1, 8);
  _recipient_name text;
  _sender_name text;
BEGIN
  IF _sender IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _recipient_id IS NULL THEN
    RAISE EXCEPTION 'recipient required';
  END IF;
  IF _recipient_id = _sender THEN
    RAISE EXCEPTION 'cannot transfer to yourself';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _recipient_id) THEN
    RAISE EXCEPTION 'recipient not found';
  END IF;

  -- Lock sender's wallet row first (consistent lock ordering by user_id to avoid deadlocks
  -- is handled by always locking sender before recipient below).
  SELECT available_balance INTO _sender_bal
    FROM public.wallets
    WHERE user_id = _sender AND currency = _currency
    FOR UPDATE;

  IF COALESCE(_sender_bal, 0) < _amount THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  -- Ensure recipient wallet row exists, then lock it.
  INSERT INTO public.wallets (user_id, currency) VALUES (_recipient_id, _currency)
    ON CONFLICT (user_id, currency) DO NOTHING;

  PERFORM 1 FROM public.wallets WHERE user_id = _recipient_id AND currency = _currency FOR UPDATE;

  UPDATE public.wallets
    SET available_balance = available_balance - _amount, updated_at = now()
    WHERE user_id = _sender AND currency = _currency;

  UPDATE public.wallets
    SET available_balance = available_balance + _amount, updated_at = now()
    WHERE user_id = _recipient_id AND currency = _currency;

  SELECT COALESCE(display_name, username, 'a user') INTO _recipient_name FROM public.profiles WHERE user_id = _recipient_id;
  SELECT COALESCE(display_name, username, 'Someone') INTO _sender_name FROM public.profiles WHERE user_id = _sender;

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_sender, _ref || '-OUT', 'Wallet Transfer Sent', _amount, _currency, false, 'success', now());

  INSERT INTO public.wallet_transactions(user_id, tx_hash, type, amount, currency, inflow, status, occurred_at)
    VALUES (_recipient_id, _ref || '-IN', 'Wallet Transfer Received', _amount, _currency, true, 'success', now());

  INSERT INTO public.audit_logs (actor_id, action, target_id, meta)
    VALUES (_sender, 'wallet.transfer', _recipient_id,
      jsonb_build_object('currency', _currency, 'amount', _amount, 'note', _note, 'ref', _ref));

  RETURN jsonb_build_object('ok', true, 'ref', _ref, 'recipient_name', _recipient_name, 'sender_name', _sender_name);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.wallet_transfer_to_user(uuid, text, numeric, text) TO authenticated;

-- Allow the new transaction types produced above wherever wallet_transactions.type
-- is constrained by a CHECK; if no such constraint exists this is a no-op guard.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_type_check'
  ) THEN
    ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_type_check;
  END IF;
END $$;
