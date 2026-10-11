import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle, AlertCircle, Inbox } from "lucide-react";
import { clsx } from "clsx";
import type { ReactNode, ButtonHTMLAttributes } from "react";
export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={clsx("button", `button-${variant}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function State({
  loading,
  error,
  empty,
  message,
  action,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={clsx("state", loading && "state-loading")}
      role={error ? "alert" : undefined}
    >
      {loading ? (
        <>
          <LoaderCircle className="spin" size={26} />
          <p>Loading your workspace…</p>
        </>
      ) : (
        <>
          {error ? (
            <AlertCircle size={28} />
          ) : empty ? (
            <Inbox size={32} />
          ) : null}
          <p>
            {message ??
              (error instanceof Error
                ? error.message
                : "Unable to load this page. Try again.")}
          </p>
          {action}
        </>
      )}
    </div>
  );
}
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="error-message" role="alert">
      <AlertCircle size={18} />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={description ? "muted" : "sr-only"}>
            {description ?? title}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max ? Math.round((100 * value) / max) : 0;
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label="Practice progress"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}
export function shortDate(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric" },
  );
}
