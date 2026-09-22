"use client";
import { PDF_LIMITS } from "./document-types";

export async function uploadPdf(url: string, form: FormData, cloudStorage: boolean): Promise<Response> {
  if (!cloudStorage) {
    return fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(PDF_LIMITS.fileTransferTimeoutMs) });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "PDF 파일 한 개를 선택해주세요." }, { status: 400 });
  if (!file.size || file.size > PDF_LIMITS.maxBytes) {
    return Response.json({ error: `비어 있지 않은 ${PDF_LIMITS.maxBytes / 1024 / 1024}MB 이하의 PDF를 선택해주세요.` }, { status: 413 });
  }
  if (!/\.pdf$/i.test(file.name) || !["", "application/pdf", "application/octet-stream"].includes(file.type)) {
    return Response.json({ error: "PDF 형식의 파일만 업로드할 수 있습니다." }, { status: 415 });
  }

  const preparation = await fetch("/api/papers/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, byteLength: file.size }),
    signal: AbortSignal.timeout(PDF_LIMITS.uploadTimeoutMs),
  });
  if (!preparation.ok) return preparation;
  const result: unknown = await preparation.json();
  if (typeof result !== "object" || result === null || !("uploadUrl" in result) || typeof result.uploadUrl !== "string" || !("uploadToken" in result) || typeof result.uploadToken !== "string") {
    return Response.json({ error: "PDF 업로드를 준비하지 못했습니다. 다시 시도해주세요." }, { status: 502 });
  }

  const uploaded = await fetch(result.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(PDF_LIMITS.fileTransferTimeoutMs),
  });
  await uploaded.body?.cancel();
  if (!uploaded.ok) return Response.json({ error: "PDF 파일을 업로드하지 못했습니다. 다시 시도해주세요." }, { status: 502 });

  const revision = form.get("revision");
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadToken: result.uploadToken, ...(revision === null ? {} : { revision: Number(revision) }) }),
    signal: AbortSignal.timeout(PDF_LIMITS.cloudFinalizeTimeoutMs),
  });
}
