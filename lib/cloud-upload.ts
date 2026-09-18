import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError, readMutation } from "./api";
import { PDF_LIMITS } from "./document-types";
import { deletePdf, getPdf, getPdfUploadUrl, R2_URL_LIFETIME_SECONDS } from "./r2";

export const cloudUploadSchema = z.object({
  filename: z.string().trim().min(1, "PDF 파일을 선택해주세요.").max(1000).regex(/\.pdf$/i, "PDF 형식의 파일만 업로드할 수 있습니다."),
  byteLength: z.number().int().positive("비어 있는 PDF 파일은 사용할 수 없습니다.").max(PDF_LIMITS.maxBytes, `PDF는 ${PDF_LIMITS.maxBytes / 1024 / 1024}MB 이하로 업로드해주세요.`),
});
const ticketSchema = cloudUploadSchema.extend({ id: z.uuid(), expiresAt: z.number().int().positive() }).strict();
const uploadSchema = z.object({ uploadToken: z.string().min(1).max(8000), revision: z.number().int().positive().optional() }).strict();

function signature(payload: string) {
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!secret) throw new ApiError(503, "PDF 저장소 연결이 설정되지 않았습니다.");
  const key = createHmac("sha256", secret).update("pathology-lab/pdf-upload/v1").digest();
  return createHmac("sha256", key).update(payload).digest();
}

export async function createUploadTicket(input: { filename: string; byteLength: number }): Promise<{ uploadUrl: string; uploadToken: string }> {
  const result = cloudUploadSchema.safeParse(input);
  if (!result.success) throw new ApiError(422, result.error.issues[0]?.message ?? "PDF 파일 정보를 확인해주세요.");
  const filename = Array.from(result.data.filename.toWellFormed().replace(/[\\/\u0000-\u001f\u007f]/g, "_")).slice(-200).join("");
  const metadata = { id: randomUUID(), filename, byteLength: result.data.byteLength, expiresAt: Date.now() + R2_URL_LIFETIME_SECONDS * 1000 };
  const payload = Buffer.from(JSON.stringify(metadata)).toString("base64url");
  const uploadToken = `${payload}.${signature(payload).toString("base64url")}`;
  const uploadUrl = await getPdfUploadUrl(`staging/${metadata.id}.pdf`, metadata.byteLength);
  return { uploadUrl, uploadToken };
}

export async function readCloudPdfUpload(request: Request): Promise<{ uploadId: string; filename: string; content: Uint8Array; revision?: number; cleanup: () => Promise<void> }> {
  const { uploadToken, revision } = await readMutation(request, uploadSchema);
  const parts = uploadToken.split(".");
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new ApiError(400, "PDF 업로드 정보를 확인해주세요.");
  const receivedSignature = Buffer.from(parts[1], "base64url");
  const expectedSignature = signature(parts[0]);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) throw new ApiError(400, "PDF 업로드 정보를 확인해주세요.");
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { throw new ApiError(400, "PDF 업로드 정보를 확인해주세요."); }
  const result = ticketSchema.safeParse(decoded);
  if (!result.success) throw new ApiError(400, "PDF 업로드 정보를 확인해주세요.");
  if (result.data.expiresAt <= Date.now()) throw new ApiError(410, "PDF 업로드 시간이 만료되었습니다. 파일을 다시 선택해주세요.");
  const { id, filename, byteLength } = result.data;
  const storageKey = `staging/${id}.pdf`;
  const content = await getPdf(storageKey);
  if (content.byteLength !== byteLength) throw new ApiError(422, "업로드한 PDF의 크기가 일치하지 않습니다. 파일을 다시 선택해주세요.");
  if (new TextDecoder().decode(content.subarray(0, 5)) !== "%PDF-") throw new ApiError(415, "올바른 PDF 파일이 아닙니다.");
  return { uploadId: id, filename, content, revision, cleanup: () => deletePdf(storageKey) };
}
