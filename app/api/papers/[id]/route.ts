import { apiResponse, readMutation, ApiError } from "@/lib/api";
import { findPaper, editPaper, removePaper, listComments } from "@/lib/papers";
import { updatePaperSchema, deletePaperSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return apiResponse(async () => { const { id } = await context.params; const paper = await findPaper(id); if (!paper) throw new ApiError(404, "논문을 찾을 수 없습니다."); return { paper, comments: await listComments(id) }; }, 200, request);
}
export async function PATCH(request: Request, context: Context) {
  return apiResponse(async () => { const input = await readMutation(request, updatePaperSchema); return editPaper((await context.params).id, input, input.revision); }, 200, request);
}
export async function DELETE(request: Request, context: Context) {
  return apiResponse(async () => { const input = await readMutation(request, deletePaperSchema); return removePaper((await context.params).id, input.revision); }, 200, request);
}
