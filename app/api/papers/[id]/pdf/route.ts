import { NextResponse } from "next/server";
import { apiResponse, ApiError, readMutation } from "@/lib/api";
import { findPaper } from "@/lib/papers";
import { readPdfUpload, extractPdf } from "@/lib/pdf";
import { getDocument, replaceDocument, deleteDocument } from "@/lib/documents";
import { deletePaperSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  let download: NextResponse | undefined;
  const error = await apiResponse(async () => {
    const document = getDocument((await context.params).id);
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
  });
  return download ?? error;
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const { id } = await context.params;
    if (!findPaper(id)) throw new ApiError(404, "논문을 찾을 수 없습니다.");
    const upload = await readPdfUpload(request);
    if (upload.revision === undefined) throw new ApiError(422, "논문 버전을 확인해주세요.");
    const extracted = await extractPdf(upload.content);
    return replaceDocument(id, upload.filename, upload.content, extracted, upload.revision);
  });
}
export async function DELETE(request: Request, context: Context) {
  return apiResponse(async () => {
    const input = await readMutation(request, deletePaperSchema);
    return deleteDocument((await context.params).id, input.revision);
  });
}
