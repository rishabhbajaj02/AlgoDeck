-- No fabricated auth users: seed for an existing local development account only.
-- Set request.jwt.claim.sub to its UUID in a SQL transaction before running this file.
do $$ declare uid uuid:=auth.uid();cid uuid;i integer;
begin
  if uid is null then raise notice 'No seed user configured. Use npm run db:seed after creating a local account.'; return;end if;
  if exists(select 1 from public.collections where user_id=uid and name='Interview foundations') then return;end if;
  insert into public.collections(user_id,name,description,daily_target,new_question_limit) values(uid,'Interview foundations','A starter set for building a steady practice habit.',5,5) returning id into cid;
  for i in 1..12 loop
    insert into public.questions(user_id,collection_id,title,content,category,pattern,metadata) values(uid,cid,
      (array['Two sum','Longest unique substring','Merge intervals','Tree traversal','Shortest path','Topological sorting','Coin change','Cache design','Rate limiter design','Database indexing','Concurrency fundamentals','Explain a technical tradeoff'])[i],
      (array['Find two values that add to a target. Explain complexity.','Find the longest substring without repeated characters.','Merge all overlapping intervals.','Compare breadth-first and depth-first traversal.','Find the shortest path in an unweighted graph.','Order dependent tasks and detect cycles.','Find the minimum coins needed for a total.','Design a cache with eviction and consistency.','Design a distributed rate limiter.','Explain when an index helps or hurts.','Describe races, atomicity and safe concurrency.','Describe a tradeoff you made and how you validated it.'])[i],
      case when i<=7 then 'Algorithms' when i<=10 then 'System design' else 'Fundamentals' end,
      (array['Hash map','Sliding window','Intervals','Trees','Graphs','Graphs','Dynamic programming','Caching','Distributed systems','Storage','Concurrency','Communication'])[i],
      jsonb_build_object('hint','Start with the simplest solution, then identify the bottleneck.'));
  end loop;
end $$;
