"use client";
import { useEffect, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useApiRequest } from "./use-api-request";
import type { Paper } from "@/lib/types";
import type { PaperInput } from "@/lib/validation";
import { PDF_LIMITS, type PaperBasicInfo, type PaperDocumentInfo, type PaperSummary } from "@/lib/document-types";
import { paperSections } from "@/lib/paper-sections";
import { uploadPdf } from "@/lib/upload-pdf";

export function usePaperForm(defaultPresenter: string, cloudStorage: boolean, paper?: Paper, initialDocument?: PaperDocumentInfo, onPendingChange?: (pending: boolean) => void) {
  const router = useRouter();
  const { pending: requesting, error, send, sendRequest } = useApiRequest();
  const [navigating, startTransition] = useTransition();
  const pending = requesting || navigating;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  const [values, setValues] = useState<PaperInput>(() => ({
    title: paper?.title ?? "", authors: paper?.authors ?? "", url: paper?.url ?? "",
    researchQuestion: paper?.researchQuestion ?? "", methods: paper?.methods ?? "",
    findings: paper?.findings ?? "", limitations: paper?.limitations ?? "",
    meetingDate: paper?.meetingDate ?? "", presenter: paper?.presenter ?? defaultPresenter, status: paper?.status ?? "planned",
  }));
  const [revision, setRevision] = useState(paper?.revision ?? 1);
  const [attachment, setAttachment] = useState(initialDocument);
  const [draft, setDraft] = useState<PaperSummary | null>(null);
  const [notice, setNotice] = useState("");
  const [operation, setOperation] = useState("");
  function setField<K extends keyof PaperInput>(key: K, value: PaperInput[K]) { setValues(current => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperation("저장 중…"); setNotice("");
    const result = await send<{ id: string }>(paper ? "/api/papers/" + paper.id : "/api/papers", paper ? "PATCH" : "POST", { ...values, ...(paper ? { revision } : {}) });
    if (result) startTransition(() => { router.push("/papers/" + result.id); router.refresh(); });
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !paper) return;
    setOperation("PDF를 읽는 중…"); setNotice("");
    const form = new FormData(); form.set("file", file); form.set("revision", String(revision));
    const result = await sendRequest<{ document: PaperDocumentInfo; revision: number; basicInfo: PaperBasicInfo }>(() => uploadPdf("/api/papers/" + paper.id + "/pdf", form, cloudStorage));
    if (result) {
      setAttachment(result.document); setRevision(result.revision); setDraft(null);
      setValues(current => ({
        ...current,
        title: current.title.trim() ? current.title : result.basicInfo.title,
        authors: current.authors.trim() ? current.authors : result.basicInfo.authors,
        url: current.url.trim() ? current.url : result.basicInfo.url,
      }));
      setNotice("PDF가 저장되었습니다. 추출한 기본 정보는 빈 입력란에만 채웁니다. 내용을 확인한 뒤 ‘수정 내용 저장’을 눌러주세요.");
    }
  }
  async function removeDocument() {
    if (!paper || !window.confirm("첨부된 PDF를 삭제할까요? 논문 정리 내용은 유지됩니다.")) return;
    setOperation("PDF 삭제 중…"); setNotice("");
    const result = await send<{ revision: number }>("/api/papers/" + paper.id + "/pdf", "DELETE", { revision });
    if (result) { setAttachment(undefined); setRevision(result.revision); setDraft(null); setNotice("PDF를 삭제했습니다. 정리에 남아 있는 원문 참조도 확인해주세요."); }
  }
  async function summarize() {
    if (!paper || !attachment) return;
    setOperation("AI가 요약 초안을 작성하는 중…"); setNotice(""); setDraft(null);
    const result = await send<PaperSummary>("/api/papers/" + paper.id + "/summary", "POST", { documentId: attachment.id }, PDF_LIMITS.summaryClientTimeoutMs);
    if (result) setDraft(result);
  }
  function applyDraft() {
    if (!draft || draft.documentId !== attachment?.id) return;
    setValues(current => {
      const next = { ...current, title: draft.title || current.title, authors: draft.authors || current.authors };
      for (const { key } of paperSections) {
        const section = draft[key];
        next[key] = section.text + (section.pages.length ? "\n\n[AI 초안 근거: " + draft.filename + " · PDF " + section.pages.join(", ") + "쪽]" : "");
      }
      return next;
    });
    setDraft(null); setNotice("AI 초안을 입력란에 적용했습니다. 원문과 비교해 수정한 뒤 ‘수정 내용 저장’을 눌러주세요.");
  }
  return { values, setField, pending, error, notice, operation, submit, attachment, draft, upload, removeDocument, summarize, applyDraft };
}
