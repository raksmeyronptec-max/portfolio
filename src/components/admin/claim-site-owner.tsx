"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { claimSiteOwner } from "@/lib/actions/profile";

/**
 * "This account is not the one the public site reads" — and the control to fix it.
 *
 * The warning existed before this component did; what it lacked was a way out. It
 * told the reader to "have the owner flag this account instead", and no such
 * control existed anywhere in the admin. The flag was set only by `seed.sql`, and
 * only for the local development account, so on a real deployment every field on
 * this page was written to a row nothing public ever read — silently, because the
 * public pages fall back to site settings and go on looking correct.
 *
 * The consequence is spelled out rather than hidden behind a neutral verb: this
 * changes the name, headline, biography and portrait on every public page at once,
 * and it takes the identity away from whichever account currently holds it. That
 * is not a destructive action — it is reversible from the other account — but it is
 * a visible one, so it says so before it is clicked rather than after.
 */
export function ClaimSiteOwnerNotice({
  currentOwnerName,
}: {
  /** Display name of the account currently flagged, if any. */
  currentOwnerName: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function claim() {
    startTransition(async () => {
      const result = await claimSiteOwner();

      if (result.ok) {
        setDone(true);
        toast.show({
          tone: "success",
          title: "This account is now the site owner",
          description:
            "The public site reads this profile from now on. Check the About page.",
        });
        router.refresh();
        return;
      }

      toast.show({
        tone: "error",
        title:
          result.code === "forbidden"
            ? "Only an owner can do this"
            : "Could not claim the profile",
        description:
          result.detail ??
          (result.code === "forbidden"
            ? "Your role does not permit changing the site's public identity."
            : "Please try again."),
        duration: 0,
      });
    });
  }

  if (done) {
    return (
      <Notice tone="success" icon="checkCircle" title="Site-owner profile claimed">
        <p>The public site now reads the fields below.</p>
      </Notice>
    );
  }

  return (
    <Notice tone="warning" icon="shield" title="Nothing on this page is public yet">
      <div className="flex flex-col gap-3">
        <p>
          The public site reads whichever profile is flagged as site owner, and that
          is{" "}
          {currentOwnerName ? (
            <>
              currently <strong>{currentOwnerName}</strong>
            </>
          ) : (
            <>currently no account at all</>
          )}
          . Until this account holds that flag, the name, headline, biography,
          location and portrait below are saved but never rendered — the homepage
          and About page fall back to the values in Settings instead.
        </p>

        <p>
          Claiming it moves the site&rsquo;s public identity to this account
          {currentOwnerName ? " and takes it from the account named above" : ""}. It
          is reversible: sign in as the other account and claim it back.
        </p>

        <div>
          <Button
            variant="outline"
            iconStart="shield"
            loading={isPending}
            onClick={claim}
          >
            Make this the site-owner profile
          </Button>
        </div>
      </div>
    </Notice>
  );
}
