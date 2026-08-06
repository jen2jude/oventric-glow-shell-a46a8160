-- 1) products: replace table-wide SELECT with column-scoped grants (hide contact fields)
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (id,seller_id,name,category,description,price_usd,hue,cover_path,file_path,external_url,vendor,rating,reviews,promoted,created_at,updated_at,original_currency,original_amount,fx_snapshot,kind,status,reject_reason,subcategory,condition,brand,location,negotiable,delivery,image_paths,requires_manual_delivery)
  ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;

-- 2) order_disputes: explicit admin-only UPDATE policy
DROP POLICY IF EXISTS "disputes_update_admin" ON public.order_disputes;
CREATE POLICY "disputes_update_admin" ON public.order_disputes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) push_subscriptions: no anon-role access, and exclude anonymous JWT users
REVOKE ALL ON public.push_subscriptions FROM anon;
DROP POLICY IF EXISTS "Users manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage their own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  WITH CHECK (auth.uid() = user_id AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);