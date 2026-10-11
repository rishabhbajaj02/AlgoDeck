import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Lightbulb,
  Eye,
  Timer,
  CheckCircle2,
  Pause,
  Play,
} from "lucide-react";
import type { PracticeSession, RatingInput } from "@algodeck/shared";
import { api } from "../../services/api";
import {
  Button,
  State,
  Badge,
  ProgressBar,
  ErrorMessage,
  shortDate,
} from "../../components/ui";
export function PracticePage() {
  const { sessionId } = useParams();
  const cache = useQueryClient();
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [hint, setHint] = useState(false);
  const [solution, setSolution] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [submitted, setSubmitted] = useState<Record<string, RatingInput>>({});
  const query = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api<PracticeSession>(`/sessions/${sessionId}`),
  });
  useEffect(() => {
    if (query.data && !initialized) {
      const pending = query.data.questions.findIndex(
        (q) => q.status === "pending",
      );
      setIndex(pending < 0 ? 0 : pending);
      setInitialized(true);
    }
  }, [query.data, initialized]);
  useEffect(() => {
    setNotes("");
    setSeconds(0);
    setRunning(false);
    setHint(false);
    setSolution(false);
  }, [index]);
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(
      () => setSeconds((s) => Math.min(86400, s + 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, [running]);
  const rating = useMutation({
    mutationFn: async ({
      questionId,
      input,
    }: {
      questionId: string;
      input: RatingInput;
    }) => {
      try {
        await api(`/sessions/${sessionId}/questions/${questionId}/rate`, {
          method: "POST",
          body: input,
        });
        return await api<PracticeSession>(`/sessions/${sessionId}`);
      } catch (error) {
        // The write may have committed even if its response was lost.
        const latest = await api<PracticeSession>(
          `/sessions/${sessionId}`,
        ).catch(() => null);
        if (
          latest?.questions.some(
            (q) => q.question_id === questionId && q.status === "completed",
          )
        )
          return latest;
        throw error;
      }
    },
    onSuccess: (latest, { questionId }) => {
      setSubmitted((previous) => {
        const next = { ...previous };
        delete next[questionId];
        return next;
      });
      cache.setQueryData(["session", sessionId], latest);
      void cache.invalidateQueries({ queryKey: ["dashboard"] });
      void cache.invalidateQueries({ queryKey: ["questions"] });
      void cache.invalidateQueries({ queryKey: ["revision"] });
      void cache.invalidateQueries({ queryKey: ["analytics"] });
      const next = latest.questions.findIndex(
        (q, i) => q.status === "pending" && i > index,
      );
      const any = latest.questions.findIndex((q) => q.status === "pending");
      if (next >= 0) setIndex(next);
      else if (any >= 0) setIndex(any);
    },
  });
  const complete = useMutation({
    mutationFn: () =>
      api<PracticeSession>(`/sessions/${sessionId}/complete`, {
        method: "POST",
        body: {},
      }),
    onSuccess: (s) => {
      cache.setQueryData(["session", sessionId], s);
      void cache.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  if (query.isPending) return <State loading />;
  if (query.error || !query.data) return <State error={query.error} />;
  const s = query.data;
  const done = s.questions.filter((q) => q.status === "completed").length;
  const allDone = done === s.questions.length;
  if (s.status === "completed")
    return (
      <section className="practice-summary panel">
        <CheckCircle2 size={48} />
        <h1>A little more learned.</h1>
        <p>
          {done} questions completed on {shortDate(s.session_date)}. Your next
          reviews are scheduled.
        </p>
        <div className="summary-ratings">
          {(["easy", "medium", "hard"] as const).map((r) => (
            <div key={r}>
              <strong>
                {s.questions.filter((q) => q.rating === r).length}
              </strong>
              <Badge tone={r}>{r}</Badge>
            </div>
          ))}
        </div>
        <Link className="button button-primary" to="/app">
          Back to overview <ArrowRight size={17} />
        </Link>
        <Link className="text-link" to={`/app/collections/${s.collection_id}`}>
          Browse your collection
        </Link>
      </section>
    );
  const selected = s.questions[index];
  const frozen = selected && submitted[selected.question_id];
  const q = selected?.question;
  const reveal = (key: string) =>
    typeof q?.metadata[key] === "string" ? String(q.metadata[key]) : null;
  return (
    <div className="practice-page">
      <Link className="back-link" to={`/app/collections/${s.collection_id}`}>
        <ArrowLeft size={15} />
        Back to collection
      </Link>
      <div className="practice-top">
        <div>
          <h1>Today’s practice</h1>
          <p>{shortDate(s.session_date)} · Focus on one question at a time.</p>
        </div>
        <span>
          {done} / {s.questions.length} complete
        </span>
      </div>
      <ProgressBar value={done} max={s.questions.length} />
      {s.explanation && <div className="notice">{s.explanation}</div>}
      <ErrorMessage error={rating.error || complete.error} />
      {q ? (
        <>
          <div className="question-navigation">
            {s.questions.map((sq, i) => (
              <button
                key={sq.id}
                aria-label={`Question ${i + 1}: ${sq.question.title}`}
                aria-current={i === index ? "step" : undefined}
                className={`${i === index ? "selected" : ""} ${sq.status === "completed" ? "answered" : ""}`}
                onClick={() => {
                  if (!rating.isPending) {
                    setIndex(i);
                    rating.reset();
                  }
                }}
              >
                {sq.status === "completed" ? <CheckCircle2 size={16} /> : i + 1}
              </button>
            ))}
          </div>
          <article className="practice-card panel">
            <div className="practice-card-top">
              <span>
                Question {index + 1} of {s.questions.length}
              </span>
              <div className="tags">
                {q.category && <Badge>{q.category}</Badge>}
                {q.pattern && <Badge>{q.pattern}</Badge>}
                {selected.status === "completed" && (
                  <Badge tone={selected.rating ?? "neutral"}>
                    Rated {selected.rating}
                  </Badge>
                )}
              </div>
            </div>
            <h2>{q.title}</h2>
            <p className="question-content">
              {q.content ||
                "Work through the question, then reflect on how it felt."}
            </p>
            {q.source_url && (
              <a
                className="button button-secondary source-button"
                href={q.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Open original problem <ExternalLink size={15} />
              </a>
            )}
            <div className="reveal-controls">
              {reveal("hint") && (
                <Button variant="ghost" onClick={() => setHint(!hint)}>
                  <Lightbulb size={17} />
                  {hint ? "Hide hint" : "Reveal hint"}
                </Button>
              )}
              {reveal("solution") && (
                <Button variant="ghost" onClick={() => setSolution(!solution)}>
                  <Eye size={17} />
                  {solution ? "Hide solution" : "Reveal solution"}
                </Button>
              )}
            </div>
            {hint && (
              <div className="reveal-box">
                <strong>Hint</strong>
                <p>{reveal("hint")}</p>
              </div>
            )}
            {solution && (
              <div className="reveal-box">
                <strong>Solution</strong>
                <p>{reveal("solution")}</p>
              </div>
            )}
            <div className="practice-reflection">
              <div className="timer-row">
                <span>
                  <Timer size={16} />
                  Time spent
                </span>
                <div>
                  <input
                    aria-label="Time spent in seconds"
                    type="number"
                    min={0}
                    max={86400}
                    value={frozen?.time_spent_seconds ?? seconds}
                    onChange={(e) =>
                      setSeconds(
                        Math.max(0, Math.min(86400, Number(e.target.value))),
                      )
                    }
                    disabled={selected.status === "completed" || !!frozen}
                  />
                  <span>seconds</span>
                  <button
                    className="icon-button"
                    aria-label={running ? "Pause timer" : "Start timer"}
                    disabled={selected.status === "completed" || !!frozen}
                    onClick={() => setRunning(!running)}
                  >
                    {running ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                </div>
              </div>
              <label>
                Practice notes <span className="muted">(optional)</span>
                <textarea
                  rows={3}
                  maxLength={4000}
                  placeholder="A useful insight, a sticking point, something to revisit…"
                  value={frozen ? (frozen.notes ?? "") : notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={selected.status === "completed" || !!frozen}
                />
              </label>
            </div>
            <div className="rating-section">
              <h3>How did that feel?</h3>
              <p>
                Completing a question saves your rating and schedules its next
                review.
              </p>
              <div className="rating-buttons">
                {(
                  [
                    {
                      rating: "hard",
                      title: "Hard",
                      description: "I need another pass",
                    },
                    {
                      rating: "medium",
                      title: "Medium",
                      description: "A little effort helped",
                    },
                    {
                      rating: "easy",
                      title: "Easy",
                      description: "I’ve got this",
                    },
                  ] as const
                ).map(({ rating: r, title, description }) => (
                  <button
                    className={`rating-button rating-${r}`}
                    key={r}
                    disabled={
                      selected.status === "completed" ||
                      rating.isPending ||
                      (!!frozen && frozen.rating !== r)
                    }
                    onClick={() => {
                      setRunning(false);
                      const input = frozen ?? {
                        rating: r,
                        time_spent_seconds: seconds,
                        notes: notes || null,
                      };
                      setSubmitted((previous) => ({
                        ...previous,
                        [selected.question_id]: input,
                      }));
                      rating.mutate({
                        questionId: selected.question_id,
                        input,
                      });
                    }}
                  >
                    <strong>
                      {frozen?.rating === r && !rating.isPending
                        ? `Retry ${title}`
                        : title}
                    </strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
            </div>
          </article>
          <div className="practice-bottom">
            <Button
              variant="secondary"
              aria-label="Previous question"
              disabled={index === 0 || rating.isPending}
              onClick={() => setIndex(index - 1)}
            >
              <ArrowLeft size={16} />
              Previous
            </Button>
            <span>
              {rating.isPending
                ? "Saving your progress…"
                : selected.status === "completed"
                  ? "Rating saved"
                  : "Your progress saves after each rating"}
            </span>
            <Button
              variant="secondary"
              aria-label="Next question"
              disabled={index === s.questions.length - 1 || rating.isPending}
              onClick={() => setIndex(index + 1)}
            >
              Next
              <ArrowRight size={16} />
            </Button>
          </div>
        </>
      ) : (
        <State
          empty
          message="No eligible questions today. Add more questions or return after their rest day."
        />
      )}
      {allDone && (
        <div className="finish-session panel">
          <CheckCircle2 size={24} />
          <div>
            <h3>
              {s.questions.length
                ? "You’ve worked through your session."
                : "Today’s session is empty."}
            </h3>
            <p>
              {s.questions.length
                ? "Finish to see your summary."
                : "Finish this session and build your collection for the next study day."}
            </p>
          </div>
          <Button
            disabled={complete.isPending}
            onClick={() => complete.mutate()}
          >
            {complete.isPending ? "Finishing…" : "Finish session"}
          </Button>
        </div>
      )}
    </div>
  );
}
