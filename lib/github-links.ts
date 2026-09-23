import type { PdfPage } from "./document-types";
import { REFERENCE_LINK_LIMITS } from "./types";

export type GithubLinkCandidate = { label: string; url: string; pages: number[] };
export type GithubLinkSuggestions = { documentId: string; candidates: GithubLinkCandidate[] };

const reservedRoutes = new Set([
  "about", "account", "apps", "codespaces", "collections", "contact", "copilot",
  "customer-stories", "dashboard", "enterprise", "events", "explore", "features",
  "git-guides", "join", "login", "logout", "marketplace", "new", "notifications",
  "organizations", "orgs", "pricing", "readme", "resources", "search", "security",
  "sessions", "settings", "signup", "site", "solutions", "sponsors", "topics", "users",
]);

export function normalizeGithubRepositoryUrl(value: string): string | undefined {
  const cleaned = value.trim().replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/[)\]}>.,;:!?，。；：！？”’]+$/g, "");
  if (/\s|\\/.test(cleaned)) return undefined;
  const match = /^(?:https?:\/\/)?((?:www\.)?github\.com)\/([^?#]*)(?:[?#].*)?$/i.exec(cleaned);
  if (!match) return undefined;
  const parts = match[2].split("/");
  if (parts.some(part => part === "." || part === "..")) return undefined;
  const owner = parts[0];
  const repository = (parts[1] ?? "").replace(/\.git$/i, "");
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner)
    || reservedRoutes.has(owner.toLowerCase())
    || !/^[a-z\d._-]{1,100}$/i.test(repository)
    || repository === "." || repository === "..") return undefined;
  return `https://github.com/${owner}/${repository}`;
}

function joinPdfUrlLines(text: string) {
  const cleaned = text.replace(/\u00ad(?:[ \t]*\r?\n[ \t]*)?/g, "")
    .replace(/[\u200b-\u200d\ufeff]/g, "");
  // URL의 슬래시 경계에서만 줄바꿈을 이어 일반 단어나 문장을 붙이지 않습니다.
  return cleaned.replace(
    /(?:https?:\/\/)?(?:www\.)?github\.com(?:[ \t]*\r?\n[ \t]*)?\/(?:[ \t]*\r?\n[ \t]*)?[a-z\d][a-z\d-]*(?:[ \t]*\r?\n[ \t]*)?\/(?:[ \t]*\r?\n[ \t]*)?[a-z\d._-]+/gi,
    value => value.replace(/\s/g, ""),
  );
}

export function extractGithubLinks(pages: PdfPage[]): GithubLinkCandidate[] {
  const candidates = new Map<string, GithubLinkCandidate>();
  for (const page of [...pages].sort((first, second) => first.pageNumber - second.pageNumber)) {
    for (const token of joinPdfUrlLines(page.text).match(/[^\s<>"'`]+/g) ?? []) {
      const url = normalizeGithubRepositoryUrl(token.replace(/^[([{]+/, ""));
      if (!url) continue;
      const key = url.toLowerCase();
      const existing = candidates.get(key);
      if (existing) {
        if (!existing.pages.includes(page.pageNumber)) existing.pages.push(page.pageNumber);
      } else {
        candidates.set(key, {
          label: url.slice("https://github.com/".length, "https://github.com/".length + REFERENCE_LINK_LIMITS.maxLabelLength),
          url,
          pages: [page.pageNumber],
        });
      }
    }
  }
  return [...candidates.values()];
}
