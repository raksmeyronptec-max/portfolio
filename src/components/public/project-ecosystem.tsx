"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Reveal } from "@/components/motion/reveal";
import type { Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import type { ProjectCardData } from "@/lib/data/projects";

type DiagramNode = {
  project: ProjectCardData;
  shortName: string;
  sublabel: string;
  x: number;
  y: number;
};

const NODE_POSITIONS = [
  { x: 20, y: 35 },
  { x: 500, y: 35 },
  { x: 260, y: 245 },
] as const;

/** A progressive SVG: the ordered list remains the accessible source of truth. */
export function ProjectEcosystem({
  projects,
  locale,
  t,
}: {
  projects: ProjectCardData[];
  locale: Locale;
  t: Dictionary;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [motionState, setMotionState] = useState<"pending" | "visible" | null>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);

  const nodes = useMemo(() => {
    const find = (terms: string[]) =>
      projects.find((project) => terms.some((term) => project.slug.includes(term)));
    const ordered = [
      find(["krusmart"]),
      find(["digital-library", "library"]),
      find(["storage"]),
    ].filter((project): project is ProjectCardData => Boolean(project));
    const unique = [...new Map(ordered.map((project) => [project.id, project])).values()];
    const fallback = projects.filter((project) => !unique.some((item) => item.id === project.id));
    const selected = [...unique, ...fallback].slice(0, 3);
    const labels: readonly [string, string, string] =
      locale === "km"
        ? ["គ្រូបង្រៀន", "ធនធាន", "ឯកសារ"]
        : ["teachers", "resources", "files"];

    return selected.map((project, index) => {
      const position = NODE_POSITIONS[index] ?? NODE_POSITIONS[0];
      return {
        project,
        shortName:
          index === 0 ? "KruSmart" : index === 1 ? "PTEC Library" : "PTEC Storage",
        sublabel: labels[index] ?? labels[0],
        ...position,
      };
    }) satisfies DiagramNode[];
  }, [locale, projects]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setMotionState("pending");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMotionState("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  if (nodes.length < 3) return null;

  const arrowLabels: readonly [string, string, string] =
    locale === "km"
      ? ["គ្រូប្រើប្រាស់", "រក្សាទុកធនធាន", "ឯកសារ និងទិន្នន័យ"]
      : ["teachers use", "resources stored", "files & data"];
  const connections = [
    [0, 1],
    [1, 2],
    [2, 0],
  ] as const;

  return (
    <section aria-labelledby="ecosystem-heading" className="bg-background">
      <div className="container-content section-y">
        <Reveal className="mx-auto flex max-w-[54ch] flex-col gap-4 text-center">
          <p className="text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            {t.home.ecosystem.eyebrow}
          </p>
          <h2 id="ecosystem-heading" className="text-h2">
            {t.home.ecosystem.heading}
          </h2>
          <p className="text-body-lg text-foreground-muted">{t.home.ecosystem.body}</p>
        </Reveal>

        <div
          ref={rootRef}
          className="ecosystem-diagram"
          data-motion={motionState ?? undefined}
          onMouseLeave={() => setActiveNode(null)}
        >
          <ol className="sr-only">
            {nodes.map((node) => (
              <li key={node.project.id}>
                {node.shortName}: {node.sublabel}
              </li>
            ))}
          </ol>

          <svg
            className="ecosystem-svg"
            viewBox="0 0 720 370"
            role="group"
            aria-labelledby="ecosystem-svg-title ecosystem-svg-description"
          >
            <title id="ecosystem-svg-title">{t.home.ecosystem.heading}</title>
            <desc id="ecosystem-svg-description">{t.home.ecosystem.body}</desc>
            <defs>
              <marker id="ecosystem-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="ecosystem-arrowhead" />
              </marker>
            </defs>

            <g className="ecosystem-arrows" aria-hidden="true">
              <DiagramArrow index={0} activeNode={activeNode} connection={connections[0]} d="M 220 80 L 500 80" label={arrowLabels[0]} labelX={360} labelY={62} />
              <DiagramArrow index={1} activeNode={activeNode} connection={connections[1]} d="M 600 125 C 600 205 525 280 460 285" label={arrowLabels[1]} labelX={570} labelY={205} />
              <DiagramArrow index={2} activeNode={activeNode} connection={connections[2]} d="M 260 285 C 125 350 55 290 120 125" label={arrowLabels[2]} labelX={118} labelY={324} />
            </g>

            {nodes.map((node, index) => (
              <a
                key={node.project.id}
                href={localePath(locale, `projects/${node.project.slug}`)}
                className="ecosystem-node-link"
                onMouseEnter={() => setActiveNode(index)}
                onFocus={() => setActiveNode(index)}
                onBlur={() => setActiveNode(null)}
              >
                <g className="ecosystem-node" style={{ "--node-delay": `${index * 100}ms` } as React.CSSProperties}>
                  <rect x={node.x} y={node.y} width="200" height="90" rx="10" />
                  <text x={node.x + 100} y={node.y + 40} textAnchor="middle" className="ecosystem-node-title">
                    {node.shortName}
                  </text>
                  <text x={node.x + 100} y={node.y + 62} textAnchor="middle" className="ecosystem-node-label">
                    {node.sublabel}
                  </text>
                </g>
              </a>
            ))}
          </svg>

          <div className="ecosystem-mobile" aria-hidden="true">
            {nodes.map((node, index) => (
              <div key={node.project.id} className="contents">
                <div className="ecosystem-mobile-node">
                  <strong>{node.shortName}</strong>
                  <span>{node.sublabel}</span>
                </div>
                {index < nodes.length - 1 ? (
                  <div className="ecosystem-mobile-arrow">
                    <span>{arrowLabels[index]}</span>
                  </div>
                ) : null}
              </div>
            ))}
            <div className="ecosystem-mobile-return">
              <span aria-hidden="true">↳</span> {arrowLabels[2]} → {nodes[0]?.shortName}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DiagramArrow({
  index,
  activeNode,
  connection,
  d,
  label,
  labelX,
  labelY,
}: {
  index: number;
  activeNode: number | null;
  connection: readonly number[];
  d: string;
  label: string;
  labelX: number;
  labelY: number;
}) {
  const dimmed = activeNode !== null && !connection.includes(activeNode);
  const highlighted = activeNode !== null && connection.includes(activeNode);
  return (
    <g className="ecosystem-arrow" data-dimmed={dimmed ? "true" : undefined} data-highlighted={highlighted ? "true" : undefined} style={{ "--arrow-delay": `${index * 300}ms` } as React.CSSProperties}>
      <path d={d} pathLength="1" markerEnd="url(#ecosystem-arrow)" />
      <text x={labelX} y={labelY} textAnchor="middle">{label}</text>
    </g>
  );
}
