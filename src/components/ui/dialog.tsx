"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";
import { Button, IconButton } from "./button";

/* ═══════════════════════════════════════════════════════════════════════════
   Dialogs and drawers, built on the native <dialog> element.

   Using `showModal()` rather than a hand-rolled overlay gives us, from the
   platform:
     • a real focus trap
     • Escape-to-close
     • the top layer, so no z-index fights
     • `aria-modal` semantics and inert background content
     • focus restored to the invoking element on close

   What still has to be done by hand, and is done below:
     • locking body scroll (Safari and Chrome differ on this)
     • closing on a backdrop click without swallowing clicks inside the panel
     • labelling the dialog via aria-labelledby
   ═══════════════════════════════════════════════════════════════════════════ */

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    // Compensate for the scrollbar so locking does not shift the layout — this
    // is the source of the "page jumps when a modal opens" bug.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [locked]);
}

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Localised label for the close control. */
  closeLabel: string;
  /** Rendered in the footer, typically action buttons. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Panel slides in from the side instead of appearing centred. */
  variant?: "modal" | "drawer";
  children?: ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  footer,
  size = "md",
  variant = "modal",
  children,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useBodyScrollLock(open);

  // Drive the native element from the `open` prop.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The platform fires `cancel` for Escape; keep React state in sync rather than
  // letting the DOM and the state diverge.
  const handleCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  /**
   * Backdrop click. The `::backdrop` pseudo-element is not an event target, so
   * clicks on it land on the <dialog> itself. Comparing `event.target` to the
   * dialog distinguishes "clicked the backdrop" from "clicked inside the panel".
   */
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === ref.current) onClose();
    },
    [onClose],
  );

  const sizes = {
    sm: "sm:max-w-md",
    md: "sm:max-w-xl",
    lg: "sm:max-w-3xl",
  } as const;

  return (
    <dialog
      ref={ref}
      onCancel={handleCancel}
      onClick={handleClick}
      onClose={() => {
        if (open) onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        "backdrop:bg-black/50 backdrop:backdrop-blur-[1px]",
        "m-0 max-h-none max-w-none bg-transparent p-0",
        /*
         * `hidden` plus an `open:` display is load-bearing, not cosmetic.
         *
         * A closed <dialog> is `display: none` only because the UA stylesheet
         * says so, and any `display` utility of our own overrides it. The modal
         * variant previously carried a bare `grid`, so every closed dialog stayed
         * laid out at `fixed inset-0 h-full w-full` — an invisible full-viewport
         * layer that swallowed every click on the page behind it. On
         * /admin/projects that made the row action buttons unclickable, which is
         * how Playwright found it ("<dialog …> from <tr> subtree intercepts
         * pointer events").
         *
         * `hidden` restores display:none while closed; `open:grid` / `open:block`
         * have higher specificity and win once the element is open.
         */
        "hidden",
        variant === "modal"
          ? "fixed inset-0 open:grid h-full w-full place-items-center sm:p-4"
          : "fixed inset-y-0 right-0 h-full w-full open:block sm:w-[26rem]",
        "open:animate-in",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden bg-surface text-foreground",
          variant === "modal"
            ? cn(
                "h-full max-h-full rounded-none",
                "sm:h-auto sm:max-h-[min(90vh,44rem)] sm:rounded-[--radius-lg]",
                sizes[size],
              )
            : "h-full",
          "border border-border shadow-[--shadow-lg]",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-h4 font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-small text-foreground-muted">
                {description}
              </p>
            ) : null}
          </div>

          <IconButton
            icon="close"
            label={closeLabel}
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap justify-end gap-3 border-t border-border bg-surface-muted/50 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Confirmation dialog for destructive actions.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  tone?: "danger" | "primary";
  /**
   * When set, the user must type this exact string to enable the confirm
   * button. Reserved for irreversible actions — it turns a reflexive click into
   * a deliberate one.
   */
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  tone = "danger",
  confirmPhrase,
  confirmPhraseLabel,
  children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  /*
   * Clear the confirmation phrase and the busy flag when the dialog closes, so
   * reopening it never arrives pre-confirmed.
   *
   * Adjusted during render rather than in an effect. The guard means it runs once
   * per open/close transition, and React re-renders before committing — so a
   * reopened dialog cannot paint the previous typed phrase for a frame, which an
   * effect-based reset would allow.
   */
  const [wasOpen, setWasOpen] = useState(open);

  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setTyped("");
      setBusy(false);
    }
  }

  const phraseSatisfied = !confirmPhrase || typed.trim() === confirmPhrase;

  async function handleConfirm() {
    if (!phraseSatisfied || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      closeLabel={closeLabel}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={!phraseSatisfied}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}

      {confirmPhrase ? (
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-small font-medium">
            {confirmPhraseLabel}
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            className="min-h-11 w-full rounded-[--radius-md] border border-border-strong bg-surface px-3 py-2.5 font-mono text-base"
          />
        </div>
      ) : null}
    </Dialog>
  );
}
