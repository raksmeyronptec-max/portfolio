"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, TextArea, TextInput } from "@/components/ui/field";
import { Badge, Card, CardBody } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { saveSeoOverride, seoErrorLabels } from "@/lib/actions/settings";
import { localeMeta, locales, type Locale } from "@/i18n/config";
import type { AdminSeoOverride } from "@/lib/data/admin-cv";
import { cn } from "@/lib/utils/cn";

/**
 * Per-route SEO editor.
 *
 * Character counters are live and the limits mirror the database CHECK constraints
 * exactly (title 15–70, description 50–160), so a value that looks acceptable here
 * cannot then be rejected by Postgres with an opaque error. The counter turns red
 * outside the range rather than only failing on save.
 */
export function SeoManager({
  routes,
  overrides,
  canEdit,
}: {
  routes: Array<{ key: string; label: string; path: string }>;
  overrides: AdminSeoOverride[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState<{
    routeKey: string;
    routeLabel: string;
    locale: Locale;
  } | null>(null);

  const titleId = useId();
  const descriptionId = useId();
  const canonicalId = useId();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [canonical, setCanonical] = useState("");
  const [indexable, setIndexable] = useState(true);
  const [inSitemap, setInSitemap] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function open(routeKey: string, routeLabel: string, locale: Locale) {
    const existing = overrides.find(
      (item) => item.routeKey === routeKey && item.locale === locale,
    );

    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setCanonical(existing?.canonicalUrl ?? "");
    setIndexable(existing?.isIndexable ?? true);
    setInSitemap(existing?.includeInSitemap ?? true);
    setErrors({});
    setEditing({ routeKey, routeLabel, locale });
  }

  function save() {
    if (!editing) return;
    setErrors({});

    startTransition(async () => {
      const result = await saveSeoOverride({
        route_key: editing.routeKey,
        locale: editing.locale,
        title,
        description,
        canonical_url: canonical,
        is_indexable: indexable,
        include_in_sitemap: inSitemap,
      });

      if (result.ok) {
        toast.show({ tone: "success", title: "SEO metadata saved" });
        setEditing(null);
        router.refresh();
        return;
      }

      if (result.fields) setErrors(result.fields);

      toast.show({
        tone: "error",
        title: "Could not save",
        description:
          Object.values(result.fields ?? {})
            .map((code) => seoErrorLabels[code] ?? code)
            .join(" ") || "Please try again.",
      });
    });
  }

  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;
  const titleValid = titleLength === 0 || (titleLength >= 15 && titleLength <= 70);
  const descriptionValid =
    descriptionLength === 0 || (descriptionLength >= 50 && descriptionLength <= 160);

  return (
    <>
      <div className="flex flex-col gap-3">
        {routes.map((route) => (
          <Card key={route.key}>
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-small font-semibold">{route.label}</p>
                  <code className="text-[0.75rem] text-foreground-subtle">
                    /{"{locale}"}/{route.path}
                  </code>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {locales.map((locale) => {
                  const override = overrides.find(
                    (item) => item.routeKey === route.key && item.locale === locale,
                  );

                  return (
                    <div
                      key={locale}
                      className="flex items-start justify-between gap-3 rounded-[--radius-md] border border-border p-3"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="primary">
                            {localeMeta[locale].shortLabel}
                          </Badge>

                          {override ? (
                            <>
                              {override.isIndexable ? (
                                <Badge tone="success" icon="check">
                                  Indexable
                                </Badge>
                              ) : (
                                <Badge tone="danger" icon="eyeOff">
                                  noindex
                                </Badge>
                              )}
                              {!override.includeInSitemap ? (
                                <Badge tone="neutral">Not in sitemap</Badge>
                              ) : null}
                            </>
                          ) : (
                            <Badge tone="neutral">Using defaults</Badge>
                          )}
                        </div>

                        {override?.title ? (
                          <p className="truncate text-[0.8125rem] font-medium">
                            {override.title}
                          </p>
                        ) : null}

                        {override?.description ? (
                          <p className="line-clamp-2 text-[0.75rem] text-foreground-muted">
                            {override.description}
                          </p>
                        ) : (
                          <p className="text-[0.75rem] text-foreground-subtle">
                            No description set — derived from content.
                          </p>
                        )}
                      </div>

                      {canEdit ? (
                        <IconButton
                          icon="edit"
                          label={`Edit ${route.label} metadata (${localeMeta[locale].englishName})`}
                          size="sm"
                          variant="ghost"
                          onClick={() => open(route.key, route.label, locale)}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.routeLabel} — ${localeMeta[editing.locale].englishName}` : ""}
        description="Leave a field empty to fall back to the value derived from content."
        closeLabel="Close"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              loading={isPending}
              iconStart="check"
              disabled={!titleValid || !descriptionValid}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            id={titleId}
            label="Title"
            description="15–70 characters. Search engines truncate beyond roughly 60."
            error={errors.title ? seoErrorLabels[errors.title] : undefined}
            hint={
              <span className={cn(!titleValid && "font-semibold text-danger")}>
                {titleLength}/70
              </span>
            }
          >
            {({ describedBy, invalid }) => (
              <TextInput
                id={titleId}
                value={title}
                lang={editing?.locale === "km" ? "km" : undefined}
                aria-describedby={describedBy}
                aria-invalid={invalid || !titleValid || undefined}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </Field>

          <Field
            id={descriptionId}
            label="Description"
            description="50–160 characters. This is the snippet shown in results."
            error={errors.description ? seoErrorLabels[errors.description] : undefined}
            hint={
              <span className={cn(!descriptionValid && "font-semibold text-danger")}>
                {descriptionLength}/160
              </span>
            }
          >
            {({ describedBy, invalid }) => (
              <TextArea
                id={descriptionId}
                rows={3}
                value={description}
                lang={editing?.locale === "km" ? "km" : undefined}
                aria-describedby={describedBy}
                aria-invalid={invalid || !descriptionValid || undefined}
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </Field>

          <Field
            id={canonicalId}
            label="Canonical URL override"
            description="Only for genuinely duplicated content. Normally leave this empty — the canonical is derived from the site URL."
            error={
              errors.canonical_url ? seoErrorLabels[errors.canonical_url] : undefined
            }
            optionalLabel="optional"
            showOptional
          >
            {({ describedBy, invalid }) => (
              <TextInput
                id={canonicalId}
                type="url"
                value={canonical}
                placeholder="https://…"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => setCanonical(event.target.value)}
              />
            )}
          </Field>

          <Checkbox
            id="seo-indexable"
            label="Allow search engines to index this page"
            checked={indexable}
            onChange={(event) => {
              setIndexable(event.target.checked);
              // A noindex page in the sitemap is a contradictory signal.
              if (!event.target.checked) setInSitemap(false);
            }}
          />

          <Checkbox
            id="seo-sitemap"
            label="Include in the sitemap"
            description={
              indexable
                ? undefined
                : "Unavailable while the page is set to noindex — listing a noindex page in the sitemap sends search engines contradictory signals."
            }
            checked={inSitemap}
            disabled={!indexable}
            onChange={(event) => setInSitemap(event.target.checked)}
          />

          {!indexable ? (
            <p className="flex items-start gap-2 rounded-[--radius-md] bg-warning-subtle p-3 text-[0.8125rem] text-warning-foreground">
              <Icon name="alertTriangle" size={15} className="mt-0.5" />
              This page will be excluded from search results and from the sitemap.
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
