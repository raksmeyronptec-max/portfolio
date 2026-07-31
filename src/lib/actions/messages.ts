"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/log";
import { fail, fromPostgresError, ok, type ActionResult } from "./result";

import {
  messageStates,
  type MessageState,
} from "@/lib/validation/message";

/**
 * Contact-message triage.
 *
 * Nothing here revalidates a public path: messages never appear on the public site,
 * so there is no cached page to refresh. That absence is deliberate — reaching for
 * `revalidatePublicContent` in this file would be a sign something had gone wrong.
 *
 * The audit summary never quotes the message body. An audit log is read by whoever
 * has admin access, and copying a stranger's enquiry into it would spread their data
 * further than they consented to.
 */


export async function setMessageState(
  messageId: string,
  state: MessageState,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("manageMessages");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  // A Server Action is a public HTTP endpoint; the TypeScript parameter type is a
  // compile-time claim, not a guarantee about what arrives at runtime.
  if (!(messageStates as readonly string[]).includes(state)) {
    return fail("validation", { fields: { state: "unknownState" } });
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
    return fail("validation", { fields: { messageId: "invalidId" } });
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("contact_messages")
      .select("state, name, read_at")
      .eq("id", messageId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("contact_messages")
      .update({
        state,
        // Stamp `read_at` the first time it is opened, and never overwrite it — the
        // first-read time is the useful one.
        read_at:
          state !== "unread" && !existing.read_at
            ? new Date().toISOString()
            : existing.read_at,
      })
      .eq("id", messageId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "message.updated",
      actor: auth.session,
      entityType: "contact_message",
      entityId: messageId,
      // The sender's name only — never the message body or their email address.
      entityLabel: existing.name,
      summary: `Message state changed from ${existing.state} to ${state}.`,
      changes: { state: { from: existing.state, to: state } },
    });

    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function toggleMessageStar(
  messageId: string,
  starred: boolean,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("manageMessages");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("contact_messages")
      .update({ is_starred: starred })
      .eq("id", messageId);

    if (error) return fromPostgresError(error);
    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

export async function markMessageReplied(
  messageId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("manageMessages");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("contact_messages")
      .select("name")
      .eq("id", messageId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("contact_messages")
      .update({ replied_at: new Date().toISOString(), state: "read" })
      .eq("id", messageId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "message.updated",
      actor: auth.session,
      entityType: "contact_message",
      entityId: messageId,
      entityLabel: existing.name,
      summary: "Marked as replied.",
    });

    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

const noteSchema = z.object({
  body: z.string().trim().min(1, { message: "noteRequired" }).max(2000),
});

export async function addMessageNote(
  messageId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("manageMessages");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail("validation", { fields: { body: "noteRequired" } });

  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("contact_message_notes").insert({
      message_id: messageId,
      author_id: auth.session.userId,
      body: parsed.data.body,
    });

    if (error) return fromPostgresError(error);

    // The note text itself is not copied into the audit log — it lives in a table
    // that is already admin-only, and duplicating it adds nothing.
    await writeAuditLog({
      action: "message.updated",
      actor: auth.session,
      entityType: "contact_message",
      entityId: messageId,
      summary: "Added an internal note.",
    });

    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}

/**
 * Soft-delete a message. Owner-only.
 *
 * Soft, not hard: a message deleted by mistake is somebody's enquiry, and there is
 * no way to ask them to send it again.
 */
export async function softDeleteMessage(
  messageId: string,
): Promise<ActionResult<void>> {
  const auth = await checkPermission("deleteContent");
  if (!auth.ok) return fail(auth.reason === "forbidden" ? "forbidden" : "unauthenticated");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("contact_messages")
      .select("name")
      .eq("id", messageId)
      .maybeSingle();

    if (!existing) return fail("not_found");

    const { error } = await supabase
      .from("contact_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId);

    if (error) return fromPostgresError(error);

    await writeAuditLog({
      action: "message.deleted",
      actor: auth.session,
      entityType: "contact_message",
      entityId: messageId,
      entityLabel: existing.name,
      summary: "Soft-deleted a message.",
    });

    return ok(undefined);
  } catch {
    return fail("server_error");
  }
}
