import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Upload,
  Download,
  Play,
  Search,
  Settings2,
  Pencil,
  Trash2,
  Archive,
  ArrowLeft,
} from "lucide-react";
import type {
  Collection,
  Question,
  QuestionInput,
  CollectionInput,
  Page,
  PracticeSession,
} from "@algodeck/shared";
import { api, withTimezone, timezone } from "../../services/api";
import {
  Button,
  PageHeading,
  State,
  Modal,
  ErrorMessage,
  Badge,
  shortDate,
} from "../../components/ui";
import { CollectionForm } from "./CollectionForm";
import { QuestionEditor } from "../questions/QuestionEditor";
import { ImportDialog } from "../questions/ImportDialog";
import { QuestionDetail } from "../questions/QuestionDetail";
export function CollectionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [pattern, setPattern] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Question | undefined>();
  const [editor, setEditor] = useState(false);
  const [settings, setSettings] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detail, setDetail] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [deleteCollection, setDeleteCollection] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const collection = useQuery({
    queryKey: ["collection", id],
    queryFn: () => api<Collection>(`/collections/${id}`),
  });
  const query = useQuery({
    queryKey: ["questions", id, search, category, pattern, status, page],
    queryFn: () =>
      api<Page<Question>>(
        withTimezone(
          `/collections/${id}/questions?${new URLSearchParams({ search, category, pattern, status, page: String(page), page_size: "20" })}`,
        ),
      ),
  });
  const options = useQuery({
    queryKey: ["question-options", id],
    queryFn: () =>
      api<Page<Question>>(
        withTimezone(`/collections/${id}/questions?page_size=100`),
      ),
  });
  const start = useMutation({
    mutationFn: () =>
      api<PracticeSession>(`/collections/${id}/sessions`, {
        method: "POST",
        body: { timezone },
      }),
    onSuccess: (s) => {
      void cache.invalidateQueries();
      navigate(`/app/practice/${s.id}`);
    },
  });
  const save = useMutation({
    mutationFn: (input: QuestionInput) =>
      api(
        editing ? `/questions/${editing.id}` : `/collections/${id}/questions`,
        { method: editing ? "PATCH" : "POST", body: input },
      ),
    onSuccess: () => {
      void cache.invalidateQueries();
      setEditor(false);
    },
  });
  const saveSettings = useMutation({
    mutationFn: (input: CollectionInput) =>
      api(`/collections/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void cache.invalidateQueries();
      setSettings(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/questions/${deleting!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void cache.invalidateQueries();
      setDeleting(null);
    },
  });
  const archive = useMutation({
    mutationFn: () =>
      api(`/collections/${id}`, {
        method: "PATCH",
        body: {
          archived_at: collection.data?.archived_at
            ? null
            : new Date().toISOString(),
        },
      }),
    onSuccess: () => {
      void cache.invalidateQueries();
    },
  });
  const removeCollection = useMutation({
    mutationFn: () => api(`/collections/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void cache.invalidateQueries();
      navigate("/app/collections");
    },
  });
  async function exportQuestions() {
    try {
      setActionError(null);
      const exported = await api(`/collections/${id}/export`);
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "algodeck-collection.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setActionError(e);
    }
  }
  if (collection.isPending) return <State loading />;
  if (collection.error || !collection.data)
    return <State error={collection.error} />;
  const c = collection.data;
  const filter = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <Link className="back-link" to="/app/collections">
        <ArrowLeft size={15} />
        Collections
      </Link>
      <PageHeading
        title={c.name}
        description={
          c.description ||
          "Your question bank, ready for a little daily practice."
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setSettings(true)}>
              <Settings2 size={16} />
              Settings
            </Button>
            <Button
              disabled={start.isPending || !!c.archived_at}
              onClick={() => start.mutate()}
            >
              <Play size={16} />
              {start.isPending ? "Preparing…" : "Start daily practice"}
            </Button>
          </>
        }
      />
      {c.archived_at && (
        <div className="notice">
          This collection is archived. Restore it in settings to continue
          practicing.
        </div>
      )}
      <ErrorMessage error={start.error || actionError || archive.error} />
      <div className="bank-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search questions"
            placeholder="Search your questions…"
            value={search}
            onChange={(e) => filter(setSearch, e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <Button
            variant="secondary"
            onClick={() => setImporting(true)}
            disabled={!!c.archived_at}
          >
            <Upload size={16} />
            Import
          </Button>
          <Button variant="secondary" onClick={() => void exportQuestions()}>
            <Download size={16} />
            Export
          </Button>
          <Button
            onClick={() => {
              setEditing(undefined);
              save.reset();
              setEditor(true);
            }}
            disabled={!!c.archived_at}
          >
            <Plus size={16} />
            Add question
          </Button>
        </div>
      </div>
      <div className="filters">
        <select
          aria-label="Filter category"
          value={category}
          onChange={(e) => filter(setCategory, e.target.value)}
        >
          <option value="">All categories</option>
          {Object.entries(options.data?.facets?.categories ?? {}).filter(([name])=>name).map(([name,count])=><option key={name} value={name}>{name} ({count})</option>)}
        </select>
        <select
          aria-label="Filter pattern"
          value={pattern}
          onChange={(e) => filter(setPattern, e.target.value)}
        >
          <option value="">All patterns</option>
          {Object.entries(options.data?.facets?.patterns ?? {}).filter(([name])=>name).map(([name,count])=><option key={name} value={name}>{name} ({count})</option>)}
        </select>
        <select
          aria-label="Filter review status"
          value={status}
          onChange={(e) => filter(setStatus, e.target.value)}
        >
          <option value="">All review statuses</option>
          <option value="unseen">New ({options.data?.facets?.statuses.unseen ?? 0})</option>
          <option value="due">Due today ({options.data?.facets?.statuses.due ?? 0})</option>
          <option value="overdue">Overdue ({options.data?.facets?.statuses.overdue ?? 0})</option>
          <option value="upcoming">Upcoming ({options.data?.facets?.statuses.upcoming ?? 0})</option>
        </select>
        <span className="muted">{query.data?.total ?? 0} questions</span>
      </div>
      {query.isPending ? (
        <State loading />
      ) : query.error ? (
        <State error={query.error} />
      ) : !query.data?.items.length ? (
        <State
          empty
          message={
            search || category || pattern || status
              ? "No questions match these filters."
              : "Add your first question or import a list to begin."
          }
        />
      ) : (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Category / pattern</th>
                <th>Last rating</th>
                <th>Next review</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((q) => (
                <tr key={q.id}>
                  <td>
                    <button
                      className="question-link"
                      onClick={() => setDetail(q)}
                    >
                      {q.title}
                    </button>
                    <small>{q.progress?.total_attempts ?? 0} attempts</small>
                  </td>
                  <td>
                    <span>{q.category || "General"}</span>
                    <small>{q.pattern || "—"}</small>
                  </td>
                  <td>
                    {q.progress?.last_rating ? (
                      <Badge tone={q.progress.last_rating}>
                        {q.progress.last_rating}
                      </Badge>
                    ) : (
                      <Badge>New</Badge>
                    )}
                  </td>
                  <td>
                    {q.progress?.next_review_at
                      ? shortDate(q.progress.next_review_at)
                      : "Not practiced"}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit ${q.title}`}
                        onClick={() => {
                          setEditing(q);
                          save.reset();
                          setEditor(true);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${q.title}`}
                        onClick={() => {
                          setDeleting(q);
                          remove.reset();
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              disabled={page * 20 >= query.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      <Modal
        open={editor}
        onOpenChange={setEditor}
        title={editing ? "Edit question" : "Add a question"}
      >
        <QuestionEditor
          key={editing?.id ?? "new"}
          question={editing}
          pending={save.isPending}
          onSave={async (data) => {
            await save.mutateAsync(data).catch(() => {});
          }}
        />
        <ErrorMessage error={save.error} />
      </Modal>
      <Modal
        open={settings}
        onOpenChange={setSettings}
        title="Collection settings"
      >
        <CollectionForm
          collection={c}
          pending={saveSettings.isPending}
          onSave={async (data) => {
            await saveSettings.mutateAsync(data).catch(() => {});
          }}
        />
        <ErrorMessage error={saveSettings.error} />
        <div className="danger-zone">
          <Button
            variant="secondary"
            disabled={archive.isPending}
            onClick={() => archive.mutate()}
          >
            <Archive size={16} />
            {c.archived_at ? "Restore collection" : "Archive collection"}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setSettings(false);
              setDeleteCollection(true);
              removeCollection.reset();
            }}
          >
            Delete collection
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Delete this question?"
        description="It will leave the question bank and future sessions. Its attempts and existing sessions are preserved."
      >
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          Delete question
        </Button>
        <ErrorMessage error={remove.error} />
      </Modal>
      <Modal
        open={deleteCollection}
        onOpenChange={setDeleteCollection}
        title="Delete this collection?"
        description="This permanently removes an unpracticed collection and its questions. Collections with practice history must be archived instead."
      >
        <Button
          variant="danger"
          disabled={removeCollection.isPending}
          onClick={() => removeCollection.mutate()}
        >
          Delete permanently
        </Button>
        <ErrorMessage error={removeCollection.error} />
      </Modal>
      <ImportDialog
        key={importing ? "open" : "closed"}
        collectionId={id!}
        open={importing}
        onOpenChange={setImporting}
      />
      <QuestionDetail
        key={detail?.id ?? "none"}
        question={detail}
        onOpenChange={() => setDetail(null)}
      />
    </>
  );
}
