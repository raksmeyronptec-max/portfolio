import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { MessageList } from "@/components/admin/message-list";
import { LinkTabs } from "@/components/ui/navigation";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listAdminMessages, type AdminMessageRow } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "starred", label: "Starred" },
  { key: "archived", label: "Archived" },
  { key: "spam", label: "Spam" },
  { key: "all", label: "All" },
] as const;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, query] = await Promise.all([
    requirePermission("viewMessages", "/admin/messages"),
    searchParams,
  ]);

  const stateParam = single(query.state) ?? "unread";
  const state = TABS.some((tab) => tab.key === stateParam)
    ? (stateParam as AdminMessageRow["state"] | "all" | "starred")
    : "unread";
  const search = single(query.q) ?? "";

  const [messages, allMessages] = await Promise.all([
    listAdminMessages({ state, search }),
    listAdminMessages({ state: "all" }),
  ]);

  const counts = {
    unread: allMessages.filter((m) => m.state === "unread").length,
    read: allMessages.filter((m) => m.state === "read").length,
    starred: allMessages.filter((m) => m.isStarred).length,
    archived: allMessages.filter((m) => m.state === "archived").length,
    spam: allMessages.filter((m) => m.state === "spam").length,
    all: allMessages.length,
  } as Record<string, number>;

  const unnotified = allMessages.filter(
    (message) => !message.notificationSent && message.state === "unread",
  ).length;

  return (
    <>
      <AdminPageHeader
        title="Messages"
        description="Enquiries from the public contact form. Messages are stored in the database first and notified second, so nothing is lost if a notification fails."
      />

      <AdminPageBody className="flex flex-col gap-5">
        {unnotified > 0 ? (
          <Notice tone="info" icon="info">
            <p>
              {unnotified} unread message{unnotified === 1 ? "" : "s"} arrived without a
              delivered notification. That usually means{" "}
              <code>TELEGRAM_BOT_TOKEN</code> is unset. The messages themselves were
              saved normally.
            </p>
          </Notice>
        ) : null}

        <LinkTabs
          label="Filter messages"
          items={TABS.map((tab) => ({
            href: `/admin/messages?state=${tab.key}`,
            label: tab.label,
            active: state === tab.key,
            count: counts[tab.key] ?? 0,
          }))}
        />

        <form method="get" role="search" className="flex flex-wrap gap-2">
          <input type="hidden" name="state" value={state} />
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Icon
              name="search"
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
            />
            <input
              type="search"
              name="q"
              defaultValue={search}
              aria-label="Search messages"
              placeholder="Search name, email or content"
              className="min-h-11 w-full rounded-(--radius-md) border border-border-strong bg-surface pl-10 pr-3 text-base"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border-strong bg-surface px-4 text-small font-medium hover:bg-surface-muted"
          >
            Search
          </button>
        </form>

        {messages.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={
              search
                ? "No messages match that search"
                : state === "unread"
                  ? "No unread messages"
                  : `No ${state} messages`
            }
            description={
              state === "unread" && !search
                ? "New enquiries from the contact form will appear here."
                : undefined
            }
          />
        ) : (
          <MessageList
            messages={messages}
            canManage={permissions.manageMessages(session.role)}
            canDelete={permissions.deleteContent(session.role)}
          />
        )}
      </AdminPageBody>
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
