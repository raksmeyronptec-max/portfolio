"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Admin sign-in.
 *
 * Uses Supabase Auth in the browser purely to obtain the session cookie. It is
 * deliberately NOT where authorisation is decided:
 *
 *  - After a successful password exchange, the form calls `/api/admin/session`,
 *    which verifies the token with the auth server, looks up the admin role, writes
 *    the audit entry and reports whether the account actually has admin access.
 *  - A valid Supabase user with no `admin_roles` row is signed straight back out
 *    and told why. Authentication is not authorisation, and this is where that
 *    distinction is enforced in the UI.
 *
 * Error messaging is deliberately uniform for wrong-email and wrong-password so the
 * form cannot be used to enumerate which addresses have accounts.
 */
export function LoginForm({ nextPath }: { nextPath?: string | null }) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "submitting" });

    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // Same message regardless of cause: no account enumeration.
      setStatus({
        kind: "error",
        message: "That email and password combination was not recognised.",
      });
      errorRef.current?.focus();
      return;
    }

    // The session cookie now exists, but access has not been established.
    try {
      const response = await fetch("/api/admin/session", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; reason?: string }
        | null;

      if (!response.ok || !body?.ok) {
        // Authenticated but not authorised: drop the session immediately rather
        // than leaving a useless one in place.
        await supabase.auth.signOut();

        setStatus({
          kind: "error",
          message:
            body?.reason === "no_role"
              ? "That account has no admin role assigned. Ask the site owner to grant one."
              : "Sign-in could not be completed. Please try again.",
        });
        errorRef.current?.focus();
        return;
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Could not reach the server. Check your connection and try again.",
      });
      errorRef.current?.focus();
      return;
    }

    // `replace`, not `push`: the login page should not be in the back history of
    // an authenticated session.
    router.replace(nextPath ?? "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div ref={errorRef} tabIndex={-1}>
        {status.kind === "error" ? (
          <Notice tone="danger" title="Could not sign in">
            <p>{status.message}</p>
          </Notice>
        ) : null}
      </div>

      <Field id={emailId} label="Email" required requiredLabel="required">
        {({ describedBy }) => (
          <TextInput
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Field id={passwordId} label="Password" required requiredLabel="required">
        {({ describedBy }) => (
          <div className="relative">
            <TextInput
              id={passwordId}
              name="password"
              // Toggling to `text` is what makes a long passphrase checkable
              // before submitting, which is now recommended practice rather than
              // the old "never reveal" rule.
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={describedBy}
              className="pr-12"
            />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <IconButton
                icon={showPassword ? "eyeOff" : "eye"}
                label={showPassword ? "Hide password" : "Show password"}
                size="sm"
                variant="ghost"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              />
            </span>
          </div>
        )}
      </Field>

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={status.kind === "submitting"}
        iconStart="lock"
      >
        {status.kind === "submitting" ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
