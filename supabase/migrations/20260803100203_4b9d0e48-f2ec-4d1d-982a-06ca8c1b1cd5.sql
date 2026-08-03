CREATE TABLE public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subject text not null,
  details text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tickets read" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own tickets insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin tickets update" ON public.support_tickets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  message text not null,
  topic text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.support_feedback TO authenticated;
GRANT ALL ON public.support_feedback TO service_role;
ALTER TABLE public.support_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback read" ON public.support_feedback FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own feedback insert" ON public.support_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.support_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('user','admin')),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
CREATE INDEX support_chat_user_idx ON public.support_chat_messages(user_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.support_chat_messages TO authenticated;
GRANT ALL ON public.support_chat_messages TO service_role;
ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat read" ON public.support_chat_messages FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own chat insert" ON public.support_chat_messages FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid() AND sender = 'user') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin chat update" ON public.support_chat_messages FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_messages;