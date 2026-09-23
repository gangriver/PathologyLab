"use client";
import { useEffect, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useApiRequest } from "./use-api-request";
import { REFERENCE_LINK_LIMITS, type Paper, type PaperReferenceLink } from "@/lib/types";
import type { PaperInput } from "@/lib/validation";
import { PDF_LIMITS, type PaperBasicInfo, type PaperDocumentInfo, type PaperSummary } from "@/lib/document-types";
import { paperSections } from "@/lib/paper-sections";
import { uploadPdf } from "@/lib/upload-pdf";
import { useLocale } from "./use-locale";
import { getFormMessages, type PaperFormNotice, type PaperFormOperation } from "@/lib/i18n-form";
import { normalizeGithubRepositoryUrl, type GithubLinkCandidate, type GithubLinkSuggestions } from "@/lib/github-links";

export function usePaperForm(defaultPresenter: string, cloudStorage: boolean, paper?: Paper, initialDocument?: PaperDocumentInfo, onPendingChange?: (pending: boolean) => void) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = getFormMessages(locale);
  const { pending: requesting, error, send, sendRequest } = useApiRequest();
  const [navigating, startTransition] = useTransition();
  const pending = requesting || navigating;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  const [values, setValues] = useState<PaperInput>(() => ({
    title: paper?.title ?? "", subtitle: paper?.subtitle ?? "", authors: paper?.authors ?? "", url: paper?.url ?? "",
    referenceLinks: paper?.referenceLinks ?? [],
    researchQuestion: paper?.researchQuestion ?? "", methods: paper?.methods ?? "",
    findings: paper?.findings ?? "", limitations: paper?.limitations ?? "",
    meetingDate: paper?.meetingDate ?? "", presenter: paper?.presenter ?? defaultPresenter, status: paper?.status ?? "planned",
  }));
  const [revision, setRevision] = useState(paper?.revision ?? 1);
  const [attachment, setAttachment] = useState(initialDocument);
  const [draft, setDraft] = useState<PaperSummary | null>(null);
  const [notice, setNotice] = useState<PaperFormNotice | null>(null);
  const [operation, setOperation] = useState<PaperFormOperation | null>(null);
  const [githubSuggestions, setGithubSuggestions] = useState<GithubLinkSuggestions | null>(null);
  const githubSearchComplete = githubSuggestions !== null && githubSuggestions.documentId === attachment?.id;
  const existingGithubUrls = new Set(values.referenceLinks.map(link => normalizeGithubRepositoryUrl(link.url)?.toLowerCase()).filter(Boolean));
  const githubCandidates = githubSearchComplete ? githubSuggestions.candidates.map(candidate => ({ ...candidate, added: existingGithubUrls.has(candidate.url.toLowerCase()) })) : [];
  const canAddGithubLink = values.referenceLinks.length < REFERENCE_LINK_LIMITS.maxCount || values.referenceLinks.some(link => !link.label.trim() && !link.url.trim());
  function setField<K extends keyof PaperInput>(key: K, value: PaperInput[K]) { setValues(current => ({ ...current, [key]: value })); }
  function addReferenceLink() {
    setValues(current => current.referenceLinks.length >= REFERENCE_LINK_LIMITS.maxCount ? current : { ...current, referenceLinks: [...current.referenceLinks, { label: "", url: "" }] });
  }
  function updateReferenceLink(index: number, key: keyof PaperReferenceLink, value: string) {
    setValues(current => ({ ...current, referenceLinks: current.referenceLinks.map((link, position) => position === index ? { ...link, [key]: value } : link) }));
  }
  function removeReferenceLink(index: number) {
    setValues(current => ({ ...current, referenceLinks: current.referenceLinks.filter((_, position) => position !== index) }));
  }
  async function findGithubLinks() {
    if (!paper || !attachment) return;
    setOperation("findingGithubLinks"); setNotice(null); setGithubSuggestions(null);
    const result = await sendRequest<GithubLinkSuggestions>(() => fetch(`/api/papers/${paper.id}/github-links?documentId=${encodeURIComponent(attachment.id)}`, { cache: "no-store", signal: AbortSignal.timeout(15000) }));
    if (result?.documentId === attachment.id) setGithubSuggestions(result);
  }
  function addGithubLink(candidate: GithubLinkCandidate) {
    if (!githubSearchComplete || !canAddGithubLink || existingGithubUrls.has(candidate.url.toLowerCase())) return;
    setValues(current => {
      if (current.referenceLinks.some(link => normalizeGithubRepositoryUrl(link.url)?.toLowerCase() === candidate.url.toLowerCase())) return current;
      const emptyIndex = current.referenceLinks.findIndex(link => !link.label.trim() && !link.url.trim());
      const link = { label: candidate.label, url: candidate.url };
      if (emptyIndex >= 0) return { ...current, referenceLinks: current.referenceLinks.map((existing, index) => index === emptyIndex ? link : existing) };
      return current.referenceLinks.length >= REFERENCE_LINK_LIMITS.maxCount ? current : { ...current, referenceLinks: [...current.referenceLinks, link] };
    });
    setNotice("githubLinkAdded");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOperation("saving"); setNotice(null);
    const result = await send<{ id: string }>(paper ? "/api/papers/" + paper.id : "/api/papers", paper ? "PATCH" : "POST", { ...values, ...(paper ? { revision } : {}) });
    if (result) startTransition(() => { router.push("/papers/" + result.id); router.refresh(); });
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !paper) return;
    setOperation("readingPdf"); setNotice(null);
    const form = new FormData(); form.set("file", file); form.set("revision", String(revision));
    const result = await sendRequest<{ document: PaperDocumentInfo; revision: number; basicInfo: PaperBasicInfo }>(() => uploadPdf("/api/papers/" + paper.id + "/pdf", form, cloudStorage));
    if (result) {
      setAttachment(result.document); setRevision(result.revision); setDraft(null); setGithubSuggestions(null);
      setValues(current => ({
        ...current,
        title: current.title.trim() ? current.title : result.basicInfo.title,
        authors: current.authors.trim() ? current.authors : result.basicInfo.authors,
        url: current.url.trim() ? current.url : result.basicInfo.url,
      }));
      setNotice("pdfSaved");
    }
  }
  async function removeDocument() {
    if (!paper || !window.confirm(text.deletePdfConfirm)) return;
    setOperation("deletingPdf"); setNotice(null);
    const result = await send<{ revision: number }>("/api/papers/" + paper.id + "/pdf", "DELETE", { revision });
    if (result) { setAttachment(undefined); setRevision(result.revision); setDraft(null); setGithubSuggestions(null); setNotice("pdfDeleted"); }
  }
  async function summarize() {
    if (!paper || !attachment) return;
    setOperation("summarizing"); setNotice(null); setDraft(null);
    const result = await send<PaperSummary>("/api/papers/" + paper.id + "/summary", "POST", { documentId: attachment.id }, PDF_LIMITS.summaryClientTimeoutMs);
    if (result) setDraft(result);
  }
  function applyDraft() {
    if (!draft || draft.documentId !== attachment?.id) return;
    setValues(current => {
      const next = { ...current, title: draft.title || current.title, authors: draft.authors || current.authors };
      for (const { key } of paperSections) {
        const section = draft[key];
        next[key] = section.text + (section.pages.length ? text.appliedEvidence(draft.filename, section.pages) : "");
      }
      return next;
    });
    setDraft(null); setNotice("draftApplied");
  }
  return { locale, text, values, setField, addReferenceLink, updateReferenceLink, removeReferenceLink, githubSearchComplete, githubCandidates, canAddGithubLink, findGithubLinks, addGithubLink, pending, error, notice: notice ? text.notices[notice] : "", operation: operation ? text.operations[operation] : "", submit, attachment, draft, upload, removeDocument, summarize, applyDraft };
}
