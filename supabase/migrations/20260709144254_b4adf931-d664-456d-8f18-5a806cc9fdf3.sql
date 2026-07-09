
GRANT SELECT ON public.posts TO anon;
GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT ON public.profiles TO anon;

CREATE POLICY "public can read posts" ON public.posts FOR SELECT TO anon USING (true);
CREATE POLICY "public can read comments" ON public.post_comments FOR SELECT TO anon USING (true);
CREATE POLICY "public can read likes" ON public.post_likes FOR SELECT TO anon USING (true);
CREATE POLICY "public can read profiles" ON public.profiles FOR SELECT TO anon USING (true);
