import { Badge } from "@/components/ui/primitives";
import type { IconName } from "@/components/ui/icon";

/**
 * Publication status badge.
 *
 * Colour AND text AND an icon, in every case. A status conveyed by colour alone
 * fails for colour-blind users and disappears entirely in forced-colours mode.
 */
export function StatusBadge({
  status,
  deleted = false,
}: {
  status: "draft" | "in_review" | "published" | "archived";
  deleted?: boolean;
}) {
  if (deleted) {
    return (
      <Badge tone="danger" icon="trash">
        Deleted
      </Badge>
    );
  }

  const config: Record<
    typeof status,
    { tone: "neutral" | "info" | "success" | "warning"; label: string; icon: IconName }
  > = {
    draft: { tone: "neutral", label: "Draft", icon: "edit" },
    in_review: { tone: "info", label: "In review", icon: "eye" },
    published: { tone: "success", label: "Published", icon: "checkCircle" },
    archived: { tone: "warning", label: "Archived", icon: "archive" },
  };

  const { tone, label, icon } = config[status];

  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

/**
 * Translation coverage indicator.
 *
 * Shows which languages exist rather than a bare percentage, so the gap is
 * actionable: "missing ខ្មែរ" tells the editor what to do next.
 */
export function TranslationBadge({
  status,
  missing,
}: {
  status: "complete" | "partial" | "missing";
  missing?: string[];
}) {
  if (status === "complete") {
    return (
      <Badge tone="success" icon="languages">
        EN + ខ្មែរ
      </Badge>
    );
  }

  if (status === "missing") {
    return (
      <Badge tone="danger" icon="languages">
        No content
      </Badge>
    );
  }

  return (
    <Badge tone="warning" icon="languages">
      Missing {missing && missing.length > 0 ? missing.join(", ") : "a language"}
    </Badge>
  );
}

/** "Needs review" marker for migrated content with unverified facts. */
export function ReviewBadge({ note }: { note?: string | null }) {
  return (
    <Badge tone="warning" icon="alertTriangle" className="max-w-full">
      <span title={note ?? undefined}>Needs review</span>
    </Badge>
  );
}
