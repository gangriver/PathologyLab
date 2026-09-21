import type { Paper } from "./types";

export function formatPaperTitle(paper: Pick<Paper, "title" | "subtitle">): string {
  return paper.subtitle ? `${paper.title} [${paper.subtitle}]` : paper.title;
}
