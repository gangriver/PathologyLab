"use client";
import { usePdfImport } from "@/hooks/use-pdf-import";
import { PDF_LIMITS } from "@/lib/document-types";

export function PdfImport({ cloudStorage, onPendingChange }: { cloudStorage: boolean; onPendingChange?: (pending: boolean) => void }) {
  const { text, pending, error, submit } = usePdfImport(cloudStorage, onPendingChange);
  return <section className="panel document-panel">
    <h2>{text.importHeading}</h2>
    <p className="form-note">{text.importHelp}</p>
    <form onSubmit={submit}>
      <label className="field">{text.paperPdf}<input type="file" name="file" accept=".pdf,application/pdf" required disabled={pending} /><small>{text.importLimits(PDF_LIMITS.maxBytes / 1024 / 1024, PDF_LIMITS.maxPages)}</small></label>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <p className="form-note">{text.missingInfo}</p>
      <button className="button" disabled={pending}>{pending ? text.readingBasicInfo : text.addPdfPaper}</button>
    </form>
  </section>;
}
