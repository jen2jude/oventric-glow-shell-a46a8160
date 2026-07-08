ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;