import { apiResponse, readMutation } from "@/lib/api";
import { listPapers, createPaper } from "@/lib/papers";
import { paperSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return apiResponse(async () => listPapers());
}
export async function POST(request: Request) {
  return apiResponse(async () => { const input = await readMutation(request, paperSchema); return createPaper(input); }, 201);
}
