create or replace function public.create_practice_session(p_collection uuid,p_date date,p_questions uuid[],p_request_id text)
returns public.practice_sessions language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();c collections;s practice_sessions;q uuid;pos integer:=0;new_count integer;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_collection::text||p_date::text,0));
  select * into c from collections where id=p_collection and user_id=uid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  select * into s from practice_sessions where user_id=uid and collection_id=p_collection and session_date=p_date;
  if found then return s;end if;
  if c.archived_at is not null then raise exception 'ARCHIVED_COLLECTION';end if;
  if p_questions is null or cardinality(p_questions)>c.daily_target or cardinality(p_questions)<>(select count(distinct x) from unnest(p_questions) x) then raise exception 'INVALID_SELECTION';end if;
  -- Lock every selected question before checking eligibility; concurrent edits cannot invalidate selection.
  perform id from questions where id=any(p_questions) order by id for update;
  if (select count(*) from questions where id=any(p_questions) and collection_id=p_collection and user_id=uid and archived_at is null)<>cardinality(p_questions) then raise exception 'INVALID_SELECTION';end if;
  if exists(select 1 from session_questions sq join practice_sessions ps on ps.id=sq.session_id where sq.question_id=any(p_questions) and sq.user_id=uid and ps.session_date in (p_date-1,p_date+1)) then raise exception 'CONSECUTIVE_DAY';end if;
  -- Serialize eligibility checks with rating writes.
  perform question_id from question_progress where question_id=any(p_questions) and user_id=uid order by question_id for update;
  if exists(select 1 from question_progress where question_id=any(p_questions) and user_id=uid and total_attempts>0 and next_review_at>p_date) then raise exception 'NOT_DUE';end if;
  select count(*) into new_count from questions q left join question_progress p on p.question_id=q.id and p.user_id=uid where q.id=any(p_questions) and coalesce(p.total_attempts,0)=0;
  if new_count>c.new_question_limit then raise exception 'NEW_LIMIT';end if;
  insert into practice_sessions(user_id,collection_id,session_date,target_question_count) values(uid,p_collection,p_date,c.daily_target) returning * into s;
  foreach q in array p_questions loop
    insert into session_questions(session_id,question_id,collection_id,user_id,position) values(s.id,q,p_collection,uid,pos);pos:=pos+1;
    insert into question_progress(user_id,question_id,last_shown_at) values(uid,q,now()) on conflict(user_id,question_id) do update set last_shown_at=now(),updated_at=now();
  end loop;
  insert into audit_events(user_id,event_type,request_id,entity_type,entity_id,safe_metadata) values(uid,'session.created',p_request_id,'session',s.id,jsonb_build_object('selected',pos,'target',c.daily_target));
  return s;
end $$;

