import { z } from "zod";
import { apiResponse, ApiError, readMutation } from "@/lib/api";
import { getDocument, getDocumentInfo } from "@/lib/documents";
import { generateSummary } from "@/lib/paper-summary";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    const { id } = await context.params;
    const input = await readMutation(request, z.object({ documentId: z.string().uuid() }));
    const document = await getDocument(id);
    if (!document) throw new ApiError(404, "먼저 PDF를 업로드해주세요.");
    if (document.id !== input.documentId) throw new ApiError(409, "PDF가 변경되었습니다. 새로고침 후 다시 시도해주세요.");
    const summary = await generateSummary(document, request.signal);
    if ((await getDocumentInfo(id))?.id !== document.id) throw new ApiError(409, "요약 중 PDF가 변경되었습니다. 새 파일로 다시 생성해주세요.");
    return summary;
  }, 200, request);
}
