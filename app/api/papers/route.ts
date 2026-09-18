import { apiResponse, readMutation } from "@/lib/api";
import { listPapers, createPaper } from "@/lib/papers";
import { paperSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request?: Request) {
  return apiResponse(async () => listPapers(), 200, request);
}
export async function POST(request: Request) {
  return apiResponse(async () => { const input = await readMutation(request, paperSchema); return createPaper(input); }, 201, request);
}
