import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportReport } from "@algodeck/shared";
import { importSchema } from "@algodeck/shared";
import { api, ApiError } from "../../services/api";
import { Modal, Button, ErrorMessage } from "../../components/ui";
export function ImportDialog({
  collectionId,
  open,
  onOpenChange,
}: {
  collectionId: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [content, setContent] = useState("");
  const [validation, setValidation] = useState("");
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api<ImportReport>(`/collections/${collectionId}/import`, {
        method: "POST",
        body: { format, content },
      }),
    onSuccess: () => {
      void cache.invalidateQueries();
    },
  });
  const errors =
    mutation.error instanceof ApiError && Array.isArray(mutation.error.details)
      ? (mutation.error.details as { row: number; message: string }[])
      : [];
  function validate() {
    setValidation("");
    const result = importSchema.safeParse({ format, content });
    if (!result.success) {
      setValidation(result.error.issues[0].message);
      return false;
    }
    if (format === "json") {
      try {
        const data = JSON.parse(content);
        if (!Array.isArray(data) && !Array.isArray(data?.questions)) {
          setValidation(
            "Use a JSON array or an object with a questions array.",
          );
          return false;
        }
      } catch {
        setValidation("Enter valid JSON before importing.");
        return false;
      }
    }
    return true;
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Import questions"
      description="Paste a list or choose a CSV/JSON file. Up to 1 MB and 1,000 rows."
    >
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.reset();
          if (validate()) mutation.mutate();
        }}
      >
        <div className="form-grid">
          <label>
            Import format
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as "csv" | "json");
                mutation.reset();
              }}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label>
            Choose file
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1_000_000) {
                  setValidation("File exceeds 1 MB.");
                  return;
                }
                if (!/\.(csv|json)$/i.test(file.name)) {
                  setValidation("Choose a CSV or JSON file.");
                  return;
                }
                setFormat(
                  file.name.toLowerCase().endsWith(".json") ? "json" : "csv",
                );
                setContent(await file.text());
                setValidation("");
                mutation.reset();
              }}
            />
          </label>
        </div>
        <label>
          Question data
          <textarea
            className="code-input"
            rows={9}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              mutation.reset();
            }}
            placeholder={
              format === "csv"
                ? "title,content,category,pattern,source_url\nTwo sum,Find a pair,Algorithms,Hash map,"
                : '[{"title":"Bonjour","content":"Translate this word","category":"French","metadata":{"solution":"Hello"}}]'
            }
          />
        </label>
        <p className="form-help">
          Title is required. Repeated titles in the same category and pattern
          are skipped. Invalid rows prevent the whole import.
        </p>
        <ErrorMessage error={validation || mutation.error} />
        {errors.length > 0 && (
          <ul className="import-errors">
            {errors.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        )}
        {mutation.data && (
          <div className="notice" role="status">
            Imported {mutation.data.inserted} questions; skipped{" "}
            {mutation.data.duplicates} duplicates.
          </div>
        )}
        <div className="form-actions">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Importing…" : "Import questions"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </form>
    </Modal>
  );
}
