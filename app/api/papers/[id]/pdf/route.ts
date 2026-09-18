import { NextResponse } from "next/server";
import { apiResponse, ApiError, readMutation } from "@/lib/api";
import { findPaper } from "@/lib/papers";
import { readPdfUpload, extractPdf } from "@/lib/pdf";
import { getDocument, getDocumentUrl, replaceDocument, deleteDocument } from "@/lib/documents";
import { deletePaperSchema } from "@/lib/validation";
import { isCloudStorageEnabled } from "@/lib/cloud-config";
import { readCloudPdfUpload } from "@/lib/cloud-upload";
export const runtime = "nodejs";
export const maxDuration = 240;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  let download: NextResponse | undefined;
  const error = await apiResponse(async () => {
    const { id } = await context.params;
    if (isCloudStorageEnabled()) {
      const url = await getDocumentUrl(id);
      if (!url) throw new ApiError(404, "첨부된 PDF가 없습니다.");
      download = NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
      return null;
    }
    const document = await getDocument(id);
    if (!document) throw new ApiError(404, "첨부된 PDF가 없습니다.");
    download = new NextResponse(new Uint8Array(document.content), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(document.filename).replace(/'/g, "%27"),
      "Content-Length": String(document.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    } });
    return null;
  }, 200, request);
  return download ?? error;
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const { id } = await context.params;
    if (!await findPaper(id)) throw new ApiError(404, "논문을 찾을 수 없습니다.");
    const upload = await (isCloudStorageEnabled() ? readCloudPdfUpload(request) : readPdfUpload(request));
    try {
      if (upload.revision === undefined) throw new ApiError(422, "논문 버전을 확인해주세요.");
      const extracted = await extractPdf(upload.content);
      return await replaceDocument(id, upload.filename, upload.content, extracted, upload.revision);
    } finally {
      if ("cleanup" in upload) await upload.cleanup().catch(() => console.warn("임시 PDF 정리를 완료하지 못했습니다."));
    }
  }, 200, request);
}
export async function DELETE(request: Request, context: Context) {
  return apiResponse(async () => {
    const input = await readMutation(request, deletePaperSchema);
    return deleteDocument((await context.params).id, input.revision);
  }, 200, request);
}
