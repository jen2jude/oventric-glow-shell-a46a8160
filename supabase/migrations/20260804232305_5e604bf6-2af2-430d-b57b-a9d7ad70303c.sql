insert into public.notifications (user_id, kind, title, body, link, from_user_id)
select dm.recipient_id, 'direct_message', coalesce(p.display_name,p.username,'Someone')||' sent you a message', left(coalesce(dm.body,'📎 Attachment'),140), '/messages', dm.sender_id
from public.direct_messages dm left join public.profiles p on p.user_id = dm.sender_id
where dm.read_at is null and dm.created_at > now() - interval '2 days';