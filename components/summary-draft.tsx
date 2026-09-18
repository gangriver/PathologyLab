"use client";
import type { PaperSummary } from "@/lib/document-types";
import { getPaperSections } from "@/lib/paper-sections";
import { useLocale } from "@/hooks/use-locale";
import { getFormMessages } from "@/lib/i18n-form";

export function SummaryDraft({ draft, apply, disabled }: { draft: PaperSummary; apply: () => void; disabled: boolean }) {
  const { locale } = useLocale();
  const text = getFormMessages(locale);
  return <section className="summary-draft" aria-label={text.draftLabel}>
    <span className="badge">{text.draftBadge}</span>
    <h3>{draft.title || text.checkTitle}</h3>
    <p className="muted">{draft.authors || text.checkAuthors}</p>
    {getPaperSections(locale).map(({ key, label }) => <section className="note-section" key={key}><h4>{label}</h4><p className="note-text">{draft[key].text}</p><p className="evidence">{draft[key].pages.length ? text.evidence(draft[key].pages) : text.missingEvidence}</p></section>)}
    <p className="form-note">{text.draftHelp}</p>
    <button type="button" className="button" onClick={apply} disabled={disabled}>{text.applyDraft}</button>
  </section>;
}
