"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { TextArea } from "@/components/ui/field";
import { Badge, Card, CardBody, Divider, MetaList } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  addMessageNote,
  markMessageReplied,
  setMessageState,
  softDeleteMessage,
  toggleMessageStar,
} from "@/lib/actions/messages";
import type { AdminMessageRow } from "@/lib/data/admin";
import { cn } from "@/lib/utils/cn";

/**
 * Message inbox.
 *
 * Opening a message marks it read, which is the behaviour every mail client has and
 * therefore the one that needs no explanation. The state change is fired without
 * awaiting it so the dialog opens immediately.
 *
 * The reply action is a `mailto:` link, not an in-app composer. Sending mail from
 * the server would need a verified sending domain, SPF/DKIM and bounce handling to
 * be reliable; handing off to the operator's own mail client is honest about what
 * this system actually does. `markMessageReplied` then records that a reply was
 * sent, without claiming to have sent it.
 */
export function MessageList({
  messages,
  canManage,
  canDelete,
}: {
  messages: AdminMessageRow[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState<AdminMessageRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminMessageRow | null>(null);
  const [note, setNote] = useState("");

  function openMessage(message: AdminMessageRow) {
    setOpen(message);
    setNote("");

    if (message.state === "unread" && canManage) {
      startTransition(async () => {
        await setMessageState(message.id, "read");
        router.refresh();
      });
    }
  }

  function act(label: string, run: () => Promise<{ ok: boolean }>) {
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        toast.show({ tone: "success", title: label });
        router.refresh();
      } else {
        toast.show({ tone: "error", title: "Action failed" });
      }
    });
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {messages.map((message) => (
          <li key={message.id}>
            <Card
              className={cn(
                "transition-colors",
                message.state === "unread" && "border-l-4 border-l-primary",
                message.state === "spam" && "opacity-70",
              )}
            >
              <CardBody className="flex flex-wrap items-start gap-3 p-4">
                <button
                  type="button"
                  onClick={() => openMessage(message)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-start"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-small",
                        message.state === "unread" ? "font-semibold" : "font-medium",
                      )}
                    >
                      {message.name}
                    </span>

                    {message.state === "unread" ? (
                      <Badge tone="primary">New</Badge>
                    ) : null}
                    {message.isStarred ? (
                      <Badge tone="accent" icon="star">
                        Starred
                      </Badge>
                    ) : null}
                    {message.state === "spam" ? (
                      <Badge tone="danger" icon="alertTriangle">
                        Spam
                      </Badge>
                    ) : null}
                    {message.state === "archived" ? (
                      <Badge tone="neutral" icon="archive">
                        Archived
                      </Badge>
                    ) : null}
                    {message.repliedAt ? (
                      <Badge tone="success" icon="check">
                        Replied
                      </Badge>
                    ) : null}
                    {message.spamScore >= 40 && message.state !== "spam" ? (
                      <Badge tone="warning">Spam score {message.spamScore}</Badge>
                    ) : null}
                  </span>

                  <span className="text-[0.8125rem] text-foreground-muted">
                    {message.subject || "(no subject)"}
                    {message.organization ? ` · ${message.organization}` : ""}
                  </span>

                  <span className="line-clamp-2 text-[0.8125rem] text-foreground-subtle">
                    {message.message}
                  </span>

                  <span className="text-[0.75rem] text-foreground-subtle">
                    <time dateTime={message.createdAt}>
                      {new Date(message.createdAt).toLocaleString("en-GB")}
                    </time>
                    {" · "}
                    {message.locale.toUpperCase()}
                    {!message.notificationSent ? " · no notification sent" : ""}
                  </span>
                </button>

                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      icon="star"
                      label={
                        message.isStarred
                          ? `Unstar message from ${message.name}`
                          : `Star message from ${message.name}`
                      }
                      size="sm"
                      variant={message.isStarred ? "accent" : "ghost"}
                      aria-pressed={message.isStarred}
                      disabled={isPending}
                      onClick={() =>
                        act(message.isStarred ? "Unstarred" : "Starred", () =>
                          toggleMessageStar(message.id, !message.isStarred),
                        )
                      }
                    />

                    {message.state !== "archived" ? (
                      <IconButton
                        icon="archive"
                        label={`Archive message from ${message.name}`}
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          act("Archived", () => setMessageState(message.id, "archived"))
                        }
                      />
                    ) : (
                      <IconButton
                        icon="restore"
                        label={`Move message from ${message.name} back to the inbox`}
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          act("Moved to inbox", () => setMessageState(message.id, "read"))
                        }
                      />
                    )}

                    {message.state !== "spam" ? (
                      <IconButton
                        icon="alertTriangle"
                        label={`Mark message from ${message.name} as spam`}
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          act("Marked as spam", () => setMessageState(message.id, "spam"))
                        }
                      />
                    ) : (
                      <IconButton
                        icon="check"
                        label={`Mark message from ${message.name} as not spam`}
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          act("Marked as not spam", () =>
                            setMessageState(message.id, "read"),
                          )
                        }
                      />
                    )}

                    {canDelete ? (
                      <IconButton
                        icon="trash"
                        label={`Delete message from ${message.name}`}
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => setConfirmDelete(message)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      {/* ── Message detail ──────────────────────────────────────────────────── */}
      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.subject || "Message"}
        description={open ? `From ${open.name}` : undefined}
        closeLabel="Close"
        size="lg"
        footer={
          open ? (
            <>
              <Button variant="outline" onClick={() => setOpen(null)}>
                Close
              </Button>

              {canManage ? (
                <Button
                  variant="ghost"
                  iconStart="check"
                  disabled={isPending}
                  onClick={() =>
                    act("Marked as replied", () => markMessageReplied(open.id))
                  }
                >
                  Mark as replied
                </Button>
              ) : null}

              <a
                href={`mailto:${open.email}?subject=${encodeURIComponent(
                  open.subject ? `Re: ${open.subject}` : "Re: your message",
                )}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[--radius-md] bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary-hover"
              >
                <Icon name="mail" size={17} />
                Reply by email
              </a>
            </>
          ) : undefined
        }
      >
        {open ? (
          <div className="flex flex-col gap-5">
            {open.spamScore >= 40 ? (
              <Notice tone="warning" icon="alertTriangle">
                <p>
                  Heuristic spam score {open.spamScore}/100. Scored on submission
                  speed, link count and keywords — it is a hint, not a verdict.
                </p>
              </Notice>
            ) : null}

            {!open.notificationSent ? (
              <Notice tone="info" icon="info">
                <p>
                  {open.notificationError
                    ? `No notification was delivered (${open.notificationError}). The message was still saved.`
                    : "No notification was configured when this arrived. The message was saved regardless."}
                </p>
              </Notice>
            ) : null}

            <MetaList
              items={[
                { label: "Name", value: open.name },
                {
                  label: "Email",
                  value: (
                    <a
                      href={`mailto:${open.email}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {open.email}
                    </a>
                  ),
                },
                { label: "Organisation", value: open.organization ?? undefined },
                { label: "About", value: open.projectType ?? undefined },
                {
                  label: "Prefers",
                  value: open.preferredContact ?? undefined,
                },
                { label: "Language", value: open.locale.toUpperCase() },
                {
                  label: "Consent given",
                  value: open.consentGiven ? "Yes" : "No",
                },
                {
                  label: "Received",
                  value: new Date(open.createdAt).toLocaleString("en-GB"),
                },
                {
                  label: "Replied",
                  value: open.repliedAt
                    ? new Date(open.repliedAt).toLocaleString("en-GB")
                    : undefined,
                },
              ]}
            />

            <Divider />

            <div className="flex flex-col gap-2">
              <h3 className="text-small font-semibold">Message</h3>
              {/* Rendered as text, never as HTML. */}
              <p className="whitespace-pre-wrap rounded-[--radius-md] border border-border bg-surface-muted/40 p-4 text-small leading-relaxed">
                {open.message}
              </p>
            </div>

            {canManage ? (
              <>
                <Divider />
                <div className="flex flex-col gap-2">
                  <label htmlFor="message-note" className="text-small font-semibold">
                    Add an internal note
                  </label>
                  <p
                    id="message-note-hint"
                    className="text-[0.8125rem] text-foreground-muted"
                  >
                    Only visible to admins. Never shown to the sender.
                  </p>
                  <TextArea
                    id="message-note"
                    rows={3}
                    value={note}
                    aria-describedby="message-note-hint"
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!note.trim() || isPending}
                      onClick={() =>
                        act("Note added", async () => {
                          const result = await addMessageNote(open.id, { body: note });
                          if (result.ok) setNote("");
                          return result;
                        })
                      }
                    >
                      Save note
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const target = confirmDelete;
          setConfirmDelete(null);
          act("Message deleted", () => softDeleteMessage(target.id));
        }}
        title="Delete this message?"
        description="A soft delete — the row is retained in the database but removed from the inbox. Nothing is sent to the sender."
        confirmLabel="Delete message"
        cancelLabel="Cancel"
        closeLabel="Close"
      />
    </>
  );
}
