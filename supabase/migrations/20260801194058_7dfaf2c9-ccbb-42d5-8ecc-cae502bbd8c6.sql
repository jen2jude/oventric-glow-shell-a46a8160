ALTER TABLE public.post_likes DROP CONSTRAINT IF EXISTS post_likes_reaction_check;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_reaction_check CHECK (reaction = ANY (ARRAY['love'::text,'like'::text,'dislike'::text,'laugh'::text,'crown'::text]));
ALTER TABLE public.comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_reaction_check;
ALTER TABLE public.comment_reactions ADD CONSTRAINT comment_reactions_reaction_check CHECK (reaction = ANY (ARRAY['love'::text,'like'::text,'dislike'::text,'laugh'::text,'crown'::text]));