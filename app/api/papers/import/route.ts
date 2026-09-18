import { apiResponse } from "@/lib/api";
import { readPdfUpload, extractPdf } from "@/lib/pdf";
import { importPaper } from "@/lib/documents";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return apiResponse(async () => {
    const upload = await readPdfUpload(request);
    const extracted = await extractPdf(upload.content);
    return importPaper(upload.filename, upload.content, extracted);
  }, 201);
}
