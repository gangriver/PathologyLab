import { ApiError, apiResponse, readMutation } from "@/lib/api";
import { cloudUploadSchema, createUploadTicket } from "@/lib/cloud-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return apiResponse(async () => {
    if (process.env.CLOUD_STORAGE !== "1") throw new ApiError(404, "요청한 경로를 찾을 수 없습니다.");
    return createUploadTicket(await readMutation(request, cloudUploadSchema));
  }, 201, request);
}
