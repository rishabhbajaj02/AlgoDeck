-- Canonical schema. Application REST queries run as authenticated with the user's JWT.
create function public.valid_review_policy(policy jsonb) returns boolean language plpgsql immutable strict set search_path=public,pg_temp as $$
declare rating text;value jsonb;
begin
  if jsonb_typeof(policy)<>'object' then return false;end if;
  if (select count(*) from jsonb_object_keys(policy))<>3 then return false;end if;
  foreach rating in array array['hard','medium','easy'] loop
    if jsonb_typeof(policy->rating) is distinct from 'array' then return false;end if;
    if jsonb_array_length(policy->rating) not between 1 and 12 then return false;end if;
    for value in select x from jsonb_array_elements(policy->rating) x loop
      if jsonb_typeof(value)<>'number' then return false;end if;
      if value::text::numeric not between 1 and 365 or value::text::numeric<>trunc(value::text::numeric) then return false;end if;
    end loop;
  end loop;
  return true;
end $$;
create table public.collections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check(length(trim(name)) between 1 and 120), description text not null default '' check(length(description)<=2000),
  daily_target integer not null default 5 check(daily_target between 1 and 50),
  new_question_limit integer not null default 3 check(new_question_limit between 0 and 50),
  review_policy jsonb not null default '{"hard":[1,2,4,7],"medium":[3,5,10,20],"easy":[7,14,30,60]}' check(public.valid_review_policy(review_policy)),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create table public.questions (
  id uuid primary key default gen_random_uuid(),collection_id uuid not null,user_id uuid not null,
  title text not null check(length(trim(title)) between 1 and 200),content text not null default '' check(length(content)<=20000),
  category text not null default '' check(length(category)<=80),pattern text not null default '' check(length(pattern)<=80),
  source_url text check(source_url is null or source_url ~* '^https?://'),metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
  unique(id,user_id),unique(id,collection_id,user_id),
  foreign key(collection_id,user_id) references public.collections(id,user_id) on delete cascade
);
create unique index questions_identity on public.questions(collection_id,lower(trim(title)),lower(trim(category)),lower(trim(pattern))) where archived_at is null;
create table public.question_progress (
  id uuid primary key default gen_random_uuid(),user_id uuid not null,question_id uuid not null,
  last_shown_at timestamptz,last_rated_at timestamptz,next_review_at date,last_rating text check(last_rating in ('easy','medium','hard')),
  current_priority double precision not null default 1 check(current_priority>0),ease_factor double precision not null default 2.5 check(ease_factor between 1.3 and 3.5),
  consecutive_successes integer not null default 0 check(consecutive_successes>=0),consecutive_difficult_ratings integer not null default 0 check(consecutive_difficult_ratings>=0),
  total_attempts integer not null default 0 check(total_attempts>=0),successful_attempts integer not null default 0 check(successful_attempts between 0 and total_attempts),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,question_id),
  foreign key(question_id,user_id) references public.questions(id,user_id) on delete cascade
);
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),user_id uuid not null,collection_id uuid not null,session_date date not null,
  status text not null default 'active' check(status in ('active','completed')),target_question_count integer not null check(target_question_count between 1 and 50),
  created_at timestamptz not null default now(),completed_at timestamptz,
  unique(user_id,collection_id,session_date),unique(id,user_id),unique(id,collection_id,user_id),
  foreign key(collection_id,user_id) references public.collections(id,user_id) on delete restrict
);
create table public.session_questions (
  id uuid primary key default gen_random_uuid(),session_id uuid not null,question_id uuid not null,collection_id uuid not null,user_id uuid not null,
  position integer not null check(position>=0),status text not null default 'pending' check(status in ('pending','completed')),
  selected_at timestamptz not null default now(),completed_at timestamptz,rating text check(rating in ('easy','medium','hard')),
  unique(session_id,question_id),unique(session_id,position),unique(session_id,question_id,user_id),
  foreign key(session_id,collection_id,user_id) references public.practice_sessions(id,collection_id,user_id) on delete restrict,
  foreign key(question_id,collection_id,user_id) references public.questions(id,collection_id,user_id) on delete restrict
);
create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),user_id uuid not null,question_id uuid not null,session_id uuid not null,
  rating text not null check(rating in ('easy','medium','hard')),attempted_at timestamptz not null default now(),study_date date not null,
  time_spent_seconds integer check(time_spent_seconds between 0 and 86400),notes text check(length(notes)<=4000),scheduling_snapshot jsonb not null,
  unique(session_id,question_id),foreign key(session_id,question_id,user_id) references public.session_questions(session_id,question_id,user_id) on delete restrict
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete restrict,event_type text not null,
  request_id text not null,entity_type text,entity_id uuid,safe_metadata jsonb not null default '{}',created_at timestamptz not null default now()
);
create index collections_owner on public.collections(user_id);
create index questions_collection on public.questions(collection_id,user_id);
create index progress_due on public.question_progress(user_id,next_review_at);
create index sessions_date on public.practice_sessions(user_id,session_date);
create index session_questions_owner on public.session_questions(user_id,question_id);
create index attempts_history on public.question_attempts(user_id,question_id,attempted_at desc);
create index attempts_study_date on public.question_attempts(user_id,study_date);
create index audit_owner on public.audit_events(user_id,created_at desc);

-- Supabase may grant broad table privileges by default. Replace them with explicit grants.
revoke all on public.collections,public.questions,public.question_progress,public.practice_sessions,public.session_questions,public.question_attempts,public.audit_events from anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['collections','questions','question_progress','practice_sessions','session_questions','question_attempts','audit_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
create policy collection_insert on public.collections for insert to authenticated with check(auth.uid()=user_id);
create policy collection_update on public.collections for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy question_insert on public.questions for insert to authenticated with check(auth.uid()=user_id and exists(select 1 from public.collections c where c.id=collection_id and c.user_id=auth.uid() and c.archived_at is null));
create policy question_update on public.questions for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
grant usage on schema public to authenticated;
grant insert(user_id,name,description,daily_target,new_question_limit,review_policy,archived_at),update(name,description,daily_target,new_question_limit,review_policy,archived_at) on public.collections to authenticated;
grant insert(user_id,collection_id,title,content,category,pattern,source_url,metadata),update(title,content,category,pattern,source_url,metadata,archived_at) on public.questions to authenticated;

create function public.record_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' then new.updated_at=now(); end if;
  insert into audit_events(user_id,event_type,request_id,entity_type,entity_id) values(new.user_id,lower(tg_table_name||'.'||tg_op),coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-request-id','database'),tg_table_name,new.id);
  return new;
end $$;
create trigger collection_change before insert or update on public.collections for each row execute function public.record_change();
create trigger question_change before insert or update on public.questions for each row execute function public.record_change();
revoke all on function public.record_change() from public;

create function public.create_practice_session(p_collection uuid,p_date date,p_questions uuid[],p_request_id text)
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
  if exists(select 1 from session_questions sq join practice_sessions ps on ps.id=sq.session_id where sq.question_id=any(p_questions) and sq.user_id=uid and ps.session_date=p_date-1) then raise exception 'CONSECUTIVE_DAY';end if;
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

create function public.rate_session_question(p_session uuid,p_question uuid,p_rating text,p_seconds integer,p_notes text,p_snapshot jsonb,p_expected integer,p_request_id text)
returns public.question_attempts language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();s practice_sessions;sq session_questions;p question_progress;a question_attempts;policy jsonb;streak integer;fails integer;days integer;intervals jsonb;next_day date;priority double precision;ease double precision;
begin
  if uid is null then raise exception 'UNAUTHORIZED';end if;
  select * into s from practice_sessions where id=p_session and user_id=uid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  select * into sq from session_questions where session_id=p_session and question_id=p_question and user_id=uid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  select * into a from question_attempts where session_id=p_session and question_id=p_question;
  if found then
    if a.rating<>p_rating or a.time_spent_seconds is distinct from p_seconds or a.notes is distinct from p_notes then raise exception 'RATING_CONFLICT';end if;
    return a;
  end if;
  if s.status<>'active' then raise exception 'SESSION_COMPLETED';end if;
  if p_rating not in ('easy','medium','hard') then raise exception 'INVALID_RATING';end if;
  select * into p from question_progress where question_id=p_question and user_id=uid for update;
  if not found or p.total_attempts<>p_expected then raise exception 'STALE_PROGRESS';end if;
  select review_policy into policy from collections where id=s.collection_id;
  streak:=case when p_rating='hard' then 0 else p.consecutive_successes+1 end;
  fails:=case when p_rating='hard' then p.consecutive_difficult_ratings+1 else 0 end;
  intervals:=policy->p_rating;
  days:=(intervals->>least(case when p_rating='hard' then fails-1 else streak-1 end,jsonb_array_length(intervals)-1))::integer;
  next_day:=s.session_date+days;
  priority:=(case p_rating when 'hard' then 4 when 'medium' then 2 else 1 end)*(1+least(fails,8)*0.5)/(1+streak*0.15);
  ease:=greatest(1.3,least(3.5,p.ease_factor+case p_rating when 'easy' then 0.1 when 'hard' then -0.2 else 0 end));
  -- Validate the server's scheduling result independently before accepting it into immutable history.
  if p_snapshot->>'next_review_at' is distinct from next_day::text or (p_snapshot->>'total_attempts')::integer is distinct from p.total_attempts+1 or p_snapshot->>'last_rating' is distinct from p_rating then raise exception 'INVALID_SNAPSHOT';end if;
  p_snapshot:=p_snapshot||jsonb_build_object('version',1,'policy',policy,'prior_progress',to_jsonb(p),'current_priority',priority,'ease_factor',ease,'consecutive_successes',streak,'consecutive_difficult_ratings',fails,'successful_attempts',p.successful_attempts+case when p_rating='hard' then 0 else 1 end);
  insert into question_attempts(user_id,question_id,session_id,rating,study_date,time_spent_seconds,notes,scheduling_snapshot) values(uid,p_question,p_session,p_rating,s.session_date,p_seconds,p_notes,p_snapshot) returning * into a;
  update question_progress set last_rated_at=now(),next_review_at=next_day,last_rating=p_rating,current_priority=priority,ease_factor=ease,consecutive_successes=streak,consecutive_difficult_ratings=fails,total_attempts=total_attempts+1,successful_attempts=successful_attempts+case when p_rating='hard' then 0 else 1 end,updated_at=now() where user_id=uid and question_id=p_question;
  update session_questions set status='completed',rating=p_rating,completed_at=now() where id=sq.id;
  insert into audit_events(user_id,event_type,request_id,entity_type,entity_id,safe_metadata) values(uid,'question.rated',p_request_id,'question',p_question,jsonb_build_object('rating',p_rating,'next_review_at',next_day));
  return a;
end $$;

create function public.complete_practice_session(p_session uuid,p_request_id text)
returns public.practice_sessions language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();s practice_sessions;
begin
  select * into s from practice_sessions where id=p_session and user_id=uid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from session_questions where session_id=p_session and status='pending') then raise exception 'UNANSWERED_QUESTIONS';end if;
  if s.status='completed' then return s;end if;
  update practice_sessions set status='completed',completed_at=now() where id=p_session returning * into s;
  insert into audit_events(user_id,event_type,request_id,entity_type,entity_id) values(uid,'session.completed',p_request_id,'session',s.id);
  return s;
end $$;

create function public.import_questions(p_collection uuid,p_rows jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();r jsonb;inserted integer:=0;n integer;
begin
  perform id from collections where id=p_collection and user_id=uid and archived_at is null for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then raise exception 'INVALID_IMPORT';end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    insert into questions(user_id,collection_id,title,content,category,pattern,source_url,metadata) values(uid,p_collection,r->>'title',coalesce(r->>'content',''),coalesce(r->>'category',''),coalesce(r->>'pattern',''),nullif(r->>'source_url',''),coalesce(r->'metadata','{}')) on conflict do nothing;
    get diagnostics n=row_count;inserted:=inserted+n;
  end loop;
  insert into audit_events(user_id,event_type,request_id,entity_type,entity_id,safe_metadata) values(uid,'questions.imported',p_request_id,'collection',p_collection,jsonb_build_object('inserted',inserted));
  return jsonb_build_object('inserted',inserted,'duplicates',jsonb_array_length(p_rows)-inserted,'errors','[]'::jsonb);
end $$;

create function public.delete_collection(p_collection uuid,p_request_id text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();
begin
  perform id from collections where id=p_collection and user_id=uid for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from practice_sessions where collection_id=p_collection) then raise exception 'HAS_HISTORY';end if;
  delete from collections where id=p_collection and user_id=uid;
  insert into audit_events(user_id,event_type,request_id,entity_type,entity_id) values(uid,'collection.deleted',p_request_id,'collection',p_collection);
  return true;
end $$;

revoke all on function public.create_practice_session(uuid,date,uuid[],text),public.rate_session_question(uuid,uuid,text,integer,text,jsonb,integer,text),public.complete_practice_session(uuid,text),public.import_questions(uuid,jsonb,text),public.delete_collection(uuid,text) from public;
grant execute on function public.create_practice_session(uuid,date,uuid[],text),public.rate_session_question(uuid,uuid,text,integer,text,jsonb,integer,text),public.complete_practice_session(uuid,text),public.import_questions(uuid,jsonb,text),public.delete_collection(uuid,text) to authenticated;

-- Public readiness exposes only schema presence, never application data.
create function public.application_ready() returns boolean language sql stable set search_path=public,pg_temp as $$
  select to_regclass('public.collections') is not null and to_regclass('public.question_attempts') is not null;
$$;
grant execute on function public.application_ready() to anon,authenticated;
