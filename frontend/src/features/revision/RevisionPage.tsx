import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Play, Repeat2, ArrowUpRight } from "lucide-react";
import type {
  ReviewQuestion,
  PracticeSession,
  Page,
  Question,
} from "@algodeck/shared";
import { useCollectionSelection } from "../../hooks/useCollectionSelection";
import { api, timezone, withTimezone } from "../../services/api";
import {
  PageHeading,
  Button,
  State,
  ErrorMessage,
  Badge,
  shortDate,
} from "../../components/ui";
import { QuestionDetail } from "../questions/QuestionDetail";
export function RevisionPage() {
  const selection = useCollectionSelection();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<Question | null>(null);
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["revision", selection.id, page, filter],
    queryFn: () =>
      api<Page<ReviewQuestion>>(
        withTimezone(
          `/collections/${selection.id}/revision-queue?page=${page}&page_size=50${filter === "all" ? "" : `&status=${filter}`}`,
        ),
      ),
    enabled: !!selection.id,
  });
  const start = useMutation({
    mutationFn: () =>
      api<PracticeSession>(`/collections/${selection.id}/sessions`, {
        method: "POST",
        body: { timezone },
      }),
    onSuccess: (s) => navigate(`/app/practice/${s.id}`),
  });
  return (
    <>
      <PageHeading
        title="A second look"
        description="Revisit the questions that need a little more time."
        actions={
          selection.id && (
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              <Play size={16} />
              Start daily practice
            </Button>
          )
        }
      />
      <ErrorMessage error={start.error} />
      {selection.collections.isPending ? (
        <State loading />
      ) : selection.collections.error ? (
        <State error={selection.collections.error} />
      ) : !selection.id ? (
        <State
          empty
          message="Create a collection to start building your revision queue."
          action={
            <Link className="button button-primary" to="/app/collections">
              Create collection
            </Link>
          }
        />
      ) : (
        <>
          <div className="toolbar">
            <select
              aria-label="Choose collection"
              value={selection.id}
              onChange={(e) => {
                selection.setId(e.target.value);
                setPage(1);
              }}
            >
              {selection.collections.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="segmented" aria-label="Review status filter">
              {["all", "overdue", "due", "upcoming", "unseen"].map((v) => (
                <button
                  className={filter === v ? "active" : ""}
                  key={v}
                  onClick={() => {setFilter(v);setPage(1);}}
                >
                  {v === "all"
                    ? "All"
                    : v === "unseen"
                      ? "New"
                      : v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="notice revision-explanation">
            <Repeat2 size={19} />
            <span>
              Due dates decide eligibility. Priority helps decide which eligible
              questions appear. Yesterday’s questions rest for one day.
            </span>
          </div>
          {query.isPending ? (
            <State loading />
          ) : query.error ? (
            <State error={query.error} />
          ) : !query.data?.items.length ? (
            <State
              empty
              message={filter === "all" ? "Add questions to this collection to build your revision queue." : "No questions match this review status."}
            />
          ) : (
            <>
              <div className="revision-list">
                {query.data.items
                  .filter((q) => filter === "all" || q.review_status === filter)
                  .map((q) => (
                    <article className="panel revision-card" key={q.id}>
                      <div className="revision-card-main">
                        <Badge
                          tone={
                            q.review_status === "overdue"
                              ? "hard"
                              : q.review_status === "due"
                                ? "blue"
                                : "neutral"
                          }
                        >
                          {q.review_status === "unseen"
                            ? "New"
                            : q.review_status}
                        </Badge>
                        <button
                          className="question-link"
                          onClick={() => setDetail(q)}
                        >
                          {q.title}
                          <ArrowUpRight size={15} />
                        </button>
                        <p>{q.reason}</p>
                        <div className="tags">
                          <span>{q.category || "General"}</span>
                          {q.progress?.last_rating && (
                            <Badge tone={q.progress.last_rating}>
                              {q.progress.last_rating}
                            </Badge>
                          )}
                          {q.excluded_yesterday && <Badge>Resting today</Badge>}
                        </div>
                      </div>
                      <div className="revision-priority">
                        <strong>{q.weight.toFixed(2)}</strong>
                        <span>Selection weight</span>
                        <small>
                          {q.progress?.next_review_at
                            ? shortDate(q.progress.next_review_at)
                            : "Not practiced"}
                        </small>
                      </div>
                    </article>
                  ))}
              </div>
              {query.data.items.every(
                (q) => filter !== "all" && q.review_status !== filter,
              ) && (
                <State
                  empty
                  message="No questions match this status on the current page."
                />
              )}
              <div className="pagination">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {page} · {query.data.total} questions
                </span>
                <Button
                  variant="secondary"
                  disabled={page * 50 >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </>
      )}
      <QuestionDetail
        key={detail?.id ?? "none"}
        question={detail}
        onOpenChange={() => setDetail(null)}
      />
    </>
  );
}
