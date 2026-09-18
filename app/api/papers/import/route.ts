import { apiResponse } from "@/lib/api";
import { readPdfUpload, extractPdf } from "@/lib/pdf";
import { importPaper } from "@/lib/documents";
import { isCloudStorageEnabled } from "@/lib/cloud-config";
import { readCloudPdfUpload } from "@/lib/cloud-upload";
export const runtime = "nodejs";
export const maxDuration = 240;
export async function POST(request: Request) {
  return apiResponse(async () => {
    const upload = await (isCloudStorageEnabled() ? readCloudPdfUpload(request) : readPdfUpload(request));
    try {
      const extracted = await extractPdf(upload.content);
      return await importPaper(upload.filename, upload.content, extracted, "uploadId" in upload ? upload.uploadId : undefined);
    } finally {
      if ("cleanup" in upload) await upload.cleanup().catch(() => console.warn("임시 PDF 정리를 완료하지 못했습니다."));
    }
  }, 201, request);
}
