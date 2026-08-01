DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY[
    'ZAR','KES','EGP','MAD','DZD','TND','LYD','XOF','XAF','ETB','UGX','TZS','RWF','BIF','CDF',
    'AOA','MZN','ZMW','MWK','BWP','NAD','LSL','SZL','MUR','SCR','CVE','GMD','GNF','LRD','SLE',
    'SDG','SSP','SOS','DJF','ERN','KMF','MGA','MRU','STN','ZWG'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'wallet_currency' AND e.enumlabel = c
    ) THEN
      EXECUTE format('ALTER TYPE public.wallet_currency ADD VALUE %L', c);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_currency_check;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_currency_check
  CHECK (currency = ANY (ARRAY[
    'USD','NGN','GHS','ZAR','KES','EGP','MAD','DZD','TND','LYD','XOF','XAF','ETB','UGX','TZS',
    'RWF','BIF','CDF','AOA','MZN','ZMW','MWK','BWP','NAD','LSL','SZL','MUR','SCR','CVE','GMD',
    'GNF','LRD','SLE','SDG','SSP','SOS','DJF','ERN','KMF','MGA','MRU','STN','ZWG'
  ]::text[]));

ALTER TABLE public.payout_requests DROP CONSTRAINT IF EXISTS payout_requests_currency_check;
ALTER TABLE public.payout_requests ADD CONSTRAINT payout_requests_currency_check
  CHECK (currency = ANY (ARRAY[
    'USD','NGN','GHS','ZAR','KES','EGP','MAD','DZD','TND','LYD','XOF','XAF','ETB','UGX','TZS',
    'RWF','BIF','CDF','AOA','MZN','ZMW','MWK','BWP','NAD','LSL','SZL','MUR','SCR','CVE','GMD',
    'GNF','LRD','SLE','SDG','SSP','SOS','DJF','ERN','KMF','MGA','MRU','STN','ZWG'
  ]::text[]));

ALTER TABLE public.payout_recipients DROP CONSTRAINT IF EXISTS payout_recipients_currency_check;
ALTER TABLE public.payout_recipients ADD CONSTRAINT payout_recipients_currency_check
  CHECK (currency = ANY (ARRAY['NGN','GHS','ZAR','KES']::text[]));