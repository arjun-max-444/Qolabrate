revoke execute on function
  public.handle_new_user(),
  public.bump_counters(),
  public.protect_profile_fields(),
  public.protect_post_counters(),
  public.on_block_created(),
  public.reports_guard(),
  public.notify_social(),
  public.content_rate_limit(),
  public.on_message_created(),
  public.applications_guard(),
  public.applications_after(),
  public.collaborations_guard(),
  public.collaborations_after_update(),
  public.workspace_guard(),
  public.workspace_activity(),
  public.v2_notify(uuid, uuid, text, text, text, text),
  public.log_collab(uuid, text, text),
  public.rate_limit(text, text, uuid, integer, interval)
from public, anon, authenticated;

revoke execute on function
  public.v2_has_role(uuid, public.v2_app_role),
  public.is_staff(uuid),
  public.is_blocked_between(uuid, uuid),
  public.is_conversation_member(uuid, uuid),
  public.is_campaign_owner(uuid, uuid),
  public.is_collab_member(uuid, uuid),
  public.collab_role(uuid, uuid),
  public.private_path_allowed(text, uuid, boolean),
  public.start_conversation(uuid),
  public.my_unread_counts(),
  public.admin_set_verified(uuid, boolean)
from public, anon;
grant execute on function
  public.v2_has_role(uuid, public.v2_app_role),
  public.is_staff(uuid),
  public.is_blocked_between(uuid, uuid),
  public.is_conversation_member(uuid, uuid),
  public.is_campaign_owner(uuid, uuid),
  public.is_collab_member(uuid, uuid),
  public.collab_role(uuid, uuid),
  public.private_path_allowed(text, uuid, boolean),
  public.start_conversation(uuid),
  public.my_unread_counts(),
  public.admin_set_verified(uuid, boolean)
to authenticated;

create extension if not exists pg_cron;

create or replace function public.send_deadline_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare r record; m record; when_txt text;
begin
  for r in
    select t.id, t.title, t.due_date, t.assignee_id, t.collaboration_id
    from public.tasks t
    join public.collaborations c on c.id = t.collaboration_id
    where t.status <> 'done' and t.due_date between current_date and current_date + 1
      and c.status not in ('completed','cancelled')
  loop
    when_txt := case when r.due_date = current_date then 'today' else 'tomorrow' end;
    for m in
      select cm.user_id from public.collaboration_members cm
      where cm.collaboration_id = r.collaboration_id
        and (r.assignee_id is null or cm.user_id = r.assignee_id)
    loop
      perform public.v2_notify(m.user_id, null, 'task',
        'Reminder: task "' || r.title || '" is due ' || when_txt,
        '/collaborate/w/' || r.collaboration_id,
        'remind:task:' || r.id || ':' || m.user_id || ':' || r.due_date || ':' || when_txt);
    end loop;
  end loop;

  for r in
    select ms.id, ms.title, ms.due_date, ms.collaboration_id
    from public.milestones ms
    join public.collaborations c on c.id = ms.collaboration_id
    where not ms.done and ms.due_date between current_date and current_date + 1
      and c.status not in ('completed','cancelled')
  loop
    when_txt := case when r.due_date = current_date then 'today' else 'tomorrow' end;
    for m in select cm.user_id from public.collaboration_members cm where cm.collaboration_id = r.collaboration_id
    loop
      perform public.v2_notify(m.user_id, null, 'task',
        'Reminder: milestone "' || r.title || '" is due ' || when_txt,
        '/collaborate/w/' || r.collaboration_id,
        'remind:ms:' || r.id || ':' || m.user_id || ':' || r.due_date || ':' || when_txt);
    end loop;
  end loop;
end $$;
revoke execute on function public.send_deadline_reminders() from public, anon, authenticated;

select cron.schedule('qolabrate-deadline-reminders', '0 8 * * *', 'select public.send_deadline_reminders()');