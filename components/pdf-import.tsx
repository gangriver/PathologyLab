"use client";
import { usePdfImport } from "@/hooks/use-pdf-import";
import { PDF_LIMITS } from "@/lib/document-types";

export function PdfImport({ cloudStorage, onPendingChange }: { cloudStorage: boolean; onPendingChange?: (pending: boolean) => void }) {
  const { pending, error, submit } = usePdfImport(cloudStorage, onPendingChange);
  return <section className="panel document-panel">
    <h2>PDF로 시작하기</h2>
    <p className="form-note">PDF에서 제목·저자·DOI 링크를 찾아 새 논문에 자동 입력합니다. API 키 없이 사용할 수 있으며, 다음 화면에서 내용을 확인하고 수정해주세요.</p>
    <form onSubmit={submit}>
      <label className="field">논문 PDF<input type="file" name="file" accept=".pdf,application/pdf" required disabled={pending} /><small>최대 {PDF_LIMITS.maxBytes / 1024 / 1024}MB · {PDF_LIMITS.maxPages}쪽 · 누구나 첨부된 PDF를 다운로드할 수 있습니다.</small></label>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <p className="form-note">찾지 못한 정보는 직접 입력할 수 있습니다. 제목을 찾지 못하면 파일명을 사용합니다.</p>
      <button className="button" disabled={pending}>{pending ? "PDF에서 기본 정보를 읽는 중…" : "PDF 업로드 후 논문 등록"}</button>
    </form>
  </section>;
}
