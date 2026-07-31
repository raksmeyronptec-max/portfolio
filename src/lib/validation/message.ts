/**
 * Contact-message workflow states.
 *
 * Kept out of the Server Action module: a `"use server"` file may only export
 * async functions, and even a frozen array counts as an object. See
 * src/lib/validation/profile.ts for the full note.
 */
export const messageStates = ["unread", "read", "archived", "spam"] as const;

export type MessageState = (typeof messageStates)[number];
