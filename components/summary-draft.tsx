"use client";
import type { PaperSummary } from "@/lib/document-types";
import { paperSections } from "@/lib/paper-sections";

export function SummaryDraft({ draft, apply, disabled }: { draft: PaperSummary; apply: () => void; disabled: boolean }) {
  return <section className="summary-draft" aria-label="AI 요약 초안">
    <span className="badge">검토 전 AI 초안</span>
    <h3>{draft.title || "제목 확인 필요"}</h3>
    <p className="muted">{draft.authors || "저자 확인 필요"}</p>
    {paperSections.map(({ key, label }) => <section className="note-section" key={key}><h4>{label}</h4><p className="note-text">{draft[key].text}</p><p className="evidence">{draft[key].pages.length ? "근거: PDF " + draft[key].pages.join(", ") + "쪽" : "본문 근거 확인 필요"}</p></section>)}
    <p className="form-note">적용하면 제목·저자와 네 가지 정리 항목을 바꿉니다. AI는 틀릴 수 있으므로 원문을 확인하고, 아래 저장 버튼으로 확정해주세요.</p>
    <button type="button" className="button" onClick={apply} disabled={disabled}>입력란에 적용</button>
  </section>;
}
