import { useQuery } from "@tanstack/react-query";
import type { Question, Attempt, Page } from "@algodeck/shared";
import { api } from "../../services/api";
import { Modal, State, Badge, shortDate, Button } from "../../components/ui";
import { useState } from "react";
export function QuestionDetail({
  question,
  onOpenChange,
}: {
  question: Question | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ["history", question?.id, page],
    queryFn: () =>
      api<Page<Attempt>>(
        `/questions/${question!.id}/history?page=${page}&page_size=10`,
      ),
    enabled: !!question,
  });
  return (
    <Modal
      open={!!question}
      onOpenChange={onOpenChange}
      title={question?.title ?? "Question details"}
    >
      {question && (
        <>
          <div className="tags">
            <Badge>{question.category || "General"}</Badge>
            {question.pattern && <Badge>{question.pattern}</Badge>}
          </div>
          <p className="question-content">
            {question.content || "No additional content."}
          </p>
          {question.source_url && (
            <a
              className="text-link"
              href={question.source_url}
              target="_blank"
              rel="noreferrer"
            >
              Open original problem ↗
            </a>
          )}
          <div className="detail-stats">
            <span>
              Attempts <strong>{question.progress?.total_attempts ?? 0}</strong>
            </span>
            <span>
              Next review{" "}
              <strong>
                {question.progress?.next_review_at
                  ? shortDate(question.progress.next_review_at)
                  : "After first practice"}
              </strong>
            </span>
          </div>
          <h3>Attempt history</h3>
          {history.isPending ? (
            <State loading />
          ) : history.error ? (
            <State error={history.error} />
          ) : !history.data?.items.length ? (
            <State empty message="Your first attempt will appear here." />
          ) : (
            <>
              <div className="history-list">
                {history.data.items.map((a) => (
                  <article key={a.id}>
                    <div>
                      <Badge tone={a.rating}>{a.rating}</Badge>
                      <span>{shortDate(a.attempted_at)}</span>
                      {a.time_spent_seconds !== null && (
                        <small>{a.time_spent_seconds}s</small>
                      )}
                    </div>
                    {a.notes && <p>{a.notes}</p>}
                  </article>
                ))}
              </div>
              <div className="pagination">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>Page {page}</span>
                <Button
                  variant="secondary"
                  disabled={page * 10 >= history.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
