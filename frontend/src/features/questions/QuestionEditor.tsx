import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  questionSchema,
  type Question,
  type QuestionInput,
} from "@algodeck/shared";
import { useState } from "react";
import { Button, ErrorMessage } from "../../components/ui";
export function QuestionEditor({
  question,
  onSave,
  pending,
}: {
  question?: Question;
  onSave: (data: QuestionInput) => Promise<unknown>;
  pending: boolean;
}) {
  const [metadata, setMetadata] = useState(
    JSON.stringify(question?.metadata ?? {}, null, 2),
  );
  const [metaError, setMetaError] = useState("");
  const form = useForm<z.input<typeof questionSchema>, unknown, QuestionInput>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      title: question?.title ?? "",
      content: question?.content ?? "",
      category: question?.category ?? "",
      pattern: question?.pattern ?? "",
      source_url: question?.source_url ?? "",
      metadata: question?.metadata ?? {},
    },
  });
  return (
    <form
      className="stack-form"
      onSubmit={(e) => {
        e.preventDefault();
        setMetaError("");
        try {
          const value: unknown = JSON.parse(metadata);
          if (
            typeof value !== "object" ||
            value === null ||
            Array.isArray(value)
          )
            throw new Error("Metadata must be a JSON object.");
          form.setValue("metadata", value as Record<string, unknown>);
          void form.handleSubmit(onSave)(e);
        } catch {
          setMetaError("Metadata must be a valid JSON object.");
        }
      }}
    >
      <label>
        Question title
        <input autoFocus {...form.register("title")} />
      </label>
      <label>
        Question content
        <textarea rows={5} {...form.register("content")} />
      </label>
      <div className="form-grid">
        <label>
          Category
          <input placeholder="e.g. Algorithms" {...form.register("category")} />
        </label>
        <label>
          Pattern
          <input
            placeholder="e.g. Sliding window"
            {...form.register("pattern")}
          />
        </label>
      </div>
      <label>
        Original problem URL
        <input
          type="url"
          placeholder="https://…"
          {...form.register("source_url")}
        />
      </label>
      <details>
        <summary>Hints, solutions & custom fields</summary>
        <p className="form-help">
          Use JSON fields such as "hint" and "solution". Other custom fields are
          preserved.
        </p>
        <label>
          Question metadata
          <textarea
            rows={6}
            className="code-input"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
          />
        </label>
      </details>
      {Object.values(form.formState.errors).map((e, i) => (
        <span className="field-error" key={i}>
          {typeof e.message === "string" ? e.message : "Check this field."}
        </span>
      ))}
      <ErrorMessage error={metaError} />
      <Button disabled={pending} type="submit">
        {pending ? "Saving…" : question ? "Save question" : "Add question"}
      </Button>
    </form>
  );
}
