import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collectionSchema,
  defaultPolicy,
  type Collection,
  type CollectionInput,
} from "@algodeck/shared";
import { Button } from "../../components/ui";
export function CollectionForm({
  collection,
  onSave,
  pending,
}: {
  collection?: Collection;
  onSave: (data: CollectionInput) => Promise<unknown>;
  pending: boolean;
}) {
  const form = useForm<
    z.input<typeof collectionSchema>,
    unknown,
    CollectionInput
  >({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: collection?.name ?? "",
      description: collection?.description ?? "",
      daily_target: collection?.daily_target ?? 5,
      new_question_limit: collection?.new_question_limit ?? 3,
      review_policy: collection?.review_policy ?? defaultPolicy,
    },
  });
  return (
    <form
      className="stack-form"
      onSubmit={form.handleSubmit((data) => onSave(data))}
    >
      <label>
        Collection name
        <input
          autoFocus
          placeholder="e.g. Interview foundations"
          {...form.register("name")}
        />
      </label>
      {form.formState.errors.name && (
        <span className="field-error">
          {form.formState.errors.name.message}
        </span>
      )}
      <label>
        Description
        <textarea
          rows={3}
          placeholder="What are you working toward?"
          {...form.register("description")}
        />
      </label>
      <div className="form-grid">
        <label>
          Daily target
          <input
            type="number"
            min={1}
            max={50}
            {...form.register("daily_target", { valueAsNumber: true })}
          />
        </label>
        <label>
          New questions per day
          <input
            type="number"
            min={0}
            max={50}
            {...form.register("new_question_limit", { valueAsNumber: true })}
          />
        </label>
      </div>
      <p className="form-help">
        Up to this many new questions; remaining spots go to due reviews.
        Yesterday’s questions rest for a day.
      </p>
      {form.formState.errors.daily_target && (
        <span className="field-error">
          {form.formState.errors.daily_target.message}
        </span>
      )}
      {form.formState.errors.new_question_limit && (
        <span className="field-error">
          {form.formState.errors.new_question_limit.message}
        </span>
      )}
      <details className="policy-settings">
        <summary>Review intervals</summary>
        <p className="form-help">
          Days between reviews, from the first to subsequent reviews. Hard
          ratings reset the success streak.
        </p>
        {(["hard", "medium", "easy"] as const).map((r) => (
          <label key={r}>
            {r[0].toUpperCase() + r.slice(1)} intervals
            <input
              aria-label={`${r} review intervals`}
              defaultValue={(collection?.review_policy ?? defaultPolicy)[
                r
              ].join(", ")}
              onChange={(e) =>
                form.setValue(
                  `review_policy.${r}`,
                  e.target.value.split(",").map((v) => Number(v.trim())),
                  { shouldValidate: true },
                )
              }
            />
            {form.formState.errors.review_policy?.[r] && (
              <span className="field-error">
                Use 1–12 intervals, each between 1 and 365 days.
              </span>
            )}
          </label>
        ))}
      </details>
      <Button type="submit" disabled={pending || form.formState.isSubmitting}>
        {pending
          ? "Saving…"
          : collection
            ? "Save changes"
            : "Create collection"}
      </Button>
    </form>
  );
}
