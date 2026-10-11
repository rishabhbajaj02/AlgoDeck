# Adaptive scheduling

The standalone TypeScript service accepts a collection policy, study date, existing progress, yesterday’s selected IDs, and a random number source. Tests inject a seeded generator; production uses random weighted sampling without replacement.

Eligibility and priority are separate. Unanswered/unseen questions have no implied rating. Previously rated questions must be due (`next_review_at <= study_date`). Yesterday’s selections are excluded even if overdue or unanswered. The selection loop limits unseen questions to `new_question_limit` and never repeats an ID. Skipped progress is not modified.

Both neighboring study dates are excluded when generating a session, including a tomorrow session already created before a timezone change. The database enforces this regardless of creation order and locks progress before checking eligibility, so a concurrent rating cannot make a selected question ineligible mid-transaction.

For rated questions:

```
weight = difficultyWeight
       * (1 + min(overdueDays, 30) / 4)
       * (1 + min(consecutiveHardRatings, 8) * 0.5)
       / (1 + consecutiveSuccesses * 0.15)
```

Difficulty weights: Hard 4, Medium 2, Easy 1. Unseen weight: 1. At each draw a ticket is sampled from the sum of eligible weights, which normalizes the probability to weight / total. Selected questions are removed before the next draw. When the unseen cap is met, remaining unseen questions leave the eligible pool.

Default intervals in days: Hard `[1,2,4,7]`, Medium `[3,5,10,20]`, Easy `[7,14,30,60]`. A Hard streak chooses the Hard stage. Consecutive Easy/Medium successes choose their rating’s stage. Stages cap at the last configured interval. Hard resets successes; success resets the difficult streak. Ease is bounded to 1.3–3.5 and retained for future policy versions.

Date arithmetic uses UTC calendar dates after deriving the study date from the browser IANA timezone. The API accepts a timezone, not an arbitrary session date. The persisted session date anchors ratings when resuming an old session; late completion may make its next review immediately overdue.

The session SQL function takes a collection row lock and a transaction advisory lock, checks ownership, eligibility, duplicate IDs and the new cap, and inserts the session plus ordered selections before returning. Competing calls return the first persisted session. The unique session constraint is a final guard.

Rating locks the session/selection/progress, returns an existing matching attempt on retries, rejects different details, checks expected attempt count, and atomically writes the attempt, progress, selection status and audit event. The SQL boundary independently checks the server's interval and counters. Attempts preserve policy version, prior progress and resulting schedule. This small duplication is deliberate protection against stale or forged RPC inputs, not a separate selection engine.

The browser freezes submitted time, notes and rating before saving. If a response is lost, it reads the persisted session; an uncertain retry reuses the exact payload.

These intervals are practical heuristics. They do not claim optimal retention or mastery measurement. Analytics success is explicitly an Easy/Medium self-rating.
