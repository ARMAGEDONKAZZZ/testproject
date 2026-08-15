import { useState } from "react";

/**
 * "List" tool — the hierarchical chess-rules reference, per
 * docs/design-audit/toolboard.md section 1 ("не история решений, а
 * иерархический список уроков/правил шахмат"): How pieces move (selected),
 * The Foundations of the game (expandable, has a nested sub-point),
 * Special Move, Checkmate.
 */
const LESSONS = [
  { id: "pieces", title: "How to pieces Move" },
  {
    id: "foundations",
    title: "The Foundations of the game",
    children: [{ id: "foundations-1-1", title: "1.1 The Foundations of the game" }],
  },
  { id: "special", title: "Special Move" },
  { id: "checkmate", title: "Checkmate" },
];

export function LessonsPanel() {
  const [selected, setSelected] = useState("pieces");
  const [expanded, setExpanded] = useState<string | null>("foundations");

  return (
    <div className="space-y-1">
      {LESSONS.map((lesson) => {
        const hasChildren = "children" in lesson && lesson.children;
        const isExpanded = expanded === lesson.id;
        return (
          <div key={lesson.id}>
            <button
              onClick={() => {
                setSelected(lesson.id);
                if (hasChildren) setExpanded(isExpanded ? null : lesson.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg-elevated"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  hasChildren && isExpanded
                    ? "bg-amber-400"
                    : selected === lesson.id
                      ? "bg-accent-green"
                      : "bg-text-muted"
                }`}
              />
              <span className={selected === lesson.id ? "text-text-primary" : "text-text-secondary"}>
                {lesson.title}
              </span>
            </button>
            {hasChildren && isExpanded && (
              <div className="ml-5 border-l border-border-subtle pl-3">
                {lesson.children!.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelected(child.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-bg-elevated"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        selected === child.id ? "bg-accent-green" : "bg-text-muted"
                      }`}
                    />
                    <span className={selected === child.id ? "text-text-primary" : "text-text-secondary"}>
                      {child.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
