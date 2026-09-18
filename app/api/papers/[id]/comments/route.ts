import { apiResponse, readMutation } from "@/lib/api";
import { createComment } from "@/lib/papers";
import { commentSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => { const input = await readMutation(request, commentSchema); return createComment((await context.params).id, input.content); }, 201);
}
