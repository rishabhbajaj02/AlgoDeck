import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, ArrowUpRight, Library, Settings2, Archive } from "lucide-react";
import type { Collection, CollectionInput } from "@algodeck/shared";
import { api } from "../../services/api";
import {
  Button,
  PageHeading,
  State,
  Modal,
  ErrorMessage,
  Badge,
} from "../../components/ui";
import { CollectionForm } from "./CollectionForm";
export function CollectionCard({
  collection,
  onEdit,
}: {
  collection: Collection;
  onEdit?: () => void;
}) {
  return (
    <article className="collection-card panel">
      <div className="collection-icon">
        <Library size={23} />
      </div>
      <div className="collection-card-heading">
        <Link to={`/app/collections/${collection.id}`}>
          <h3>{collection.name}</h3>
        </Link>
        {onEdit && (
          <button
            className="icon-button"
            aria-label={`Edit ${collection.name}`}
            onClick={onEdit}
          >
            <Settings2 size={17} />
          </button>
        )}
      </div>
      <p>{collection.description || "A space for your next learning goal."}</p>
      <div className="collection-meta">
        <span>{collection.daily_target} questions / day</span>
        {collection.archived_at && <Badge>Archived</Badge>}
      </div>
      <Link className="text-link" to={`/app/collections/${collection.id}`}>
        Open collection <ArrowUpRight size={15} />
      </Link>
    </article>
  );
}
export function CollectionsPage() {
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Collection>();
  const [archived, setArchived] = useState(false);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["collections", archived],
    queryFn: () => api<Collection[]>(`/collections?archived=${archived}`),
  });
  const save = useMutation({
    mutationFn: (data: CollectionInput) =>
      api(selected ? `/collections/${selected.id}` : "/collections", {
        method: selected ? "PATCH" : "POST",
        body: data,
      }),
    onSuccess: () => {
      void cache.invalidateQueries();
      setModal(false);
    },
  });
  return (
    <>
      <PageHeading
        title="Your collections"
        description="A place for everything you want to get better at."
        actions={
          <Button
            onClick={() => {
              setSelected(undefined);
              save.reset();
              setModal(true);
            }}
          >
            <Plus size={18} />
            New collection
          </Button>
        }
      />
      <div className="toolbar">
        <span className="muted">{query.data?.length ?? 0} collections</span>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          <Archive size={16} />
          Include archived
        </label>
      </div>
      {query.isPending ? (
        <State loading />
      ) : query.error ? (
        <State
          error={query.error}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
      ) : query.data?.length ? (
        <div className="collection-grid">
          {query.data.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              onEdit={() => {
                setSelected(c);
                save.reset();
                setModal(true);
              }}
            />
          ))}
        </div>
      ) : (
        <State
          empty
          message="Create your first collection, then add the questions you want to practice."
          action={
            <Button
              onClick={() => {
                setSelected(undefined);
                setModal(true);
              }}
            >
              Create a collection
            </Button>
          }
        />
      )}
      <Modal
        open={modal}
        onOpenChange={setModal}
        title={selected ? "Edit collection" : "Create a collection"}
        description="Choose a daily pace you can come back to."
      >
        <CollectionForm
          key={selected?.id ?? "new"}
          collection={selected}
          onSave={async (data) => {
            await save.mutateAsync(data).catch(() => {});
          }}
          pending={save.isPending}
        />
        <ErrorMessage error={save.error} />
      </Modal>
    </>
  );
}
