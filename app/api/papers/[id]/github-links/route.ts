import { z } from "zod";
import { apiResponse, ApiError } from "@/lib/api";
import { getDocumentInfo, getDocumentText } from "@/lib/documents";
import { PDF_LIMITS } from "@/lib/document-types";
import { extractGithubLinks } from "@/lib/github-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pagesSchema = z.array(z.object({
  pageNumber: z.number().int().min(1).max(PDF_LIMITS.maxPages),
  text: z.string().max(PDF_LIMITS.maxTextCharacters),
})).max(PDF_LIMITS.maxPages).refine(pages => pages.reduce((length, page) => length + page.text.length, 0) <= PDF_LIMITS.maxTextCharacters);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    const { id } = await context.params;
    const input = z.string().uuid().safeParse(new URL(request.url).searchParams.get("documentId"));
    if (!input.success) throw new ApiError(422, "입력 내용을 확인해주세요.");
    const document = await getDocumentText(id);
    if (!document) throw new ApiError(404, "첨부된 PDF가 없습니다.");
    if (document.id !== input.data) throw new ApiError(409, "PDF가 변경되었습니다. 새로고침 후 다시 시도해주세요.");
    let storedPages: unknown;
    try { storedPages = JSON.parse(document.pagesJson); }
    catch { throw new ApiError(422, "PDF 내용을 읽지 못했습니다."); }
    const pages = pagesSchema.safeParse(storedPages);
    if (!pages.success) throw new ApiError(422, "PDF 내용을 읽지 못했습니다.");
    const candidates = extractGithubLinks(pages.data);
    if ((await getDocumentInfo(id))?.id !== document.id) throw new ApiError(409, "PDF가 변경되었습니다. 새로고침 후 다시 시도해주세요.");
    return { documentId: document.id, candidates };
  }, 200, request);
}
